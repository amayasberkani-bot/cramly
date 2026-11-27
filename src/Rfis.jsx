import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Check, CircleHelp, Clock3, FileQuestion, LoaderCircle, MessageSquareText, Plus, Send, X } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import "./rfis.css";

const labels = {
  ar: {
    title: "طلبات التوضيح", subtitle: "تابع الأسئلة الفنية والردود والمواعيد المرتبطة بمشاريعك.", create: "طلب توضيح جديد", ref: "المرجع", subject: "الموضوع", question: "السؤال الفني", area: "المخطط أو منطقة العمل", project: "المشروع", assigned: "المسؤول عن الرد", due: "موعد الرد", unassigned: "غير معيّن", save: "إنشاء الطلب", cancel: "إلغاء", loading: "جارٍ تحميل الطلبات…", loadError: "تعذر تحميل طلبات التوضيح. تحقق من الاتصال والصلاحية.", saveError: "تعذر حفظ التغيير. تحقق من الصلاحية وحاول مجدداً.", duplicate: "هذا المرجع مستخدم في المشروع. اختر مرجعاً آخر.", noProjects: "أنشئ مشروعاً أولاً قبل إضافة طلب توضيح.", noItems: "لا توجد طلبات توضيح بعد.", noMatches: "لا توجد طلبات تطابق هذا المرشح.", start: "إنشاء أول طلب", all: "الكل", open: "بانتظار الرد", answered: "تم الرد", closed: "مغلق", cancelled: "ملغي", overdue: "متأخر", details: "تفاصيل الطلب", thread: "سجل المراسلات", originalQuestion: "السؤال", sentBy: "أُرسل بواسطة", response: "اكتب الرد الفني", sendResponse: "إرسال الرد", clarification: "اكتب ما يحتاج إلى توضيح", requestClarification: "طلب توضيح إضافي", closeRfi: "إغلاق الطلب", cancelRfi: "إلغاء الطلب", created: "أُنشئ الطلب", answerEvent: "تم إرسال رد", clarificationEvent: "طُلب توضيح إضافي", closedEvent: "أُغلق الطلب", cancelledEvent: "أُلغي الطلب", assignmentEvent: "تغيّر المسؤول", questionType: "سؤال", answerType: "رد", clarificationType: "طلب توضيح", commentType: "ملاحظة", requesterOnly: "الإغلاق أو طلب التوضيح متاح لمنشئ الطلب أو مالك مساحة العمل.", responseOnly: "الرد متاح للمسؤول المعيّن أو مالك مساحة العمل.", emptyThread: "سيظهر الرد والمراسلات هنا مع حفظ سجلها.", overdueBy: "متأخر عن الموعد", dueLabel: "الموعد", mentionDemo: "المعاينة تحفظ هذه الطلبات في هذا المتصفح فقط.", noWorkspace: "تحتاج طلبات التوضيح إلى مساحة عمل مرتبطة بقاعدة البيانات.", createHint: "عيّن عضواً من مساحة العمل وحدد موعد الرد.", emptyMembers: "لا يوجد أعضاء آخرون لتعيينهم.", status: "الحالة", timeline: "سجل الحالات", today: "اليوم", replySent: "تم حفظ الرد.", clarificationSent: "تم تسجيل طلب التوضيح.", closedSuccess: "تم إغلاق الطلب.", cancelledSuccess: "تم إلغاء الطلب.", questionRequired: "أضف موضوعاً وسؤالاً واضحاً.", dueDate: "تاريخ الاستحقاق",
  },
  fr: {
    title: "Demandes d’information", subtitle: "Suivez les questions techniques, les réponses et leurs échéances par projet.", create: "Nouvelle demande", ref: "Référence", subject: "Objet", question: "Question technique", area: "Plan ou zone de travail", project: "Projet", assigned: "Responsable de la réponse", due: "Échéance de réponse", unassigned: "Non attribué", save: "Créer la demande", cancel: "Annuler", loading: "Chargement des demandes…", loadError: "Impossible de charger les demandes. Vérifiez la connexion et les droits.", saveError: "Impossible d’enregistrer. Vérifiez les droits et réessayez.", duplicate: "Cette référence existe déjà dans le projet.", noProjects: "Créez un projet avant d’ajouter une demande.", noItems: "Aucune demande pour le moment.", noMatches: "Aucune demande pour ce filtre.", start: "Créer la première demande", all: "Tout", open: "En attente", answered: "Répondu", closed: "Clôturé", cancelled: "Annulé", overdue: "En retard", details: "Détails", thread: "Échanges", originalQuestion: "Question", sentBy: "Envoyé par", response: "Rédiger une réponse technique", sendResponse: "Envoyer la réponse", clarification: "Indiquer la précision nécessaire", requestClarification: "Demander une précision", closeRfi: "Clôturer la demande", cancelRfi: "Annuler la demande", created: "Demande créée", answerEvent: "Réponse envoyée", clarificationEvent: "Précision demandée", closedEvent: "Demande clôturée", cancelledEvent: "Demande annulée", assignmentEvent: "Responsable modifié", questionType: "Question", answerType: "Réponse", clarificationType: "Précision", commentType: "Note", requesterOnly: "Seul le demandeur ou le propriétaire peut demander une précision ou clôturer.", responseOnly: "Le responsable désigné ou le propriétaire peut répondre.", emptyThread: "Les réponses et échanges apparaîtront ici avec leur historique.", overdueBy: "Échéance dépassée", dueLabel: "Échéance", mentionDemo: "L’aperçu conserve ces demandes dans ce navigateur uniquement.", noWorkspace: "Les demandes nécessitent un espace connecté à la base de données.", createHint: "Attribuez la demande à un membre et fixez une échéance.", emptyMembers: "Aucun autre membre à désigner.", status: "Statut", timeline: "Historique", today: "Aujourd’hui", replySent: "Réponse enregistrée.", clarificationSent: "Précision enregistrée.", closedSuccess: "Demande clôturée.", cancelledSuccess: "Demande annulée.", questionRequired: "Ajoutez un objet et une question claire.", dueDate: "Date d’échéance",
  },
  en: {
    title: "Requests for information", subtitle: "Track project questions, responses, owners, and due dates.", create: "New RFI", ref: "Reference", subject: "Subject", question: "Technical question", area: "Drawing or work area", project: "Project", assigned: "Response owner", due: "Response due", unassigned: "Unassigned", save: "Create request", cancel: "Cancel", loading: "Loading RFIs…", loadError: "Could not load RFIs. Check your connection and access.", saveError: "Could not save. Check access and try again.", duplicate: "That reference is already used in this project.", noProjects: "Create a project before adding an RFI.", noItems: "No RFIs yet.", noMatches: "No RFIs match this filter.", start: "Create the first RFI", all: "All", open: "Awaiting response", answered: "Answered", closed: "Closed", cancelled: "Cancelled", overdue: "Overdue", details: "Request details", thread: "Correspondence", originalQuestion: "Question", sentBy: "Sent by", response: "Write the technical response", sendResponse: "Send response", clarification: "Describe what needs clarification", requestClarification: "Request clarification", closeRfi: "Close request", cancelRfi: "Cancel request", created: "Request created", answerEvent: "Response sent", clarificationEvent: "Clarification requested", closedEvent: "Request closed", cancelledEvent: "Request cancelled", assignmentEvent: "Owner changed", questionType: "Question", answerType: "Response", clarificationType: "Clarification", commentType: "Note", requesterOnly: "Only the requester or workspace owner can request clarification or close.", responseOnly: "The assigned member or workspace owner can respond.", emptyThread: "Responses and correspondence will appear here with their history.", overdueBy: "Past due", dueLabel: "Due", mentionDemo: "Preview requests are saved in this browser only.", noWorkspace: "RFIs require a workspace connected to the database.", createHint: "Assign a workspace member and set a response due date.", emptyMembers: "No other workspace members to assign.", status: "Status", timeline: "Status history", today: "Today", replySent: "Response saved.", clarificationSent: "Clarification saved.", closedSuccess: "Request closed.", cancelledSuccess: "Request cancelled.", questionRequired: "Add a subject and a clear question.", dueDate: "Due date",
  },
};

