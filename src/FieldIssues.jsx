import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ClipboardCheck, Construction, ImagePlus, LoaderCircle, Plus, ShieldAlert, Wrench, X } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { getFieldDrafts, removeFieldDraft, saveFieldDraft } from "./lib/offline-field-drafts.js";
import "./field-issues.css";

const copy = {
  ar: {
    title: "الجودة والسلامة وقائمة الملاحظات", subtitle: "سجّل ملاحظات الموقع، عيّن مسؤولًا، وتابع الإغلاق.", preview: "معاينة محلية: تحفظ هذه الملاحظات في هذا المتصفح فقط.",
    type: "النوع", quality: "الجودة", safety: "السلامة", punch: "قائمة الملاحظات", project: "المشروع", titleField: "عنوان الملاحظة", description: "التفاصيل", location: "الموقع / الطابق", severity: "الأولوية", due: "موعد المعالجة", create: "إضافة ملاحظة", cancel: "إلغاء", newIssue: "ملاحظة جديدة", evidence: "صور الإثبات (حتى 5 صور، 10 م.ب للصورة)", pending: "مسودات وصور غير متزامنة", assignee: "المسؤول", createRfi: "تصعيد إلى طلب توضيح", rfiLinked: "طلب التوضيح",
    all: "الكل", open: "مفتوحة", in_progress: "قيد المعالجة", resolved: "تمت المعالجة", verified: "تم التحقق", low: "منخفضة", medium: "متوسطة", high: "عالية", critical: "حرجة", noItems: "لا توجد ملاحظات مسجلة.", noProjects: "أنشئ مشروعًا أولًا لتسجيل ملاحظة.", loading: "جارٍ تحميل الملاحظات…", loadError: "تعذر تحميل الملاحظات.", saveError: "تعذر حفظ التغيير. تحقق من الاتصال والصلاحية.", saved: "تم حفظ الملاحظة.", updated: "تم تحديث الحالة.", comment: "تعليق على الإجراء (اختياري)", markProgress: "بدء المعالجة", markResolved: "تسجيل المعالجة", verify: "التحقق والإغلاق", status: "الحالة", readOnly: "لديك صلاحية قراءة فقط.", emptyPreview: "أضف أول ملاحظة لتظهر هنا.", required: "أدخل عنوان الملاحظة.",
  },
  fr: {
    title: "Qualité, sécurité et réserves", subtitle: "Consignez les observations, attribuez un responsable et suivez leur résolution.", preview: "Aperçu local : ces observations restent dans ce navigateur.",
    type: "Type", quality: "Qualité", safety: "Sécurité", punch: "Réserve", project: "Projet", titleField: "Titre de l’observation", description: "Détails", location: "Emplacement / niveau", severity: "Priorité", due: "Date de traitement", create: "Ajouter l’observation", cancel: "Annuler", newIssue: "Nouvelle observation", evidence: "Photos justificatives (5 max., 10 Mo par photo)", pending: "Brouillons et photos non synchronisés", assignee: "Responsable", createRfi: "Escalader vers une demande d’information", rfiLinked: "Demande liée",
    all: "Tout", open: "Ouvert", in_progress: "En cours", resolved: "Traité", verified: "Vérifié", low: "Faible", medium: "Moyenne", high: "Élevée", critical: "Critique", noItems: "Aucune observation enregistrée.", noProjects: "Créez d’abord un projet.", loading: "Chargement des observations…", loadError: "Impossible de charger les observations.", saveError: "Impossible d’enregistrer. Vérifiez la connexion et les droits.", saved: "Observation enregistrée.", updated: "Statut mis à jour.", comment: "Commentaire de suivi (facultatif)", markProgress: "Commencer le traitement", markResolved: "Marquer comme traité", verify: "Vérifier et clôturer", status: "Statut", readOnly: "Votre accès est en lecture seule.", emptyPreview: "Ajoutez une première observation.", required: "Saisissez un titre.",
  },
  en: {
    title: "Quality, safety & punch list", subtitle: "Record site observations, assign ownership, and track resolution.", preview: "Local preview: observations are stored in this browser only.",
    type: "Type", quality: "Quality", safety: "Safety", punch: "Punch list", project: "Project", titleField: "Observation title", description: "Details", location: "Location / level", severity: "Priority", due: "Resolution due", create: "Add observation", cancel: "Cancel", newIssue: "New observation", evidence: "Evidence photos (up to 5, 10 MB each)", pending: "Unsynced drafts and photos", assignee: "Assignee", createRfi: "Escalate to RFI", rfiLinked: "Linked RFI",
    all: "All", open: "Open", in_progress: "In progress", resolved: "Resolved", verified: "Verified", low: "Low", medium: "Medium", high: "High", critical: "Critical", noItems: "No observations recorded.", noProjects: "Create a project before recording an observation.", loading: "Loading observations…", loadError: "Could not load observations.", saveError: "Could not save. Check your connection and access.", saved: "Observation saved.", updated: "Status updated.", comment: "Follow-up comment (optional)", markProgress: "Start work", markResolved: "Mark resolved", verify: "Verify and close", status: "Status", readOnly: "Your access is read-only.", emptyPreview: "Add the first observation to see it here.", required: "Enter an observation title.",
  },
};

