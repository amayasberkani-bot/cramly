import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays, Check, ChevronLeft,
  CircleHelp, Flame, GraduationCap, Home, Layers3, ListChecks, LogOut,
  MessageCircle, Play, Plus, Search, Settings2, Sparkles, Trophy, UserRound, X,
} from "lucide-react";
import { Zuzu } from "./brand/Zuzu.jsx";
import { planReminders, plannerDate } from "./lib/planner.js";
import { supabase } from "./lib/supabase.js";
import { createStudyRepository } from "./lib/study-repository.js";
import { awardStudyXp, getStudyLevel, recordStudyDay } from "./lib/gamification.js";
import LessonPlayer from "./LessonPlayer.jsx";
import biologyLesson from "./lessons/biologie-cellulaire.json";
import derivativeLesson from "./lessons/mathematiques-derivee.json";
import "./study-workspace.css";
import "./planner.css";

const text = {
  ar: {
    home:"الرئيسية", planner:"التخطيط", modules:"المقاييس", lessons:"دروسي", review:"المراجعة", tutor:"زوزو IA", community:"المجتمع", league:"الدوري", profile:"ملفي", demo:"وضع العرض — بيانات توضيحية محفوظة في هذا المتصفح.", hello:"أهلاً بك 👋", today:"كل خطوة صغيرة تقربك من الفهم.", streak:"سلسلة الأيام", goal:"هدف اليوم", xp:"نقاط الخبرة", continue:"واصلي من هنا", course:"La cellule et ses organites", biology:"Biologie cellulaire", minutes:"12 دقيقة", start:"تابعي الدرس", daily:"مراجعة سريعة", dailySub:"3 بطاقات تنتظرك اليوم", open:"ابدئي المراجعة", plan:"حصصك المقترحة", noClass:"لديك وقت مناسب للمراجعة", leagueTitle:"دوري جامعتك", rank:"المرتبة 8 هذا الأسبوع", modulesTitle:"مقاييس الفصل الأول", progress:"إتقانك", allLessons:"الدروس", upload:"استيراد درس", search:"ابحثي عن درس أو مقياس…", lessonTitle:"من «ما فهمتش» إلى «فهمتها»", intro:"تعلّمي على السبورة خطوة بخطوة. اختاري إجابة للسؤال لتحصلي على نقاط الخبرة.", next:"الخطوة التالية", question:"أي عضية تنتج معظم الطاقة داخل الخلية؟", answer1:"Mitochondrie", answer2:"Ribosome", answer3:"Appareil de Golgi", correct:"إجابة صحيحة! أحسنتِ، +10 XP", tryAgain:"اختاري إجابة لمتابعة الدرس.", finish:"إنهاء الدرس", done:"أكملتِ الدرس! +50 XP", plannerTitle:"تخطيط أسبوعك", week:"هذا الأسبوع", add:"إضافة حصة", exam:"الامتحانات القادمة", lessonsTitle:"دروسي وملخصاتي", empty:"ستظهر دروسك التي تحفظينها أو تستوردينها هنا.", flash:"بطاقات اليوم", due:"مستحقة للمراجعة", know:"أعرفها", repeat:"سأعيدها", tutorTitle:"اسألي زوزو عن الدرس", tutorSub:"اختاري درساً لعرض إجابة توضيحية مستندة إلى محتواه.", grounded:"إجابة توضيحية · من درس Biologie cellulaire", communityTitle:"ملخصات الطلبة", save:"حفظ", saved:"تم الحفظ", leagueHeading:"دوري الجامعات", leagueSub:"مجموعة توضيحية لهذا الأسبوع", profileTitle:"ملفي الدراسي", university:"الجامعة", filiere:"الشعبة", settings:"الإعدادات", logout:"خروج", weekday:["السبت","الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة"], moduleNames:["Biologie cellulaire","Chimie générale","Mathématiques 1","Physique 1","Géologie","Méthodologie"], answer:"الإجابة", ask:"اكتبي سؤالاً عن درسك…", send:"إرسال", nav:"القائمة", title:"Cramly"
  },
  fr: {
    home:"Accueil", planner:"Planning", modules:"Modules", lessons:"Mes leçons", review:"Révision", tutor:"Zuzu IA", community:"Communauté", league:"Ligue", profile:"Profil", demo:"Mode démo — données illustratives enregistrées dans ce navigateur.", hello:"Bienvenue 👋", today:"Chaque petit pas te rapproche de la compréhension.", streak:"Série", goal:"Objectif du jour", xp:"XP", continue:"Reprendre ici", course:"La cellule et ses organites", biology:"Biologie cellulaire", minutes:"12 min", start:"Continuer la leçon", daily:"Révision rapide", dailySub:"3 cartes t'attendent", open:"Réviser", plan:"Séances suggérées", noClass:"Un bon créneau pour réviser", leagueTitle:"Ligue de ton université", rank:"8e cette semaine", modulesTitle:"Modules du semestre 1", progress:"Maîtrise", allLessons:"Leçons", upload:"Importer un cours", search:"Rechercher un cours ou module…", lessonTitle:"De « j'ai rien compris » à « j'ai compris »", intro:"Apprends au tableau, étape par étape. Choisis une réponse pour gagner de l'XP.", next:"Étape suivante", question:"Quel organite produit la majeure partie de l'énergie cellulaire ?", answer1:"Mitochondrie", answer2:"Ribosome", answer3:"Appareil de Golgi", correct:"Bonne réponse ! Bravo, +10 XP", tryAgain:"Choisis une réponse pour continuer.", finish:"Terminer la leçon", done:"Leçon terminée ! +50 XP", plannerTitle:"Organise ta semaine", week:"Cette semaine", add:"Ajouter un cours", exam:"Prochains examens", lessonsTitle:"Mes leçons et résumés", empty:"Tes leçons enregistrées ou importées apparaîtront ici.", flash:"Cartes du jour", due:"À réviser", know:"Je sais", repeat:"À revoir", tutorTitle:"Pose une question à Zuzu", tutorSub:"Choisis une leçon pour voir un exemple de réponse basée sur son contenu.", grounded:"Réponse illustrative · cours Biologie cellulaire", communityTitle:"Résumés étudiants", save:"Enregistrer", saved:"Enregistré", leagueHeading:"Ligue des universités", leagueSub:"Groupe illustratif de la semaine", profileTitle:"Mon profil étudiant", university:"Université", filiere:"Filière", settings:"Paramètres", logout:"Quitter", weekday:["Sam.","Dim.","Lun.","Mar.","Mer.","Jeu.","Ven."], moduleNames:["Biologie cellulaire","Chimie générale","Mathématiques 1","Physique 1","Géologie","Méthodologie"], answer:"Réponse", ask:"Pose une question sur ton cours…", send:"Envoyer", nav:"Navigation", title:"Cramly"
  }
};