function readPreview() {
  try { return JSON.parse(localStorage.getItem("chantier-preview-rfis") || "[]"); }
  catch { return []; }
}

function isoDate(value, locale) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en-GB", { dateStyle: "medium" }).format(date);
}

function toLocalDate(date) {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, "0"); const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function previewId() { return globalThis.crypto?.randomUUID?.() || `rfi-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function errorMessage(error, t) {
  if (error?.code === "23505") return t.duplicate;
  if (error?.code === "42501" || error?.status === 401 || error?.status === 403) return t.saveError;
  return t.saveError;
}

export default function RfisWorkspace({ locale, projects, projectName, workspaceId, user, workspaceRole }) {
  const t = labels[locale] || labels.en;
  const preview = !user;
  const canEdit = preview || ["owner", "editor"].includes(workspaceRole);
  const isOwner = workspaceRole === "owner";
  const [rfis, setRfis] = useState(() => preview ? readPreview() : []);
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(Boolean(user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reply, setReply] = useState("");
  const [form, setForm] = useState(() => ({ project_id: projects[0]?.id || "", reference_code: `RFI-${String(Date.now()).slice(-5)}`, subject: "", question: "", area_or_drawing: "", assigned_to: "", due_date: toLocalDate(new Date(Date.now() + 7 * 86400000)) }));

  const load = useCallback(async () => {
    if (preview) {
      const saved = readPreview(); setRfis(saved); setMessages([]); setEvents([]); setMembers([]); setLoading(false);
      return;
    }
    if (!user || !workspaceId || !supabase) {
      setRfis([]); setMessages([]); setEvents([]); setMembers([]); setLoading(false);
      if (user && !workspaceId) setError(t.noWorkspace);
      return;
    }
    setLoading(true); setError("");
    try {
    const [rfiResult, memberResult] = await Promise.all([
      supabase.from("rfis").select("id,workspace_id,project_id,reference_code,subject,question,area_or_drawing,assigned_to,due_date,status,created_by,created_at,updated_at,answered_by,answered_at,closed_by,closed_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.rpc("list_workspace_members", { p_workspace_id: workspaceId }),
    ]);
    if (rfiResult.error) { setError(t.loadError); setLoading(false); return; }
    const items = rfiResult.data || [];
    setRfis(items); setMembers(memberResult.error ? [] : memberResult.data || []);
    if (items.length) {
      const ids = items.map((item) => item.id);
      const [messageResult, eventResult] = await Promise.all([
        supabase.from("rfi_messages").select("id,rfi_id,author_id,message_kind,body,created_at").in("rfi_id", ids).order("created_at", { ascending: true }),
        supabase.from("rfi_events").select("id,rfi_id,actor_id,event_type,previous_status,new_status,created_at").in("rfi_id", ids).order("created_at", { ascending: true }),
      ]);
      if (messageResult.error || eventResult.error) setError(t.loadError);
      setMessages(messageResult.data || []); setEvents(eventResult.data || []);
      setSelectedId((current) => items.some((item) => item.id === current) ? current : items[0].id);
    } else { setMessages([]); setEvents([]); setSelectedId(""); }
    } catch { setError(t.loadError); }
    finally { setLoading(false); }
  }, [preview, user, workspaceId, t.loadError, t.noWorkspace]);

  useEffect(() => { void load(); }, [load]);

  const selected = rfis.find((item) => item.id === selectedId) || null;
  const today = toLocalDate(new Date());
  const overdue = (item) => ["open", "answered"].includes(item.status) && item.due_date && item.due_date < today;
  const visible = useMemo(() => rfis.filter((item) => filter === "all" || (filter === "overdue" ? overdue(item) : item.status === filter)), [rfis, filter, today]);
  const selectedMessages = messages.filter((message) => message.rfi_id === selectedId);
  const selectedEvents = events.filter((event) => event.rfi_id === selectedId);
  const memberNames = new Map(members.map((member) => [member.user_id, member.display_name || member.email]));
  const mayRequest = preview || Boolean(user && selected && (selected.created_by === user.id || isOwner));
  const mayRespond = preview || Boolean(user && selected && canEdit && (isOwner || !selected.assigned_to || selected.assigned_to === user.id));

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const createRfi = async (event) => {
    event.preventDefault(); setError(""); setNotice("");
    const projectId = form.project_id || projects[0]?.id || "";
    if (!form.subject.trim() || !form.question.trim() || !projectId) { setError(t.questionRequired); return; }
    setBusy(true);
    const payload = { ...form, project_id: projectId, workspace_id: workspaceId, reference_code: form.reference_code.trim(), subject: form.subject.trim(), question: form.question.trim(), area_or_drawing: form.area_or_drawing.trim(), assigned_to: form.assigned_to || null, due_date: form.due_date || null, created_by: user?.id || "preview-user" };
    if (preview) {
      const item = { ...payload, id: previewId(), status: "open", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const next = [item, ...readPreview()]; localStorage.setItem("chantier-preview-rfis", JSON.stringify(next)); setRfis(next); setSelectedId(item.id); setCreating(false); setNotice(t.created); setBusy(false); return;
    }
    const { data, error: saveError } = await supabase.from("rfis").insert(payload).select("id").single();
    if (saveError) { setError(errorMessage(saveError, t)); setBusy(false); return; }
    setCreating(false); setNotice(t.created); await load(); setSelectedId(data.id); setBusy(false);
  };

  const changeStatus = async (action, successText) => {
    if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    if (preview) {
      const next = readPreview().map((item) => item.id === selected.id ? { ...item, status: action === "close_rfi" ? "closed" : action === "cancel_rfi" ? "cancelled" : "open", updated_at: new Date().toISOString() } : item);
      localStorage.setItem("chantier-preview-rfis", JSON.stringify(next)); setRfis(next); setNotice(successText); setBusy(false); return;
    }
    const { error: statusError } = await supabase.rpc(action, { p_rfi_id: selected.id });
    if (statusError) setError(errorMessage(statusError, t));
    else { setNotice(successText); await load(); }
    setBusy(false);
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true); setError(""); setNotice("");
    const body = reply.trim();
    if (preview) {
      const next = readPreview().map((item) => item.id === selected.id ? { ...item, status: "answered", answered_by: "preview-user", answered_at: new Date().toISOString(), updated_at: new Date().toISOString() } : item);
      const message = { id: previewId(), rfi_id: selected.id, author_id: "preview-user", message_kind: "answer", body, created_at: new Date().toISOString() };
      localStorage.setItem("chantier-preview-rfis", JSON.stringify(next)); setRfis(next); setMessages((current) => [...current, message]); setReply(""); setNotice(t.replySent); setBusy(false); return;
    }
    const { error: responseError } = await supabase.rpc("respond_to_rfi", { p_rfi_id: selected.id, p_body: body });
    if (responseError) setError(errorMessage(responseError, t));
    else { setReply(""); setNotice(t.replySent); await load(); }
    setBusy(false);
  };

  const sendClarification = async (event) => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true); setError(""); setNotice("");
    const body = reply.trim();
    if (preview) {
      const next = readPreview().map((item) => item.id === selected.id ? { ...item, status: "open", updated_at: new Date().toISOString() } : item);
      const message = { id: previewId(), rfi_id: selected.id, author_id: "preview-user", message_kind: "clarification", body, created_at: new Date().toISOString() };
      localStorage.setItem("chantier-preview-rfis", JSON.stringify(next)); setRfis(next); setMessages((current) => [...current, message]); setReply(""); setNotice(t.clarificationSent); setBusy(false); return;
    }
    const { error: clarificationError } = await supabase.rpc("request_rfi_clarification", { p_rfi_id: selected.id, p_body: body });
    if (clarificationError) setError(errorMessage(clarificationError, t));
    else { setReply(""); setNotice(t.clarificationSent); await load(); }
    setBusy(false);
  };

  return <section className="rfi-page" aria-labelledby="rfi-page-title" dir={locale === "ar" ? "rtl" : "ltr"}>
    <div className="rfi-heading">
      <div className="rfi-heading-icon"><CircleHelp size={21} /></div>
      <div><span className="rfi-eyebrow">{t.details}</span><h1 id="rfi-page-title">{t.title}</h1><p>{t.subtitle}</p></div>
      {canEdit && <button className="button button-primary rfi-create-button" onClick={() => { setCreating((open) => !open); setError(""); }}><Plus size={16} />{t.create}</button>}
    </div>

    {preview && <p className="rfi-preview-note">{t.mentionDemo}</p>}
    {user && !workspaceId && <p className="rfi-message rfi-error" role="alert">{t.noWorkspace}</p>}
    {error && <p className="rfi-message rfi-error" role="alert">{error}</p>}
    {notice && <p className="rfi-message rfi-success" role="status">{notice}</p>}

    {creating && <form className="rfi-create-form panel" onSubmit={createRfi}>
      <div className="rfi-form-head"><div><h2>{t.create}</h2><p>{t.createHint}</p></div><button type="button" className="icon-button" aria-label={t.cancel} onClick={() => setCreating(false)}><X size={17} /></button></div>
      {projects.length === 0 ? <p className="rfi-message">{t.noProjects}</p> : <>
        <div className="rfi-form-grid">
          <label>{t.project}<select value={form.project_id || projects[0]?.id || ""} onChange={(event) => updateForm("project_id", event.target.value)} required>{projects.map((project) => <option value={project.id} key={project.id}>{projectName(project)}</option>)}</select></label>
          <label>{t.ref}<input maxLength={40} value={form.reference_code} onChange={(event) => updateForm("reference_code", event.target.value)} required /></label>
          <label>{t.subject}<input maxLength={200} value={form.subject} onChange={(event) => updateForm("subject", event.target.value)} required /></label>
          <label>{t.area}<input maxLength={240} value={form.area_or_drawing} onChange={(event) => updateForm("area_or_drawing", event.target.value)} /></label>
          <label>{t.assigned}<select value={form.assigned_to} onChange={(event) => updateForm("assigned_to", event.target.value)}><option value="">{t.unassigned}</option>{members.filter((member) => member.user_id !== user?.id).map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name || member.email}</option>)}</select>{!preview && members.length <= 1 && <small>{t.emptyMembers}</small>}</label>
          <label>{t.dueDate}<input type="date" value={form.due_date} onChange={(event) => updateForm("due_date", event.target.value)} /></label>
        </div>
        <label className="rfi-question-label">{t.question}<textarea maxLength={5000} rows={4} value={form.question} onChange={(event) => updateForm("question", event.target.value)} required /></label>
        <div className="rfi-form-actions"><button type="button" className="button button-white" onClick={() => setCreating(false)}>{t.cancel}</button><button type="submit" className="button button-primary" disabled={busy || !canEdit}><Plus size={15} />{busy ? t.loading : t.save}</button></div>
      </>}
    </form>}

    <div className="rfi-filters" role="tablist" aria-label={t.status}>{[["all", t.all], ["open", t.open], ["overdue", t.overdue], ["answered", t.answered], ["closed", t.closed]].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "selected" : ""} onClick={() => setFilter(key)}>{label}{key === "all" && <span>{rfis.length}</span>}</button>)}</div>

    {loading ? <div className="rfi-state"><LoaderCircle size={20} className="rfi-spinner" />{t.loading}</div> : rfis.length === 0 ? <div className="rfi-empty panel"><span><FileQuestion size={24} /></span><h2>{t.noItems}</h2><p>{preview ? t.mentionDemo : t.noItems}</p>{canEdit && projects.length > 0 && <button className="button button-primary" onClick={() => setCreating(true)}><Plus size={15} />{t.start}</button>}</div> : visible.length === 0 ? <div className="rfi-state">{t.noMatches}</div> : <div className="rfi-columns">
      <div className="rfi-list" aria-label={t.title}>{visible.map((item) => <button key={item.id} type="button" className={`rfi-list-item ${selectedId === item.id ? "active" : ""}`} onClick={() => { setSelectedId(item.id); setReply(""); }}>
        <div className="rfi-card-top"><b>{item.reference_code}</b><span className={`rfi-status status-${item.status}`}>{t[item.status]}</span></div>
        <strong>{item.subject}</strong><small>{projectName(projects.find((project) => project.id === item.project_id)) || t.project}</small>
        <div className="rfi-card-meta"><span><CalendarDays size={13} />{isoDate(item.due_date, locale)}</span>{overdue(item) && <em><Clock3 size={12} />{t.overdueBy}</em>}</div>
      </button>)}</div>

      {selected ? <article className="rfi-detail panel" aria-labelledby="rfi-detail-title">
        <div className="rfi-detail-head"><div><span className="rfi-eyebrow">{selected.reference_code}</span><h2 id="rfi-detail-title">{selected.subject}</h2></div><span className={`rfi-status status-${selected.status}`}>{t[selected.status]}</span></div>
        <div className="rfi-info-grid"><div><small>{t.project}</small><b>{projectName(projects.find((project) => project.id === selected.project_id)) || "—"}</b></div><div><small>{t.assigned}</small><b>{memberNames.get(selected.assigned_to) || (selected.assigned_to ? "—" : t.unassigned)}</b></div><div><small>{t.dueLabel}</small><b className={overdue(selected) ? "rfi-overdue-text" : ""}>{isoDate(selected.due_date, locale)}</b></div><div><small>{t.area}</small><b>{selected.area_or_drawing || "—"}</b></div></div>
        <section className="rfi-original-question"><div><span><FileQuestion size={15} />{t.originalQuestion}</span><small>{t.sentBy} {memberNames.get(selected.created_by) || (selected.created_by === user?.id ? user.email : "—")}</small></div><p>{selected.question}</p></section>
        <section className="rfi-thread"><h3><MessageSquareText size={16} />{t.thread}</h3>
          {selectedMessages.length === 0 ? <p className="rfi-thread-empty">{t.emptyThread}</p> : <ol>{selectedMessages.map((message) => <li key={message.id} className={`thread-${message.message_kind}`}><span className="thread-kind">{t[`${message.message_kind}Type`] || t.commentType}</span><p>{message.body}</p><small>{memberNames.get(message.author_id) || (message.author_id === user?.id ? user.email : "—")} · {isoDate(message.created_at, locale)}</small></li>)}</ol>}
        </section>
        {selectedEvents.length > 0 && <details className="rfi-history"><summary>{t.timeline} <ArrowDownLeft size={14} /></summary><ol>{selectedEvents.map((event) => <li key={event.id}><span>{t[event.event_type === "created" ? "created" : event.event_type === "answered" ? "answerEvent" : event.event_type === "clarification_requested" ? "clarificationEvent" : event.event_type === "closed" ? "closedEvent" : event.event_type === "cancelled" ? "cancelledEvent" : "assignmentEvent"]}</span><small>{isoDate(event.created_at, locale)}</small></li>)}</ol></details>}

        {selected.status === "open" && mayRespond && canEdit && <form className="rfi-reply-form" onSubmit={sendReply}><label htmlFor="rfi-response">{t.response}</label><textarea id="rfi-response" rows={3} maxLength={5000} value={reply} onChange={(event) => setReply(event.target.value)} required /><button className="button button-primary" type="submit" disabled={busy || !reply.trim()}><Send size={15} />{busy ? t.loading : t.sendResponse}</button></form>}
        {selected.status === "answered" && mayRequest && canEdit && <form className="rfi-reply-form" onSubmit={sendClarification}><label htmlFor="rfi-clarification">{t.clarification}</label><textarea id="rfi-clarification" rows={3} maxLength={5000} value={reply} onChange={(event) => setReply(event.target.value)} required /><div className="rfi-action-row"><button className="button button-white" type="submit" disabled={busy || !reply.trim()}><ArrowUpRight size={15} />{busy ? t.loading : t.requestClarification}</button><button className="button button-primary" type="button" disabled={busy} onClick={() => changeStatus("close_rfi", t.closedSuccess)}><Check size={15} />{t.closeRfi}</button></div></form>}
        {selected.status === "open" && mayRequest && canEdit && <div className="rfi-footer-actions"><button className="button button-white" type="button" disabled={busy} onClick={() => changeStatus("cancel_rfi", t.cancelledSuccess)}><X size={15} />{t.cancelRfi}</button></div>}
        {selected.status === "answered" && !mayRequest && <p className="rfi-permission-note">{t.requesterOnly}</p>}
        {selected.status === "open" && selected.assigned_to && !mayRespond && selected.assigned_to !== user?.id && <p className="rfi-permission-note">{t.responseOnly}</p>}
      </article> : <div className="rfi-state panel">{t.noMatches}</div>}
    </div>}
  </section>;
}