const PREVIEW_KEY = "chantier-preview-field-issues";
const BUCKET = "chantier-documents";
const typeIcons = { quality: ClipboardCheck, safety: ShieldAlert, punch: Construction };
const statuses = ["open", "in_progress", "resolved", "verified"];
const priorities = ["low", "medium", "high", "critical"];
const checklistTemplates = {
  ar: { safety: { label:"فحص السلامة اليومي", items:["معدات الوقاية الشخصية متوفرة ومستخدمة","الممرات ومخارج الطوارئ خالية","السقالات والحواجز مثبتة","الكابلات ومصادر الكهرباء مؤمنة"] }, concrete: { label:"فحص صب الخرسانة", items:["مطابقة التسليح والمباعدات","القوالب والدعامات مستقرة","تم فحص الغطاء الخرساني","تم تجهيز مسار الصب والمعالجة"] }, handover: { label:"فحص قائمة التسليم", items:["الأسطح والتشطيبات سليمة","الأبواب والنوافذ تعمل","التمديدات مختبرة","الملاحظات والصور موثقة"] } },
  fr: { safety: { label:"Contrôle quotidien de sécurité", items:["EPI disponibles et portés","Circulations et issues dégagées","Échafaudages et garde-corps sécurisés","Câbles et sources électriques protégés"] }, concrete: { label:"Contrôle avant bétonnage", items:["Armatures et cales conformes","Coffrage et étaiement stables","Enrobage vérifié","Accès au coulage et cure préparés"] }, handover: { label:"Liste de réception", items:["Surfaces et finitions en bon état","Portes et fenêtres fonctionnelles","Réseaux testés","Réserves et photos consignées"] } },
  en: { safety: { label:"Daily safety walk", items:["PPE available and used","Walkways and exits clear","Scaffolds and guardrails secured","Cables and electrical sources protected"] }, concrete: { label:"Pre-pour concrete check", items:["Rebar and spacers match drawings","Formwork and shoring stable","Concrete cover checked","Pour access and curing ready"] }, handover: { label:"Handover punch checklist", items:["Surfaces and finishes in good condition","Doors and windows operate","Services tested","Issues and photos recorded"] } },
};

