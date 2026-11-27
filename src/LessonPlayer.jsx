import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, CircleHelp, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { Zuzu } from "./brand/Zuzu.jsx";
import { assertValidLesson } from "./lessons/schema.js";
import "./lesson-player.css";

function Drawing({ step, locale, title }) {
  return <figure className="lesson-drawing" aria-label={locale === "ar" ? step.caption.ar : step.caption.fr}>
    <svg viewBox="0 0 400 220" role="img" aria-label={locale === "ar" ? step.caption.ar : step.caption.fr}>
      {step.shapes.map((shape, index) => {
        const common = { key: `${shape.type}-${index}`, fill: shape.type === "circle" || shape.type === "ellipse" || shape.type === "rect" ? shape.color : "none", stroke: shape.color, strokeWidth: 3, vectorEffect: "non-scaling-stroke" };
        if (shape.type === "circle") return <circle {...common} cx={shape.cx} cy={shape.cy} r={shape.r}/>;
        if (shape.type === "ellipse") return <ellipse {...common} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry}/>;
        if (shape.type === "rect") return <rect {...common} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx || 0}/>;
        return <line {...common} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2}/>;
      })}
    </svg>
    <figcaption>{locale === "ar" ? step.caption.ar : step.caption.fr}</figcaption>
    <span className="sr-only">{title}</span>
  </figure>;
}

