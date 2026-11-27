-- Keep lesson answers and XP server-verified; browser roles can read but not forge progress answers.
revoke insert, update on table public.lesson_progress from authenticated;
grant select, delete on table public.lesson_progress to authenticated;
drop function if exists public.award_study_xp(text,text);

create or replace function public.record_study_lesson_step(p_lesson_slug text,p_step_index integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_lesson public.lessons%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into v_lesson from public.lessons where slug=p_lesson_slug and status='published';
  if not found then raise exception 'lesson not found' using errcode='22023'; end if;
  if p_step_index < 0 or p_step_index >= jsonb_array_length(v_lesson.content->'steps') then
    raise exception 'invalid lesson step' using errcode='22023';
  end if;
  insert into public.lesson_progress(user_id,lesson_id,step_index,last_studied_at)
  values(auth.uid(),v_lesson.id,p_step_index,now())
  on conflict(user_id,lesson_id) do update set step_index=excluded.step_index,last_studied_at=excluded.last_studied_at;
end $$;

create or replace function public.submit_study_lesson_answer(p_lesson_slug text,p_step_index integer,p_answer_id text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_lesson public.lessons%rowtype; v_step jsonb; v_source text; v_awarded integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into v_lesson from public.lessons where slug=p_lesson_slug and status='published';
  if not found then raise exception 'lesson not found' using errcode='22023'; end if;
  if p_step_index < 0 or p_step_index >= jsonb_array_length(v_lesson.content->'steps') then
    raise exception 'invalid lesson step' using errcode='22023';
  end if;
  v_step := v_lesson.content->'steps'->p_step_index;
  if v_step->>'type' <> 'ask' or v_step->>'answerId' is distinct from p_answer_id then
    raise exception 'answer is not correct' using errcode='22023';
  end if;
  v_source := p_lesson_slug||':'||p_step_index::text;
  insert into public.xp_events(user_id,points,reason,source_id)
  values(auth.uid(),10,'answer_correct',v_source)
  on conflict(user_id,reason,source_id) where source_id is not null do nothing
  returning points into v_awarded;
  insert into public.lesson_progress(user_id,lesson_id,step_index,last_studied_at,answered_steps)
  values(auth.uid(),v_lesson.id,p_step_index,now(),array[v_source])
  on conflict(user_id,lesson_id) do update set
    step_index=excluded.step_index,last_studied_at=excluded.last_studied_at,
    answered_steps=array(select distinct answer_key from unnest(public.lesson_progress.answered_steps||excluded.answered_steps) as answer_key);
  return coalesce(v_awarded,0);
end $$;

create or replace function public.complete_study_lesson(p_lesson_slug text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_lesson public.lessons%rowtype; v_required text[]; v_answered text[]; v_steps_count integer; v_awarded integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into v_lesson from public.lessons where slug=p_lesson_slug and status='published';
  if not found then raise exception 'lesson not found' using errcode='22023'; end if;
  v_steps_count := jsonb_array_length(v_lesson.content->'steps');
  select array_agg(p_lesson_slug||':'||(ordinality-1)::text order by ordinality)
    into v_required
    from jsonb_array_elements(v_lesson.content->'steps') with ordinality as step(value,ordinality)
    where value->>'type'='ask';
  if coalesce(cardinality(v_required),0)=0 then raise exception 'lesson has no questions' using errcode='22023'; end if;
  select answered_steps into v_answered from public.lesson_progress
    where user_id=auth.uid() and lesson_id=v_lesson.id for update;
  if not found or not coalesce(v_answered,'{}'::text[]) @> v_required then
    raise exception 'answer every lesson question first' using errcode='22023';
  end if;
  insert into public.xp_events(user_id,points,reason,source_id)
  values(auth.uid(),50,'lesson_complete',p_lesson_slug)
  on conflict(user_id,reason,source_id) where source_id is not null do nothing
  returning points into v_awarded;
  update public.lesson_progress set mastery=100,completed_at=coalesce(completed_at,now()),
    last_studied_at=now(),step_index=greatest(step_index,v_steps_count-1)
    where user_id=auth.uid() and lesson_id=v_lesson.id;
  return coalesce(v_awarded,0);
end $$;

revoke all on function public.record_study_lesson_step(text,integer) from public,anon;
revoke all on function public.submit_study_lesson_answer(text,integer,text) from public,anon;
revoke all on function public.complete_study_lesson(text) from public,anon;
grant execute on function public.record_study_lesson_step(text,integer) to authenticated;
grant execute on function public.submit_study_lesson_answer(text,integer,text) to authenticated;
grant execute on function public.complete_study_lesson(text) to authenticated;
