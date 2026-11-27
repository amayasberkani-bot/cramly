const MODULE_IDS = {
  "Biologie cellulaire": "snv-biologie-cellulaire",
  "Chimie générale": "snv-chimie-generale",
  "Mathématiques 1": "snv-mathematiques-1",
  "Physique 1": "snv-physique-1",
  "Géologie": "snv-geologie",
  "Méthodologie": "snv-methodologie",
};
const MODULE_NAMES = Object.fromEntries(Object.entries(MODULE_IDS).map(([name, id]) => [id, name]));

function requireModuleId(moduleName) {
  const moduleId = MODULE_IDS[moduleName];
  if (!moduleId) throw new Error(`Unknown Cramly module: ${moduleName}`);
  return moduleId;
}

function mapClass(row) {
  return { id: row.id, module: MODULE_NAMES[row.module_id] || row.module_id, day: row.day_of_week, type: row.class_type, startTime: String(row.start_time).slice(0, 5), endTime: String(row.end_time).slice(0, 5), room: row.room || "" };
}

function mapExam(row) {
  return { id: row.id, module: MODULE_NAMES[row.module_id] || row.module_id, type: row.event_type, date: row.event_date, importance: row.importance };
}

export function createStudyRepository(client) {
  if (!client) return null;
  const lessonIds = new Map();

  return {
    async ensureProfile(user) {
      const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "";
      const { error } = await client.from("profiles").upsert({ id: user.id, display_name: displayName }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    },

    async loadPlanner(userId) {
      const [classes, exams] = await Promise.all([
        client.from("timetable_entries").select("id,module_id,day_of_week,class_type,start_time,end_time,room").eq("user_id", userId).order("day_of_week").order("start_time"),
        client.from("exam_events").select("id,module_id,event_type,event_date,importance").eq("user_id", userId).order("event_date"),
      ]);
      if (classes.error) throw classes.error;
      if (exams.error) throw exams.error;
      return { timetable: (classes.data || []).map(mapClass), events: (exams.data || []).map(mapExam) };
    },

    async loadStudyProgress(userId, lessonSlugs) {
      const lessons = await client.from("lessons").select("id,slug").in("slug", lessonSlugs);
      if (lessons.error) throw lessons.error;
      for (const lesson of lessons.data || []) lessonIds.set(lesson.slug, lesson.id);
      const lessonIdList = (lessons.data || []).map((lesson) => lesson.id);
      const [progressResult, xpResult, streakResult] = await Promise.all([
        lessonIdList.length
          ? client.from("lesson_progress").select("lesson_id,step_index,mastery,completed_at,answered_steps").eq("user_id", userId).in("lesson_id", lessonIdList)
          : Promise.resolve({ data: [], error: null }),
        client.from("xp_events").select("points").eq("user_id", userId),
        client.from("streaks").select("current_days,longest_days,last_active_on,freeze_tokens,active_days_since_freeze").eq("user_id", userId).maybeSingle(),
      ]);
      if (progressResult.error) throw progressResult.error;
      if (xpResult.error) throw xpResult.error;
      if (streakResult.error) throw streakResult.error;
      const slugById = new Map((lessons.data || []).map((lesson) => [lesson.id, lesson.slug]));
      const progress = Object.fromEntries((progressResult.data || []).map((row) => [slugById.get(row.lesson_id), {
        stepIndex: row.step_index, mastery: row.mastery, completed: Boolean(row.completed_at), answeredSteps: row.answered_steps || [],
      }]));
      return {
        progress,
        xp: (xpResult.data || []).reduce((total, row) => total + row.points, 0),
        streakState: streakResult.data ? {
          currentDays: streakResult.data.current_days, longestDays: streakResult.data.longest_days,
          lastActiveOn: streakResult.data.last_active_on || "", freezeTokens: streakResult.data.freeze_tokens,
          activeDaysSinceFreeze: streakResult.data.active_days_since_freeze,
        } : { currentDays: 0, longestDays: 0, lastActiveOn: "", freezeTokens: 0, activeDaysSinceFreeze: 0 },
      };
    },

    async recordLessonStep(slug, stepIndex) {
      const { error } = await client.rpc("record_study_lesson_step", { p_lesson_slug: slug, p_step_index: stepIndex });
      if (error) throw error;
    },

    async submitLessonAnswer(slug, stepIndex, answerId) {
      const { data, error } = await client.rpc("submit_study_lesson_answer", {
        p_lesson_slug: slug, p_step_index: stepIndex, p_answer_id: answerId,
      });
      if (error) throw error;
      return Number(data || 0);
    },

    async completeLesson(slug) {
      const { data, error } = await client.rpc("complete_study_lesson", { p_lesson_slug: slug });
      if (error) throw error;
      return Number(data || 0);
    },

    async saveStreak(userId, streakState) {
      const { error } = await client.from("streaks").upsert({
        user_id: userId, current_days: streakState.currentDays || 0, longest_days: streakState.longestDays || 0,
        last_active_on: streakState.lastActiveOn || null, freeze_tokens: streakState.freezeTokens || 0,
        active_days_since_freeze: streakState.activeDaysSinceFreeze || 0,
      }, { onConflict: "user_id" });
      if (error) throw error;
    },

    async saveClass(userId, entry) {
      const { data, error } = await client.from("timetable_entries").insert({
        user_id: userId, module_id: requireModuleId(entry.module), day_of_week: entry.day,
        class_type: entry.type, start_time: entry.startTime, end_time: entry.endTime, room: entry.room || null,
      }).select("id,module_id,day_of_week,class_type,start_time,end_time,room").single();
      if (error) throw error;
      return mapClass(data);
    },

    async deleteClass(userId, id) {
      const { error } = await client.from("timetable_entries").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },

    async saveExam(userId, event) {
      const { data, error } = await client.from("exam_events").insert({
        user_id: userId, module_id: requireModuleId(event.module), event_type: event.type,
        event_date: event.date, importance: event.importance || "normal",
      }).select("id,module_id,event_type,event_date,importance").single();
      if (error) throw error;
      return mapExam(data);
    },

    async deleteExam(userId, id) {
      const { error } = await client.from("exam_events").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },
  };
}

export const studyRepositoryMappings = { modules: MODULE_IDS, moduleId: requireModuleId, mapClass, mapExam };