const seed = {
  xp: 240, streak: 4, done: false, answer: "", cardsDone: 0, saved: [], completedLessons: [], answeredSteps: [], xpEvents: [], lessonProgress: {},
  streakState: { currentDays: 4, lastActiveOn: plannerDate.dayKey(plannerDate.addDays(new Date(), -1)), freezeTokens: 1, activeDaysSinceFreeze: 1 },
  timetable: [
    { id: "sample-class-1", module: "Biologie cellulaire", day: 2, startTime: "09:00", endTime: "10:30", type: "Cours" },
    { id: "sample-class-2", module: "Chimie générale", day: 4, startTime: "10:00", endTime: "11:30", type: "TD" },
  ],
  events: [{ id: "sample-exam", module: "Biologie cellulaire", type: "Examen", date: plannerDate.dayKey(plannerDate.addDays(new Date(), 18)), importance: "high" }],
  progress: [{ module: "Chimie générale", mastery: 48, dueCount: 3 }, { module: "Mathématiques 1", mastery: 35, dueCount: 0 }],
  plannerProfile: { locale: "ar", preferredEveningTime: "19:00", preferredReviewTimes: ["17:30", "13:00"], quietHours: { start: "22:30", end: "07:00" }, maxNudgesPerDay: 2, streak: 4 },
};
const modulesMeta = [
  { icon:"🧬", color:"sage", mastery:72 }, { icon:"⚗️", color:"orange", mastery:48 },
  { icon:"∫", color:"violet", mastery:35 }, { icon:"⚛️", color:"blue", mastery:61 },
  { icon:"🌋", color:"lime", mastery:29 }, { icon:"✍️", color:"gold", mastery:83 },
];