function readPreview() {
  try {
    const data = JSON.parse(localStorage.getItem(PREVIEW_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function makeId() { return globalThis.crypto?.randomUUID?.() || `issue-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function formatDate(value, locale) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return String(value);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en-GB", { dateStyle: "medium" }).format(date);
}

function nextStatus(status) {
  const index = statuses.indexOf(status);
  return statuses[Math.min(index + 1, statuses.length - 1)];
}

export default function FieldIssues({ locale = "ar", projects = [], projectName, workspaceId, user, workspaceRole }) {
  const t = copy[locale] || copy.en;
  const preview = !user;
  const canEdit = preview || Boolean(workspaceId && ["owner", "editor"].includes(workspaceRole));
  const [items, setItems] = useState(() => preview ? readPreview() : []);
  const [members, setMembers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(Boolean(user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [offlineDrafts, setOfflineDrafts] = useState([]);
  const [checklistKey, setChecklistKey] = useState("");
  const [checklistChecks, setChecklistChecks] = useState({});
  const [values, setValues] = useState({ projectId: "", issueType: "quality", title: "", description: "", location: "", severity: "medium", dueDate: "", assigneeId: "" });

  const load = useCallback(async () => {
    if (preview) { setItems(readPreview()); setLoading(false); return; }
    if (!user || !workspaceId || !supabase) { setItems([]); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [{ data, error: queryError }, { data: memberRows }] = await Promise.all([
        supabase.from("project_field_issues")
        .select("id,workspace_id,project_id,issue_type,title,description,location,severity,due_date,assignee_id,status,created_by,created_at,updated_at")
        .eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
        supabase.rpc("list_workspace_members", { p_workspace_id: workspaceId }),
      ]);
      if (queryError) throw queryError;
      setMembers(memberRows || []);
      const [{ data: attachments }, { data: rfiRows }] = await Promise.all([
        supabase.from("project_field_issue_attachments").select("id,issue_id,storage_path,file_name,created_at").eq("workspace_id", workspaceId),
        supabase.from("rfis").select("id,source_issue_id,reference_code").eq("workspace_id", workspaceId).not("source_issue_id", "is", null),
      ]);
      const attachmentRows = await Promise.all((attachments || []).map(async (file) => {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_path, 300);
        return { ...file, url: signed?.signedUrl || "" };
      }));
      const byIssue = new Map();
      for (const file of attachmentRows) byIssue.set(file.issue_id, [...(byIssue.get(file.issue_id) || []), file]);
      const rfiByIssue = new Map((rfiRows || []).map((rfi) => [rfi.source_issue_id, rfi]));
      setItems((data || []).map((row) => ({ ...row, attachments: byIssue.get(row.id) || [], linkedRfi: rfiByIssue.get(row.id) || null })));
    } catch { setError(t.loadError); }
    finally { setLoading(false); }
  }, [preview, user, workspaceId, t.loadError]);

  useEffect(() => { void load(); }, [load]);

  const syncOfflineDrafts = useCallback(async () => {
    if (!user || !workspaceId || !supabase || !navigator.onLine) return;
    let drafts;
    try { drafts = await getFieldDrafts(); } catch { return; }
    for (let draft of drafts.filter((row) => row.userId === user.id && row.workspaceId === workspaceId)) {
      try {
        if (!draft.issueId) {
          const { data: issueId, error: createError } = await supabase.rpc("create_project_field_issue", {
            p_workspace_id: workspaceId, p_project_id: draft.payload.project_id, p_issue_type: draft.payload.issue_type,
            p_title: draft.payload.title, p_description: draft.payload.description, p_location: draft.payload.location,
            p_severity: draft.payload.severity, p_due_date: draft.payload.due_date, p_assignee_id: draft.payload.assignee_id || null,
          });
          if (createError) throw createError;
          draft = { ...draft, issueId };
          await saveFieldDraft(draft);
        }
        const files = [...(draft.files || [])];
        for (let index = 0; index < files.length; index++) {
          const file = files[index];
          if (file.registered) continue;
          const fileId = file.fileId || globalThis.crypto?.randomUUID?.() || makeId();
          const safeName = file.name.replace(/[^\p{L}\p{N}._-]/gu, "_").slice(0, 160) || "evidence";
          const path = `${workspaceId}/${draft.payload.project_id}/${draft.issueId}/${fileId}-${safeName}`;
          files[index] = { ...file, fileId };
          draft = { ...draft, files };
          await saveFieldDraft(draft);
          const { data: registered } = await supabase.from("project_field_issue_attachments").select("id").eq("storage_path", path).maybeSingle();
          if (!registered) {
            const folder = `${workspaceId}/${draft.payload.project_id}/${draft.issueId}`;
            const { data: storedFiles } = await supabase.storage.from(BUCKET).list(folder);
            const alreadyUploaded = (storedFiles || []).some((entry) => entry.name === `${fileId}-${safeName}`);
            if (!alreadyUploaded) {
              const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file.blob, { upsert: false, contentType: file.type, cacheControl: "300" });
              if (uploadError) throw uploadError;
            }
            const { error: registerError } = await supabase.rpc("register_project_field_issue_attachment", {
              p_workspace_id: workspaceId, p_project_id: draft.payload.project_id, p_issue_id: draft.issueId,
              p_storage_path: path, p_file_name: file.name, p_mime_type: file.type, p_size_bytes: file.blob.size,
            });
            if (registerError) throw registerError;
          }
          files[index] = { ...file, fileId, registered: true };
          draft = { ...draft, files };
          await saveFieldDraft(draft);
        }
        await removeFieldDraft(draft.id);
      } catch { /* Keep the draft for a later retry; never discard offline evidence. */ }
    }
    try { setOfflineDrafts((await getFieldDrafts()).filter((row) => row.userId === user.id && row.workspaceId === workspaceId)); } catch {}
    await load();
  }, [user, workspaceId, load]);

  useEffect(() => {
    if (!user || !workspaceId) return;
    let active = true;
    void getFieldDrafts().then((drafts) => { if (active) setOfflineDrafts(drafts.filter((row) => row.userId === user.id && row.workspaceId === workspaceId)); }).catch(() => {});
    const handleOnline = () => { void syncOfflineDrafts(); };
    window.addEventListener("online", handleOnline);
    return () => { active = false; window.removeEventListener("online", handleOnline); };
  }, [user, workspaceId, syncOfflineDrafts]);

  const filtered = useMemo(() => items.filter((item) => filter === "all" || item.issue_type === filter), [items, filter]);
  const updateValue = (key, value) => setValues((old) => ({ ...old, [key]: value }));

  const createIssue = async (event) => {
    event.preventDefault();
    if (!values.title.trim() || !values.projectId) { setError(t.required); return; }
    setBusy(true); setError(""); setNotice("");
    const payload = {
      project_id: values.projectId, issue_type: values.issueType, title: values.title.trim(), description: [values.description.trim(), checklistKey ? `\n[${checklistTemplates[locale]?.[checklistKey]?.label||checklistTemplates.en[checklistKey].label}]\n${(checklistTemplates[locale]||checklistTemplates.en)[checklistKey].items.map((item,index)=>`${checklistChecks[index]?"[x]":"[ ]"} ${item}`).join("\n")}` : ""].filter(Boolean).join("\n\n"),
      location: values.location.trim(), severity: values.severity, due_date: values.dueDate || null, status: "open",
      assignee_id: values.assigneeId || null,
    };
    let evidencePending = false;
    try {
      if (preview) {
        const row = { ...payload, attachments: evidence.map((file) => ({ file_name: file.name })), id: makeId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        const next = [row, ...readPreview()];
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(next)); setItems(next);
      } else {
        if (evidence.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024)) throw new Error("unsupported evidence file");
        if (!navigator.onLine) {
          const draft = { id: makeId(), userId: user.id, workspaceId, payload, files: evidence.map((file) => ({ name: file.name, type: file.type, blob: file })), createdAt: new Date().toISOString() };
          await saveFieldDraft(draft);
          setOfflineDrafts((rows) => [draft, ...rows]);
          setNotice(locale === "ar" ? "حُفظت الملاحظة وصورها محليًا؛ ستتم مزامنتها عند عودة الاتصال." : locale === "fr" ? "Observation et photos enregistrées hors ligne ; synchronisation à la reconnexion." : "Observation and photos saved offline; they will sync when you reconnect.");
          setCreating(false); setEvidence([]); setBusy(false); return;
        }
        const { data: issueId, error: rpcError } = await supabase.rpc("create_project_field_issue", {
          p_workspace_id: workspaceId, p_project_id: values.projectId, p_issue_type: values.issueType, p_title: values.title.trim(),
          p_description: payload.description, p_location: values.location.trim(), p_severity: values.severity,
          p_due_date: values.dueDate || null, p_assignee_id: values.assigneeId || null,
        });
        if (rpcError) throw rpcError;
        if (evidence.length) {
          const draft = { id: makeId(), userId: user.id, workspaceId, issueId, payload, files: evidence.map((file) => ({ name: file.name, type: file.type, blob: file })), createdAt: new Date().toISOString() };
          await saveFieldDraft(draft);
          await syncOfflineDrafts();
          evidencePending = (await getFieldDrafts()).some((row) => row.id === draft.id);
        }
        await load();
      }
      setNotice(evidencePending ? (locale === "ar" ? "حُفظت الملاحظة؛ بقيت صورها في قائمة المزامنة." : locale === "fr" ? "Observation enregistrée ; les photos restent en attente de synchronisation." : "Observation saved; its photos remain queued to sync.") : t.saved); setCreating(false);
      setEvidence([]);
      setValues({ projectId: "", issueType: "quality", title: "", description: "", location: "", severity: "medium", dueDate: "", assigneeId: "" });setChecklistKey("");setChecklistChecks({});
    } catch { setError(t.saveError); }
    finally { setBusy(false); }
  };

  const advance = async (item) => {
    const status = nextStatus(item.status);
    if (status === item.status) return;
    const comment = window.prompt(t.comment, "") ?? "";
    setBusy(true); setError(""); setNotice("");
    try {
      if (preview) {
        const next = readPreview().map((row) => row.id === item.id ? { ...row, status, updated_at: new Date().toISOString() } : row);
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(next)); setItems(next);
      } else {
        const { error: rpcError } = await supabase.rpc("update_project_field_issue", { p_issue_id: item.id, p_status: status, p_comment: comment.trim() });
        if (rpcError) throw rpcError;
        await load();
      }
      setNotice(t.updated);
    } catch { setError(t.saveError); }
    finally { setBusy(false); }
  };

  const escalateToRfi = async (item) => {
    if (item.linkedRfi) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const reference = `ISS-${String(item.id).slice(0, 8).toUpperCase()}`;
      if (preview) {
        const rows = JSON.parse(localStorage.getItem("chantier-preview-rfis") || "[]");
        const row = { id: makeId(), workspace_id: "preview", project_id: item.project_id, reference_code: reference, subject: item.title, question: item.description || item.title, area_or_drawing: item.location || "", status: "open", source_issue_id: item.id, created_at: new Date().toISOString() };
        localStorage.setItem("chantier-preview-rfis", JSON.stringify([row, ...(Array.isArray(rows) ? rows : [])]));
        const updated = readPreview().map((issue) => issue.id === item.id ? { ...issue, linkedRfi: { reference_code: reference } } : issue);
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(updated)); setItems(updated);
      } else {
        const { error: insertError } = await supabase.from("rfis").insert({
          workspace_id: workspaceId, project_id: item.project_id, source_issue_id: item.id, reference_code: reference,
          subject: item.title, question: item.description || item.title, area_or_drawing: item.location || "", assigned_to: item.assignee_id || null, due_date: item.due_date || null,
        });
        if (insertError) throw insertError;
        await load();
      }
      setNotice(locale === "ar" ? `تم إنشاء ${t.rfiLinked} ${reference}.` : locale === "fr" ? `${t.rfiLinked} ${reference} créée.` : `${t.rfiLinked} ${reference} created.`);
    } catch { setError(t.saveError); }
    finally { setBusy(false); }
  };

  const localeTag = locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en";
  return (
    <main className="field-issues" dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className="field-issues-heading">
        <div><span className="field-issues-kicker"><Wrench size={14} />{t.type}</span><h1>{t.title}</h1><p>{t.subtitle}</p></div>
        {canEdit && projects.length > 0 && <button type="button" className="field-issues-primary" onClick={() => setCreating((value) => !value)}><Plus size={17} />{t.newIssue}</button>}
      </header>
      {preview && <div className="field-issues-preview" role="note">{t.preview}</div>}
      {!preview && !workspaceId && <div className="field-issues-preview" role="status">{t.loadError}</div>}
      {!canEdit && <div className="field-issues-readonly" role="note">{t.readOnly}</div>}
      {notice && <div className="field-issues-notice" role="status">{notice}</div>}
      {error && <div className="field-issues-error" role="alert">{error}</div>}

      {creating && <form className="field-issues-form" onSubmit={createIssue}>
        <div className="field-issues-form-heading"><h2>{t.newIssue}</h2><button type="button" className="field-issues-close" onClick={() => setCreating(false)} aria-label={t.cancel}><X size={18} /></button></div>
        <div className="field-issues-form-grid">
          <label className="field-issues-wide">{locale==="ar"?"قائمة تحقق محفوظة":locale==="fr"?"Checklist enregistrée":"Saved checklist"}<select value={checklistKey} onChange={(e)=>{setChecklistKey(e.target.value);setChecklistChecks({});}}><option value="">—</option>{Object.entries(checklistTemplates[locale]||checklistTemplates.en).map(([key,template])=><option value={key} key={key}>{template.label}</option>)}</select></label>
          {checklistKey&&<fieldset className="field-issues-checklist field-issues-wide"><legend>{(checklistTemplates[locale]||checklistTemplates.en)[checklistKey].label}</legend>{(checklistTemplates[locale]||checklistTemplates.en)[checklistKey].items.map((item,index)=><label key={item}><input type="checkbox" checked={Boolean(checklistChecks[index])} onChange={(e)=>setChecklistChecks((old)=>({...old,[index]:e.target.checked}))}/>{item}</label>)}</fieldset>}
          <label>{t.project}<select required value={values.projectId} onChange={(e) => updateValue("projectId", e.target.value)}><option value="">—</option>{projects.map((project) => <option key={project.id} value={project.id}>{projectName(project)}</option>)}</select></label>
          <label>{t.type}<select value={values.issueType} onChange={(e) => updateValue("issueType", e.target.value)}>{["quality", "safety", "punch"].map((type) => <option key={type} value={type}>{t[type]}</option>)}</select></label>
          <label className="field-issues-wide">{t.titleField}<input required maxLength={200} value={values.title} onChange={(e) => updateValue("title", e.target.value)} /></label>
          <label className="field-issues-wide">{t.description}<textarea rows="3" maxLength={3000} value={values.description} onChange={(e) => updateValue("description", e.target.value)} /></label>
          <label>{t.location}<input maxLength={200} value={values.location} onChange={(e) => updateValue("location", e.target.value)} /></label>
          <label>{t.severity}<select value={values.severity} onChange={(e) => updateValue("severity", e.target.value)}>{priorities.map((priority) => <option key={priority} value={priority}>{t[priority]}</option>)}</select></label>
          <label>{t.due}<input type="date" value={values.dueDate} onChange={(e) => updateValue("dueDate", e.target.value)} /></label>
          {user&&<label>{t.assignee}<select value={values.assigneeId} onChange={(e)=>updateValue("assigneeId",e.target.value)}><option value="">—</option>{members.map((member)=><option key={member.user_id} value={member.user_id}>{member.display_name||member.email}</option>)}</select></label>}
          <label className="field-issues-wide"><span><ImagePlus size={14}/>{t.evidence}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setEvidence(Array.from(e.target.files || []).slice(0, 5))} />{evidence.length>0&&<small>{evidence.map((file)=>file.name).join(" · ")}</small>}</label>
        </div>
        <div className="field-issues-form-actions"><button type="button" className="field-issues-secondary" onClick={() => setCreating(false)}>{t.cancel}</button><button className="field-issues-primary" disabled={busy}>{busy && <LoaderCircle size={15} className="field-issues-spin" />}{t.create}</button></div>
      </form>}

      <nav className="field-issues-filters" aria-label={t.type}>
        {["all", "quality", "safety", "punch"].map((key) => <button key={key} type="button" className={filter === key ? "is-selected" : ""} onClick={() => setFilter(key)}>{key === "all" ? t.all : t[key]}</button>)}
      </nav>
      {loading ? <div className="field-issues-empty"><LoaderCircle className="field-issues-spin" size={20} />{t.loading}</div> : projects.length === 0 ? <div className="field-issues-empty"><Construction size={28} /><span>{t.noProjects}</span></div> : filtered.length === 0 ? <div className="field-issues-empty"><ClipboardCheck size={28} /><span>{items.length === 0 ? t.noItems : t.emptyPreview}</span></div> : (
        <div className="field-issues-list">
          {filtered.map((item) => {
            const Icon = typeIcons[item.issue_type] || AlertTriangle;
            const project = projects.find((row) => row.id === item.project_id);
            const duePassed = item.due_date && item.due_date < new Date().toISOString().slice(0, 10) && !["resolved", "verified"].includes(item.status);
            return <article className={`field-issue-card severity-${item.severity}`} key={item.id}>
              <div className="field-issue-icon"><Icon size={17} /></div>
              <div className="field-issue-main">
                <div className="field-issue-meta"><span>{t[item.issue_type] || t.quality}</span><span className={`field-issue-severity sev-${item.severity}`}>{t[item.severity] || t.medium}</span></div>
                <h2>{item.title}</h2>
                {item.description && <p>{item.description}</p>}
                {item.attachments?.length>0&&<div className="field-issue-attachments">{item.attachments.map((file,index)=>file.url?<a key={file.id||index} href={file.url} target="_blank" rel="noreferrer">{file.file_name}</a>:<span key={file.id||index}>{file.file_name}</span>)}</div>}
                <div className="field-issue-foot"><span>{project ? projectName(project) : "—"}</span>{item.location && <span>{item.location}</span>}{item.assignee_id&&<span>{t.assignee}: {members.find((member)=>member.user_id===item.assignee_id)?.display_name||members.find((member)=>member.user_id===item.assignee_id)?.email||"—"}</span>}{item.due_date && <span>{t.due}: {formatDate(item.due_date, localeTag)}</span>}</div>
                {item.linkedRfi&&<small>{t.rfiLinked}: {item.linkedRfi.reference_code}</small>}
              </div>
              <div className="field-issue-actions"><span className={`field-issue-status status-${item.status}`}>{t[item.status] || t.open}</span>{canEdit && !item.linkedRfi && <button type="button" onClick={() => void escalateToRfi(item)} disabled={busy}><Wrench size={14}/>{t.createRfi}</button>}{canEdit && item.status !== "verified" && <button type="button" onClick={() => advance(item)} disabled={busy} aria-label={`${statuses[statuses.indexOf(item.status) + 1] === "verified" ? t.verify : item.status === "open" ? t.markProgress : t.markResolved}: ${item.title}`}><Check size={15} />{item.status === "open" ? t.markProgress : item.status === "resolved" ? t.verify : t.markResolved}</button>}</div>
              {duePassed && <span className="field-issue-overdue">{t.due}: {formatDate(item.due_date, localeTag)}</span>}
            </article>;
          })}
        </div>
      )}
      {offlineDrafts.length>0&&<section className="field-issue-pending"><b>{t.pending} · {offlineDrafts.length}</b>{offlineDrafts.map((draft)=><span key={draft.id}>{draft.payload.title} · {draft.files?.length||0}</span>)}{navigator.onLine&&<button type="button" onClick={()=>void syncOfflineDrafts()} disabled={busy}><Check size={14}/>{locale==="ar"?"مزامنة الآن":locale==="fr"?"Synchroniser":"Sync now"}</button>}</section>}
    </main>
  );
}