export default function LessonPlayer({ lesson, locale = "ar", streak = 0, initialStep = 0, onProgress, onCorrect, onComplete, onExit }) {
  const ar = locale === "ar";
  const copy = ar ? {
    previous:"الخطوة السابقة", next:"الخطوة التالية", play:"متابعة الشرح", pause:"إيقاف مؤقت", replay:"أعد الخطوة", ask:"سؤال سريع", answer:"اختاري إجابة", wrong:"قريب! أعيدي قراءة الفكرة ثم حاولي مجدداً.", explain:"ما فهمتش", simpler:"تبسيط توضيحي من محتوى الدرس", speed:"سرعة الشرح", finish:"إنهاء الدرس", close:"العودة للمساحة", invalid:"تعذر عرض الدرس: محتوى الخطوات غير صالح.", complete:"أنهيتِ الدرس! +50 XP"
  } : {
    previous:"Étape précédente", next:"Étape suivante", play:"Reprendre la leçon", pause:"Mettre en pause", replay:"Rejouer l’étape", ask:"Question rapide", answer:"Choisis une réponse", wrong:"Presque ! Relis l’idée puis réessaie.", explain:"Je n’ai pas compris", simpler:"Explication simplifiée du contenu du cours", speed:"Vitesse", finish:"Terminer la leçon", close:"Retour à l’espace", invalid:"Impossible d’ouvrir la leçon : les étapes sont invalides.", complete:"Leçon terminée ! +50 XP"
  };
  const [stepIndex, setStepIndex] = useState(() => Math.max(0, Math.min(initialStep, (lesson?.steps?.length || 1) - 1)));
  const [choice, setChoice] = useState("");
  const [feedback, setFeedback] = useState("");
  const [simple, setSimple] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState("1");
  const validation = useMemo(() => {
    try { assertValidLesson(lesson); return ""; }
    catch { return copy.invalid; }
  }, [lesson, copy.invalid]);
  const step = lesson?.steps?.[stepIndex];
  const isLast = stepIndex === (lesson?.steps?.length || 1) - 1;
  const answerReady = step?.type !== "ask" || choice === step.answerId;
  const dir = ar ? "rtl" : "ltr";

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(event.target.tagName)) return;
      if (event.key === "ArrowRight") setStepIndex((index) => Math.min(index + (ar ? -1 : 1), lesson.steps.length - 1));
      if (event.key === "ArrowLeft") setStepIndex((index) => Math.max(0, index + (ar ? 1 : -1)));
      if (event.key === " ") { event.preventDefault(); setPaused((value) => !value); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ar, lesson.steps.length]);

  const changeStep = (next) => { setStepIndex(next); onProgress?.(lesson.id, next); setChoice(""); setFeedback(""); setSimple(false); };
  const checkAnswer = (optionId) => {
    setChoice(optionId);
    if (optionId === step.answerId) {
      setFeedback(ar ? step.correctText.ar : step.correctText.fr);
      onCorrect?.(`${lesson.id}:${stepIndex}`);
    } else {
      setFeedback(ar ? step.wrongText.ar : step.wrongText.fr);
    }
  };
  const next = () => {
    if (isLast) { onComplete?.(lesson.id); onExit?.(); return; }
    changeStep(Math.min(stepIndex + 1, lesson.steps.length - 1));
  };

  if (validation) return <section className="lesson-player-error" role="alert">{validation}</section>;
  const text = (step?.[ar ? "ar" : "fr"] || "").trim();

  return <section className="lesson-player" dir={dir}>
    <header className="lesson-player-head"><button className="study-back" onClick={onExit}>{ar?<ArrowRight size={16}/>:<ArrowLeft size={16}/>}<span>{copy.close}</span></button><div><span className="study-eyebrow">{ar?lesson.moduleAr:lesson.moduleFr}</span><h1>{ar?lesson.titleAr:lesson.titleFr}</h1></div><Zuzu pose={step?.type === "celebrate" ? "celebrating" : step?.type === "ask" ? "thinking" : "writing-on-board"} streak={streak}/></header>
    <div className="lesson-progress-meta"><span>{String(stepIndex + 1).padStart(2,"0")} / {String(lesson.steps.length).padStart(2,"0")}</span><div className="lesson-progress-track"><i style={{width:`${((stepIndex+1)/lesson.steps.length)*100}%`}}/></div><label>{copy.speed}<select aria-label={copy.speed} value={speed} onChange={(e)=>setSpeed(e.target.value)}><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.5">1.5×</option></select></label></div>
    <div className="lesson-board-layout"><article className={`lesson-board ${paused?"paused":""}`} style={{"--lesson-speed":`${1.1/Number(speed)}s`}}>
      <span className="lesson-board-label">{ar?lesson.moduleAr:lesson.moduleFr} · {stepIndex + 1} / {lesson.steps.length}</span>
      {step.type === "draw" && <div className="lesson-animate"><Drawing step={step} locale={locale} title={ar?lesson.titleAr:lesson.titleFr}/></div>}
      {step.type === "ask" && <div className="lesson-question lesson-animate"><span className="lesson-step-type"><CircleHelp size={15}/>{copy.ask}</span><h2>{ar?step.questionAr:step.questionFr}</h2><div className="lesson-option-list">{step.options.map((option)=><button key={option.id} className={`${choice===option.id?option.id===step.answerId?"is-correct":"is-wrong":""}`} onClick={()=>checkAnswer(option.id)} disabled={choice===step.answerId}><span>{ar?option.ar:option.fr}</span>{choice===option.id&&option.id===step.answerId&&<Check size={17}/>}</button>)}</div>{feedback&&<p className={`lesson-feedback ${choice===step.answerId?"correct":"wrong"}`} role="status">{feedback}</p>}</div>}
      {step.type !== "ask" && <div className={`lesson-board-text lesson-animate ${step.type}`}>
        {step.type === "pause"&&<span className="lesson-step-type"><Pause size={14}/>{ar?"خذي لحظة":"Prends un instant"}</span>}
        {step.type === "highlight"&&<span className="lesson-step-type"><Sparkles size={14}/>{ar?"الفكرة الأساسية":"L’essentiel"}</span>}
        {step.type === "celebrate"&&<span className="lesson-step-type"><Sparkles size={14}/>{ar?"أحسنتِ":"Bravo"}</span>}
        {text&&<p>{text}</p>}
      </div>}
      {simple&&<div className="lesson-simpler lesson-animate" role="status"><b>{copy.simpler}</b><p>{ar?"خذي الفكرة جزءاً جزءاً، وتأكدي من معنى المصطلح الفرنسي داخل السياق.":"Reprends l’idée en petites parties et relie le terme scientifique à sa définition dans le cours."}</p></div>}
      <div className="lesson-board-controls"><button className="study-icon-button" onClick={()=>changeStep(Math.max(0,stepIndex-1))} disabled={stepIndex===0} aria-label={copy.previous}>{ar?<ArrowRight size={16}/>:<ArrowLeft size={16}/>}</button><button className="study-icon-button" onClick={()=>{setChoice("");setFeedback("");setSimple(false)}} aria-label={copy.replay}><RotateCcw size={15}/></button><button className="study-icon-button" onClick={()=>setPaused((value)=>!value)} aria-label={paused?copy.play:copy.pause}>{paused?<Play size={16}/>:<Pause size={16}/>}</button><button className="lesson-simple-button" onClick={()=>setSimple((value)=>!value)}>{copy.explain}</button><button className="study-primary" onClick={next} disabled={!answerReady}>{isLast?copy.finish:copy.next}{ar?<ArrowLeft size={15}/>:<ArrowRight size={15}/>}</button></div>
    </article><aside className="lesson-zuzu-aside"><Zuzu pose={step?.type === "ask" ? "thinking" : step?.type === "celebrate" ? "celebrating" : "writing-on-board"} streak={streak}/><p>{step?.type === "ask" ? copy.answer : ar?"خذي وقتك، خطوة بخطوة!":"À ton rythme, une étape à la fois."}</p></aside></div>
  </section>;
}