export default function StudyWorkspace({ locale = "ar", onSignOut, user = null }) {
  const ar = locale === "ar";
  const c = text[ar ? "ar" : "fr"];
  const [page, setPage] = useState("home");
  const [lessonId, setLessonId] = useState(biologyLesson.id);
  const [state, setState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cramly-demo-progress") || "{}");
      return { ...seed, ...saved, completedLessons: saved.completedLessons || (saved.done ? [biologyLesson.id] : []), answeredSteps: saved.answeredSteps || [], xpEvents: saved.xpEvents || [], lessonProgress: saved.lessonProgress || {} };
    }
    catch { return seed; }
  });
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [plannerModal, setPlannerModal] = useState("");
  const [plannerBusy, setPlannerBusy] = useState(false);
  const [plannerFeedback, setPlannerFeedback] = useState("");
  const [plannerLoading, setPlannerLoading] = useState(Boolean(user?.id));
  const studyRepository = useMemo(() => createStudyRepository(supabase), []);
  const authenticatedSessionId = useRef(user?.id || "");
  const pc = ar ? {
    addClass:"إضافة حصة", addExam:"إضافة امتحان", classTitle:"حصة أسبوعية", examTitle:"موعد امتحان", module:"المقياس", day:"اليوم", type:"النوع", start:"من", end:"إلى", room:"القاعة (اختياري)", date:"التاريخ", importance:"الأهمية", save:"حفظ", cancel:"إلغاء", classTypes:["Cours","TD","TP"], eventTypes:["Devoir / Contrôle","Examen","TP évalué","Rattrapage"], reminders:"تذكيرات مقترحة", noReminders:"لا توجد تذكيرات حالياً. أضيفي حصصك أو موعد امتحان لتخصيص اقتراحاتك.", review:"جلسة مراجعة", remove:"حذف", noEvents:"لا توجد امتحانات قادمة.", weekHint:"الأسبوع من السبت إلى الجمعة · بيانات تجريبية محفوظة على هذا الجهاز", today:"اليوم"
  } : {
    addClass:"Ajouter un cours", addExam:"Ajouter un examen", classTitle:"Cours hebdomadaire", examTitle:"Échéance d’examen", module:"Module", day:"Jour", type:"Type", start:"Début", end:"Fin", room:"Salle (facultatif)", date:"Date", importance:"Importance", save:"Enregistrer", cancel:"Annuler", classTypes:["Cours","TD","TP"], eventTypes:["Devoir / Contrôle","Examen","TP évalué","Rattrapage"], reminders:"Rappels suggérés", noReminders:"Aucun rappel pour le moment. Ajoute tes cours ou examens pour personnaliser les suggestions.", review:"Séance de révision", remove:"Supprimer", noEvents:"Aucun examen à venir.", weekHint:"Semaine du samedi au vendredi · données démo enregistrées sur cet appareil", today:"Aujourd’hui"
  };
  useEffect(() => {
    if (user?.id) { authenticatedSessionId.current = user.id; return; }
    if (authenticatedSessionId.current) {
      localStorage.removeItem("cramly-demo-progress");
      authenticatedSessionId.current = "";
      return;
    }
    localStorage.setItem("cramly-demo-progress", JSON.stringify(state));
  }, [state, user?.id]);
  useEffect(() => {
    if (!user?.id || !studyRepository) { setPlannerLoading(false); return undefined; }
    let active = true;
    setPlannerLoading(true);
    setState((current) => ({ ...current, xp: 0, streak: 0, done: false, answer: "", cardsDone: 0, saved: [], completedLessons: [], answeredSteps: [], xpEvents: [], lessonProgress: {}, streakState: { currentDays: 0, lastActiveOn: "", freezeTokens: 0, activeDaysSinceFreeze: 0 }, timetable: [], events: [], progress: [], plannerProfile: { ...seed.plannerProfile, streak: 0 } }));
    (async () => {
      try {
        await studyRepository.ensureProfile(user);
        const [planner, study] = await Promise.all([
          studyRepository.loadPlanner(user.id),
          studyRepository.loadStudyProgress(user.id, [biologyLesson.id, derivativeLesson.id]),
        ]);
        if (active) setState((current) => ({
          ...current, timetable: planner.timetable, events: planner.events, xp: study.xp,
          lessonProgress: study.progress, completedLessons: Object.entries(study.progress).filter(([, value]) => value.completed).map(([slug]) => slug),
          answeredSteps: Object.values(study.progress).flatMap((value) => value.answeredSteps),
          streakState: study.streakState, streak: study.streakState.currentDays,
          plannerProfile: { ...current.plannerProfile, streak: study.streakState.currentDays },
        }));
      } catch (error) {
        console.error("Cramly planner could not load", error);
        if (active) setPlannerFeedback(ar ? "تعذر تحميل جدولك. تحققي من اتصالك ثم أعيدي فتح التخطيط." : "Impossible de charger ton planning. Vérifie la connexion puis rouvre Planning.");
      } finally {
        if (active) setPlannerLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const nav = [
    ["home",Home,c.home], ["planner",CalendarDays,c.planner], ["modules",Layers3,c.modules],
    ["lessons",BookOpen,c.lessons], ["review",ListChecks,c.review], ["tutor",MessageCircle,c.tutor],
    ["community",GraduationCap,c.community], ["league",Trophy,c.league], ["profile",UserRound,c.profile],
  ];
  const awardLessonAnswer = async (stepKey, answerId) => {
    const answered = state.answeredSteps || [];
    if (answered.includes(stepKey)) return;
    if (user?.id && studyRepository) {
      const [slug, step] = stepKey.split(":");
      await studyRepository.submitLessonAnswer(slug, Number(step), answerId);
    }
    setState((current) => {
      const currentAnswered = current.answeredSteps || [];
      if (currentAnswered.includes(stepKey)) return current;
      return awardStudyXp({ ...current, answeredSteps: [...currentAnswered, stepKey] }, "correct_answer", stepKey);
    });
  };
  const saveLessonStep = (id, stepIndex) => {
    if (!user?.id || !studyRepository) return;
    void studyRepository.recordLessonStep(id, stepIndex).catch((error) => console.error("Cramly lesson progress could not save", error));
  };
  const completeStudyLesson = async (id) => {
    if ((state.completedLessons || []).includes(id)) return;
    if (user?.id && studyRepository) await studyRepository.completeLesson(id);
    const streakState = recordStudyDay(state.streakState || {}, new Date(), { lessonCompleted: true });
    if (user?.id && studyRepository) await studyRepository.saveStreak(user.id, streakState);
    setState((current) => {
      const completed = current.completedLessons || [];
      if (completed.includes(id)) return current;
      const nextCompleted = [...completed, id];
      let next = awardStudyXp({ ...current, done: nextCompleted.includes(biologyLesson.id), completedLessons: nextCompleted }, "lesson_complete", id);
      next = { ...next, streakState, streak: streakState.currentDays };
      if (streakState.currentDays > 0 && streakState.currentDays % 7 === 0 && !user?.id) next = awardStudyXp(next, "streak_7_days", String(streakState.currentDays));
      return next;
    });
  };
  const weekStart = plannerDate.addDays(new Date(), -plannerDate.dayIndex(new Date()));
  const reminderSuggestions = planReminders({ ...state.plannerProfile, locale: ar ? "ar" : "fr", streak: state.streak }, state.timetable || [], state.events || [], state.progress || [], new Date());
  const level = getStudyLevel(state.xp, ar ? "ar" : "fr");
  const savePlannerItem = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const id = `planner-${Date.now()}`;
    if (plannerModal === "class" && values.endTime <= values.startTime) {
      const endInput = event.currentTarget.elements.endTime;
      endInput.setCustomValidity(ar ? "يجب أن يكون وقت النهاية بعد وقت البداية." : "L’heure de fin doit être après l’heure de début.");
      endInput.reportValidity();
      endInput.addEventListener("input", () => endInput.setCustomValidity(""), { once: true });
      return;
    }
    setPlannerBusy(true);
    setPlannerFeedback("");
    if (plannerModal === "class") {
      const entry = { id, module: values.module, day: Number(values.day), startTime: values.startTime, endTime: values.endTime, type: values.type, room: values.room };
      try {
        const saved = user?.id && studyRepository ? await studyRepository.saveClass(user.id, entry) : entry;
        setState((current) => ({ ...current, timetable: [...(current.timetable || []), saved] }));
      } catch (error) {
        console.error("Cramly class could not save", error);
        setPlannerFeedback(ar ? "لم تُحفظ الحصة. تحققي من المقياس والاتصال." : "Le cours n’a pas été enregistré. Vérifie le module et la connexion.");
        setPlannerBusy(false);
        return;
      }
    } else {
      const exam = { id, module: values.module, date: values.date, type: values.type, importance: values.importance };
      try {
        const saved = user?.id && studyRepository ? await studyRepository.saveExam(user.id, exam) : exam;
        setState((current) => ({ ...current, events: [...(current.events || []), saved] }));
      } catch (error) {
        console.error("Cramly exam could not save", error);
        setPlannerFeedback(ar ? "لم يُحفظ موعد الامتحان. تحققي من المقياس والاتصال." : "L’examen n’a pas été enregistré. Vérifie le module et la connexion.");
        setPlannerBusy(false);
        return;
      }
    }
    setPlannerBusy(false);
    setPlannerModal("");
  };
  const removePlannerItem = async (kind, id) => {
    if (user?.id && studyRepository) {
      try {
        await (kind === "class" ? studyRepository.deleteClass(user.id, id) : studyRepository.deleteExam(user.id, id));
      } catch (error) {
        console.error("Cramly planner item could not delete", error);
        setPlannerFeedback(ar ? "تعذر حذف العنصر. حاولي مجدداً." : "Impossible de supprimer cet élément. Réessaie.");
        return;
      }
    }
    setState((current) => kind === "class"
      ? { ...current, timetable: current.timetable.filter((item) => item.id !== id) }
      : { ...current, events: current.events.filter((item) => item.id !== id) });
  };

  const view = () => {
    if (page === "home") return <>
      <header className="study-welcome"><div><span className="study-kicker">{c.today}</span><h1>{c.hello}</h1></div><Zuzu pose="celebrating" streak={state.streak} className="study-welcome-zuzu"/></header>
      <section className="study-stats"><article className="study-streak"><Flame/><span><b>{state.streak} {c.streak}</b><small>{ar ? "أيام متتالية" : "jours d'affilée"}</small></span></article><article><span className="study-ring">10</span><span><b>{c.goal}</b><small>{ar ? "من 15 دقيقة" : "sur 15 min"}</small></span></article><article><span className="study-xp">✦</span><span><b>{state.xp} {c.xp}</b><small>{ar ? `المستوى ${level.number} · ${level.name}` : `Niveau ${level.number} · ${level.name}`}</small></span></article></section>
      <section className="study-home-grid"><article className="study-card study-continue"><div className="study-card-head"><span className="study-eyebrow">{c.continue}</span><span className="study-course-icon">🧬</span></div><small>{c.biology}</small><h2>{c.course}</h2><div className="study-progress"><i style={{width:(state.completedLessons||[]).includes(biologyLesson.id)?"100%":"36%"}}/></div><div className="study-continue-foot"><span>{(state.completedLessons||[]).includes(biologyLesson.id) ? c.done : c.minutes}</span><button className="study-primary" onClick={()=>{setLessonId(biologyLesson.id);setPage("lesson")}}>{(state.completedLessons||[]).includes(biologyLesson.id) ? c.open : c.start}<ArrowLeft size={16}/></button></div></article>
        <article className="study-card study-daily"><div className="study-card-head"><span className="study-eyebrow">{c.daily}</span><ListChecks/></div><h2>{c.dailySub}</h2><p>{ar?"مراجعة بسيطة تساعدك على تثبيت ما تعلمتِه.":"Une petite révision pour ancrer tes acquis."}</p><button className="study-secondary" onClick={()=>setPage("review")}>{c.open}<ArrowLeft size={15}/></button></article></section>
      <section className="study-lower-grid"><article className="study-card"><div className="study-section-title"><div><span className="study-eyebrow">{c.plan}</span><h2>{c.noClass}</h2></div><button className="study-icon-button" onClick={()=>setPage("planner")} aria-label={c.planner}><CalendarDays size={18}/></button></div><div className="study-session"><span className="study-session-time">17:30</span><span className="study-session-icon">⚗️</span><span><b>{c.moduleNames[1]}</b><small>{ar?"مراجعة قصيرة · 10 دقائق":"Révision courte · 10 min"}</small></span><ChevronLeft size={16}/></div></article>
        <article className="study-card study-mini-league"><div className="study-section-title"><div><span className="study-eyebrow">{c.leagueTitle}</span><h2>{c.rank}</h2></div><Trophy size={20}/></div><div className="study-league-dots"><span>🥇</span><span>🧑🏻‍🎓</span><span>🧑🏽‍🎓</span><span>🧑🏼‍🎓</span><button onClick={()=>setPage("league")}><ArrowLeft size={16}/></button></div></article></section>
    </>;
    if (page === "modules") return <><header className="study-page-head"><div><span className="study-eyebrow">{c.modulesTitle}</span><h1>{c.modules}</h1></div><button className="study-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={c.search}/></button></header><div className="study-module-grid">{c.moduleNames.map((name,i)=>name.toLowerCase().includes(query.toLowerCase())&&<button className="study-module-card" key={name} onClick={()=>setPage("lessons")}><span className={`study-module-icon ${modulesMeta[i].color}`}>{modulesMeta[i].icon}</span><span><b>{name}</b><small>{i<2?"Semestre 1 · SNV":"Semestre 1 · Tronc commun"}</small></span><span className="study-mastery">{modulesMeta[i].mastery}%<small>{c.progress}</small></span><div className="study-progress"><i style={{width:`${modulesMeta[i].mastery}%`}}/></div><small>{c.allLessons} · {i === 0 ? 8 : 5}</small></button>)}</div></>;
    if (page === "lesson") return <LessonPlayer lesson={lessonId===derivativeLesson.id?derivativeLesson:biologyLesson} locale={locale} streak={state.streak} initialStep={user?.id?state.lessonProgress?.[lessonId]?.stepIndex||0:0} onProgress={saveLessonStep} onCorrect={awardLessonAnswer} onComplete={completeStudyLesson} onExit={()=>setPage("home")}/>;
    if (page === "planner") return <>
      <header className="study-page-head"><div><span className="study-eyebrow">{pc.weekHint}</span><h1>{c.plannerTitle}</h1></div><div className="planner-actions"><button className="study-secondary" onClick={()=>setPlannerModal("exam")}><Plus size={15}/>{pc.addExam}</button><button className="study-primary" onClick={()=>setPlannerModal("class")}><Plus size={16}/>{pc.addClass}</button></div></header>
      {plannerFeedback&&<p className="planner-feedback" role="status">{plannerFeedback}</p>}{plannerLoading&&<p className="planner-empty" role="status">{ar?"جارٍ تحميل التخطيط…":"Chargement du planning…"}</p>}
      <div className="study-week-grid">{c.weekday.map((day,i)=>{const date=plannerDate.addDays(weekStart,i);const entries=(state.timetable||[]).filter((item)=>item.day===i);return <article className={`study-day ${i===plannerDate.dayIndex(new Date())?"today":""}`} key={day}><b>{day}</b><small>{date.getDate()}{i===plannerDate.dayIndex(new Date())?` · ${pc.today}`:""}</small>{entries.map((entry)=><div className="study-class" key={entry.id}><span>{entry.startTime}–{entry.endTime}</span><b>{entry.module}</b><small>{entry.type}{entry.room?` · ${entry.room}`:""}</small><button aria-label={`${pc.remove} ${entry.module}`} onClick={()=>void removePlannerItem("class",entry.id)}><X size={12}/></button></div>)}</article>})}</div>
      <div className="planner-bottom-grid"><article className="study-card planner-events"><div className="study-section-title"><div><span className="study-eyebrow">{c.exam}</span><h2>{pc.examTitle}</h2></div><button className="study-icon-button" onClick={()=>setPlannerModal("exam")} aria-label={pc.addExam}><Plus size={17}/></button></div>{(state.events||[]).filter((item)=>item.date>=plannerDate.dayKey(new Date())).sort((a,b)=>a.date.localeCompare(b.date)).length? (state.events||[]).filter((item)=>item.date>=plannerDate.dayKey(new Date())).sort((a,b)=>a.date.localeCompare(b.date)).map((item)=><div className="planner-event" key={item.id}><CalendarDays size={17}/><span><b>{item.module}</b><small>{item.type} · {item.date}</small></span><strong>{Math.max(0,Math.ceil((new Date(`${item.date}T00:00:00`)-new Date(new Date().setHours(0,0,0,0)))/86400000))} {ar?"يوم":"j"}</strong><button aria-label={`${pc.remove} ${item.module}`} onClick={()=>void removePlannerItem("exam",item.id)}><X size={14}/></button></div>):<p className="planner-empty">{pc.noEvents}</p>}</article>
        <article className="study-card planner-reminders"><div className="study-section-title"><div><span className="study-eyebrow">{pc.reminders}</span><h2>{c.noClass}</h2></div><Bell size={18}/></div>{reminderSuggestions.length?reminderSuggestions.slice(0,4).map((item)=><div className="planner-reminder" key={item.id}><Zuzu pose={item.pose} streak={state.streak}/><span><b>{item.message}</b><small>{item.scheduledAt.toLocaleDateString(ar?"ar-DZ":"fr-DZ",{weekday:"short",day:"numeric",month:"short"})} · {item.scheduledAt.toLocaleTimeString(ar?"ar-DZ":"fr-DZ",{hour:"2-digit",minute:"2-digit"})}</small></span></div>):<p className="planner-empty">{pc.noReminders}</p>}</article></div>
      {plannerModal&&<div className="planner-modal-backdrop" role="presentation" onClick={()=>setPlannerModal("")}><form className="planner-modal" onSubmit={savePlannerItem} onClick={(e)=>e.stopPropagation()}><div className="study-section-title"><h2>{plannerModal==="class"?pc.classTitle:pc.examTitle}</h2><button type="button" className="study-icon-button" onClick={()=>setPlannerModal("")} aria-label={pc.cancel}><X size={17}/></button></div><label>{pc.module}<select name="module" required defaultValue={c.moduleNames[0]}>{c.moduleNames.map((name)=><option key={name}>{name}</option>)}</select></label>{plannerModal==="class"?<><label>{pc.day}<select name="day" defaultValue={String(plannerDate.dayIndex(new Date()))}>{c.weekday.map((day,i)=><option value={i} key={day}>{day}</option>)}</select></label><label>{pc.type}<select name="type">{pc.classTypes.map((type)=><option key={type}>{type}</option>)}</select></label><div className="planner-form-row"><label>{pc.start}<input name="startTime" type="time" required defaultValue="09:00"/></label><label>{pc.end}<input name="endTime" type="time" required defaultValue="10:00"/></label></div><label>{pc.room}<input name="room" maxLength="30"/></label></>:<><label>{pc.type}<select name="type">{pc.eventTypes.map((type)=><option key={type}>{type}</option>)}</select></label><label>{pc.date}<input name="date" type="date" min={plannerDate.dayKey(new Date())} required defaultValue={plannerDate.dayKey(plannerDate.addDays(new Date(),7))}/></label><label>{pc.importance}<select name="importance"><option value="normal">{ar?"عادي":"Normale"}</option><option value="high">{ar?"مهم":"Importante"}</option></select></label></>}<div className="planner-modal-actions"><button type="button" className="study-secondary" onClick={()=>setPlannerModal("")}>{pc.cancel}</button><button className="study-primary" type="submit" disabled={plannerBusy}>{plannerBusy? (ar?"جارٍ الحفظ…":"Enregistrement…"):pc.save}</button></div></form></div>}
    </>;
    if (page === "lessons") return <><header className="study-page-head"><div><span className="study-eyebrow">Semestre 1 · SNV & ST</span><h1>{c.lessonsTitle}</h1></div><button className="study-primary" onClick={()=>setState(s=>({...s,imported:true}))}><Plus size={16}/>{c.upload}</button></header><div className="study-lesson-list">{[biologyLesson,derivativeLesson].map((lesson,index)=><button className="study-list-card" key={lesson.id} onClick={()=>{setLessonId(lesson.id);setPage("lesson")}}><span className="study-course-icon">{index===0?"🧬":"∫"}</span><span><b>{ar?lesson.titleAr:lesson.titleFr}</b><small>{ar?lesson.moduleAr:lesson.moduleFr} · {ar?"12 دقيقة":"12 min"}</small></span><Play size={17}/></button>)}</div><p className="study-muted">{c.empty}</p></>;
    if (page === "review") return <><header className="study-page-head"><div><span className="study-eyebrow">{c.dailySub}</span><h1>{c.flash}</h1></div><span className="study-due-badge">{Math.max(0,3-state.cardsDone)} {c.due}</span></header><div className="study-flashcard"><span className="study-course-icon">🧬</span><small>{c.biology}</small><h2>{ar?"ما دور الغشاء البلازمي؟":"Quel est le rôle de la membrane plasmique ?"}</h2><button className="study-secondary" onClick={()=>setQuery(query?"":"show")}>{query?c.answer:"Afficher la réponse"}</button>{query&&<p>{ar?"ينظم تبادل المواد بين الخلية ومحيطها.":"Elle régule les échanges entre la cellule et son milieu."}</p>}<div className="study-flash-actions"><button onClick={()=>setState(s=>({...s,cardsDone:Math.min(3,s.cardsDone+1)}))}>{c.repeat}</button><button onClick={()=>setState(s=>({...s,cardsDone:Math.min(3,s.cardsDone+1),xp:s.xp+2}))}>{c.know}</button></div></div></>;
    if (page === "tutor") return <><header className="study-page-head"><div><span className="study-eyebrow">Zuzu · {c.grounded}</span><h1>{c.tutorTitle}</h1><p>{c.tutorSub}</p></div></header><div className="study-chat"><div className="study-chat-bubble"><Zuzu pose="thinking" streak={state.streak}/><span><small>{c.grounded}</small><p>{ar?"الميتوكوندريا عضية محاطة بغشاء مزدوج، وتشارك في إنتاج الطاقة داخل الخلية. (المصدر: La cellule et ses organites — فقرة 3)":"La mitochondrie est un organite à double membrane qui participe à la production d'énergie. (Source : La cellule et ses organites — partie 3)"}</p></span></div><div className="study-chat-input"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={c.ask}/><button aria-label={c.send} onClick={()=>setQuery("")}><ArrowLeft size={17}/></button></div><div className="study-chip-row">{["Résumer","Flashcards","QCM","Expliquer simplement"].map(x=><button key={x} onClick={()=>setQuery(x)}>{x}</button>)}</div></div></>;
    if (page === "community") return <><header className="study-page-head"><div><span className="study-eyebrow">SNV · Sétif 1</span><h1>{c.communityTitle}</h1></div></header><div className="study-post-list">{["Résumé — Les organites cellulaires","Fiche méthode — La mitose","QCM — Chimie des solutions"].map((name,i)=><article className="study-post" key={name}><div className="study-post-avatar">{["م","ل","س"][i]}</div><div><small>{ar?"محتوى توضيحي · طالب(ة)":"Contenu illustratif · Étudiant(e)"} · ⭐ 4.{8-i}</small><h2>{name}</h2><p>{ar?"ملخص منظم للمراجعة، مع المفاهيم الأساسية والمصطلحات العلمية بالفرنسية.":"Une fiche structurée avec les notions clés et le vocabulaire scientifique en français."}</p><button onClick={()=>setState(s=>({...s,saved:s.saved.includes(name)?s.saved.filter(x=>x!==name):[...s.saved,name]}))}>{state.saved.includes(name)?c.saved:c.save}</button></div></article>)}</div></>;
    if (page === "league") return <><header className="study-page-head"><div><span className="study-eyebrow">{c.leagueSub}</span><h1>{c.leagueHeading}</h1></div><Trophy size={24}/></header><div className="study-league-table">{["طالبة توضيحية 01 · Sétif 1","طالب توضيحي 02 · Batna 2","طالبة توضيحية 03 · USTHB","طالب توضيحي 04 · Alger 1","طالبة توضيحية · Sétif 1"].map((name,i)=><article key={name} className={i===4?"current":""}><strong>{i+1}</strong><span>{name}</span><b>{960-i*112} XP</b></article>)}</div><p className="study-muted">{ar?"مجموعة أسبوعية توضيحية، 30 طالباً من نفس الشعبة.":"Groupe hebdomadaire illustratif de 30 étudiants de la même filière."}</p></>;
    return <><header className="study-page-head"><div><span className="study-eyebrow">Sétif 1 · SNV · Semestre 1</span><h1>{c.profileTitle}</h1></div></header><div className="study-profile-card"><Zuzu pose="wink-thumbs-up" streak={state.streak}/><div><h2>{ar ? "طالبة توضيحية" : "Étudiante démo"}</h2><p>{c.university}: Sétif 1 · {c.filiere}: SNV</p><small>{ar?`المستوى ${level.number} · ${level.name}`:`Niveau ${level.number} · ${level.name}`}</small></div></div><div className="study-profile-stats"><b>{state.xp} XP</b><b>{state.streak} {c.streak}</b><b>{(state.completedLessons||[]).length} {c.lessons}</b></div><button className="study-secondary" onClick={onSignOut}><LogOut size={16}/>{c.logout}</button></>;
  };

  return <div className="study-app" dir={ar?"rtl":"ltr"}>
    {menuOpen&&<button className="study-scrim" aria-label={c.close||"Close"} onClick={()=>setMenuOpen(false)}/>}
    <aside className={`study-sidebar ${menuOpen?"open":""}`}><div className="study-brand"><img src="/brand/zuzu-app-icon.svg" alt=""/><b>cramly</b><button className="study-close" onClick={()=>setMenuOpen(false)} aria-label="Close"><X size={17}/></button></div><div className="study-student-chip"><span>ي</span><div><b>{ar?"السنة الأولى":"L1 · Université"}</b><small>SNV · Sétif 1</small></div></div><div className="study-nav-label">{c.nav}</div><nav>{nav.map(([id,Icon,label])=><button key={id} className={page===id||page==="lesson"&&id==="home"?"active":""} onClick={()=>{setPage(id);setMenuOpen(false)}}><Icon size={17}/><span>{label}</span>{id==="review"&&state.cardsDone<3&&<em>{3-state.cardsDone}</em>}</button>)}</nav><div className="study-sidebar-bottom"><button><Settings2 size={16}/>{c.settings}</button><button onClick={onSignOut}><LogOut size={16}/>{c.logout}</button></div></aside>
    <main className="study-main"><header className="study-topbar"><button className="study-menu-button" onClick={()=>setMenuOpen(true)} aria-label={c.nav}><ListChecks size={19}/></button><div className="study-crumb"><span>Cramly</span><ChevronLeft size={13}/><b>{page==="lesson"?c.course:(nav.find(x=>x[0]===page)?.[2]||c.home)}</b></div><label className="study-top-search"><Search size={15}/><input placeholder={c.search}/></label><button className="study-top-icon" aria-label="Notifications"><Bell size={17}/></button><button className="study-lang" onClick={()=>{const next=ar?"fr":"ar";localStorage.setItem("cramly-locale",next);window.location.reload()}}>{ar?"FR":"ع"}</button><span className="study-avatar">ي</span></header><div className="study-demo-banner"><Sparkles size={14}/><span>{user?.id ? (ar?"الحساب متصل · التخطيط محفوظ في حسابك، وبقية المحتوى المعروض توضيحي.":"Compte connecté · le planning est enregistré dans ton compte, le reste est illustratif.") : c.demo}</span></div><section className="study-content">{view()}</section></main>
  </div>;
}



