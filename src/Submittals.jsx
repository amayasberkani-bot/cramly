import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck, FileCheck2, LoaderCircle, Plus, RotateCcw, X } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import "./submittals.css";

const copy = {
  ar: {
    title: "الاعتمادات والمواد", subtitle: "سجل المواد والمعدات التي تحتاج مراجعة قبل اعتمادها للمشروع.", create: "طلب اعتماد جديد", reference: "المرجع", name: "المادة أو المعدّة", project: "المشروع", description: "المواصفات أو الملاحظات", reviewer: "المراجع (اختياري)", due: "موعد المراجعة", unassigned: "غير معيّن", save: "إرسال للمراجعة", cancel: "إلغاء", loading: "جارٍ تحميل طلبات الاعتماد…", loadError: "تعذر تحميل طلبات الاعتماد.", saveError: "تعذر حفظ الطلب. تحقق من الاتصال والصلاحية.", noProjects: "أنشئ مشروعاً أولاً.", empty: "لا توجد طلبات اعتماد بعد.", start: "إنشاء أول طلب اعتماد", all: "الكل", submitted: "مرسل للمراجعة", under_review: "قيد المراجعة", approved: "معتمد", revise_resubmit: "يحتاج تعديل وإعادة إرسال", rejected: "مرفوض", cancelled: "ملغي", approve: "اعتماد", revise: "طلب تعديل", reject: "رفض", comment: "ملاحظة للمراجع", reviewerComment: "اكتب سبب القرار أو ملاحظتك", commentRequired: "أضف ملاحظة مع قرار المراجعة.", noPermission: "صلاحية المشاهدة فقط.", preview: "معاينة محلية — تحفظ الطلبات على هذا الجهاز فقط.", createSuccess: "تم إرسال طلب الاعتماد.", reviewSuccess: "تم حفظ قرار المراجعة.", refRequired: "أدخل المرجع واسم المادة أو المعدّة.", status: "الحالة", created: "تاريخ الإرسال",
  },
  fr: {
    title: "Approbations et matériaux", subtitle: "Suivez les matériaux et équipements à examiner avant leur validation.", create: "Nouvelle demande d’approbation", reference: "Référence", name: "Matériau ou équipement", project: "Projet", description: "Spécifications ou notes", reviewer: "Réviseur (facultatif)", due: "Échéance de révision", unassigned: "Non attribué", save: "Soumettre pour révision", cancel: "Annuler", loading: "Chargement des demandes…", loadError: "Impossible de charger les demandes.", saveError: "Impossible d’enregistrer. Vérifiez les droits et réessayez.", noProjects: "Créez d’abord un projet.", empty: "Aucune demande d’approbation.", start: "Créer la première demande", all: "Tout", submitted: "Soumis", under_review: "En cours de révision", approved: "Approuvé", revise_resubmit: "À modifier et resoumettre", rejected: "Refusé", cancelled: "Annulé", approve: "Approuver", revise: "Demander une modification", reject: "Refuser", comment: "Note de révision", reviewerComment: "Motif de la décision ou commentaire", commentRequired: "Ajoutez une note avec la décision.", noPermission: "Accès en lecture seule.", preview: "Aperçu local — demandes conservées sur cet appareil.", createSuccess: "Demande soumise.", reviewSuccess: "Décision enregistrée.", refRequired: "Saisissez la référence et le nom du matériau ou équipement.", status: "Statut", created: "Date d’envoi",
  },
  en: {
    title: "Submittals & approvals", subtitle: "Track materials and equipment that need review before they are approved for a project.", create: "New submittal", reference: "Reference", name: "Material or equipment", project: "Project", description: "Specifications or notes", reviewer: "Reviewer (optional)", due: "Review due", unassigned: "Unassigned", save: "Submit for review", cancel: "Cancel", loading: "Loading submittals…", loadError: "Could not load submittals.", saveError: "Could not save. Check access and try again.", noProjects: "Create a project first.", empty: "No submittals yet.", start: "Create the first submittal", all: "All", submitted: "Submitted", under_review: "Under review", approved: "Approved", revise_resubmit: "Revise and resubmit", rejected: "Rejected", cancelled: "Cancelled", approve: "Approve", revise: "Request revision", reject: "Reject", comment: "Review note", reviewerComment: "Decision reason or review comment", commentRequired: "Add a note with the review decision.", noPermission: "Read-only access.", preview: "Local preview — requests stay on this device.", createSuccess: "Submittal sent for review.", reviewSuccess: "Review decision saved.", refRequired: "Enter a reference and a material or equipment name.", status: "Status", created: "Submitted",
  },
};

const statusOrder = ["submitted", "under_review", "revise_resubmit", "approved", "rejected", "cancelled"];
const canTransition = (status) => ["submitted", "under_review", "revise_resubmit"].includes(status);
const localId = () => globalThis.crypto?.randomUUID?.() || ("sub-" + Date.now() + "-" + Math.random().toString(16).slice(2));
function readPreview() {
  try { const value = JSON.parse(localStorage.getItem("chantier-preview-submittals") || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function formatDate(value, locale) {
  if (!value) return "—";
  const date = new Date(String(value).slice(0, 10) + "T12:00:00");
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en-GB", { dateStyle: "medium" }).format(date);
}

export default function SubmittalsWorkspace({ locale = "ar", projects = [], projectName, workspaceId, user, workspaceRole }) {
  const t = copy[locale] || copy.en;
  const preview = !user;
  const canCreate = preview || ["owner", "editor"].includes(workspaceRole);
  const isOwner = workspaceRole === "owner";
  const [items, setItems] = useState(() => preview ? readPreview() : []);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [members, setMembers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [form, setForm] = useState({ project_id: projects[0]?.id || "", reference_code: "", title: "", description: "", reviewer_id: "", due_date: "" });
  const load = useCallback(async () => {
    if (preview) { setItems(readPreview()); setLoading(false); return; }
    if (!workspaceId || !supabase) { setItems([]); setLoading(false); setError(t.loadError); return; }
    setLoading(true); setError("");
    const [submittals, workspaceMembers] = await Promise.all([
      supabase.from("project_submittals").select("id,workspace_id,project_id,reference_code,title,description,reviewer_id,due_date,status,created_at,updated_at,created_by").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.rpc("list_workspace_members", { p_workspace_id: workspaceId }),
    ]);
    if (submittals.error) setError(t.loadError); else setItems(submittals.data || []);
    setMembers(workspaceMembers.error ? [] : workspaceMembers.data || []);
    setLoading(false);
  }, [preview, workspaceId, t.loadError]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (preview) localStorage.setItem("chantier-preview-submittals", JSON.stringify(items)); }, [items, preview]);
  const visible = useMemo(() => items.filter((item) => filter === "all" || item.status === filter), [items, filter]);
  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const projectTitle = (id) => projectName?.(projects.find((project) => project.id === id)) || projects.find((project) => project.id === id)?.name || "—";
  const submit = async (event) => {
    event.preventDefault(); setError(""); setNotice("");
    if (!form.reference_code.trim() || !form.title.trim()) { setError(t.refRequired); return; }
    if (!form.project_id) { setError(t.noProjects); return; }
    setBusy(true);
    try {
      if (preview) {
        const item = { ...form, id: localId(), status: "submitted", created_at: new Date().toISOString(), created_by: "preview" };
        setItems((current) => [item, ...current]);
      } else {
        const { error: rpcError } = await supabase.rpc("create_project_submittal", { p_workspace_id: workspaceId, p_project_id: form.project_id, p_reference_code: form.reference_code.trim(), p_title: form.title.trim(), p_description: form.description.trim(), p_reviewer_id: form.reviewer_id || null, p_due_date: form.due_date || null });
        if (rpcError) throw rpcError;
        await load();
      }
      setNotice(t.createSuccess); setShowForm(false); setForm({ project_id: projects[0]?.id || "", reference_code: "", title: "", description: "", reviewer_id: "", due_date: "" });
    } catch { setError(t.saveError); }
    finally { setBusy(false); }
  };
  const review = async () => {
    if (!selected || !decision) return;
    if (!reviewNote.trim()) { setError(t.commentRequired); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      if (preview) setItems((current) => current.map((item) => item.id === selected.id ? { ...item, status: decision, review_note: reviewNote.trim(), updated_at: new Date().toISOString() } : item));
      else {
        const { error: rpcError } = await supabase.rpc("review_project_submittal", { p_submittal_id: selected.id, p_decision: decision, p_comment: reviewNote.trim() });
        if (rpcError) throw rpcError;
        await load();
      }
      setSelected(null); setDecision(""); setReviewNote(""); setNotice(t.reviewSuccess);
    } catch { setError(t.saveError); }
    finally { setBusy(false); }
  };
  const canReview = (item) => canCreate && canTransition(item.status) && (preview || isOwner || item.reviewer_id === user?.id);
  return <section className="submittals-workspace" aria-labelledby="submittals-title">
    <header className="submittals-header"><div className="submittals-title"><span className="submittals-title-icon"><FileCheck2 size={20}/></span><div><h1 id="submittals-title">{t.title}</h1><p>{t.subtitle}</p></div></div>{canCreate && projects.length > 0 && <button type="button" className="button button-primary" onClick={() => { setShowForm((value) => !value); setError(""); }}><Plus size={16}/>{t.create}</button>}</header>
    {preview && <p className="submittals-preview"><ClipboardCheck size={14}/>{t.preview}</p>}
    {error && <div className="submittals-message is-error" role="alert">{error}</div>}{notice && <div className="submittals-message is-success" role="status">{notice}</div>}
    {showForm && <form className="submittals-form" onSubmit={submit}><div className="submittals-form-grid">
      <label>{t.project}<select value={form.project_id} onChange={(event) => updateForm("project_id", event.target.value)} required>{projects.map((project) => <option key={project.id} value={project.id}>{projectTitle(project.id)}</option>)}</select></label>
      <label>{t.reference}<input value={form.reference_code} onChange={(event) => updateForm("reference_code", event.target.value)} maxLength={40} required/></label>
      <label>{t.name}<input value={form.title} onChange={(event) => updateForm("title", event.target.value)} maxLength={180} required/></label>
      <label>{t.due}<input type="date" value={form.due_date} onChange={(event) => updateForm("due_date", event.target.value)}/></label>
      <label className="submittals-wide">{t.reviewer}<select value={form.reviewer_id} onChange={(event) => updateForm("reviewer_id", event.target.value)}><option value="">{t.unassigned}</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name || member.email}</option>)}</select></label>
      <label className="submittals-wide">{t.description}<textarea rows="3" maxLength={4000} value={form.description} onChange={(event) => updateForm("description", event.target.value)}/></label>
    </div><div className="submittals-form-actions"><button type="button" className="button button-white" onClick={() => setShowForm(false)}>{t.cancel}</button><button type="submit" className="button button-primary" disabled={busy}>{busy && <LoaderCircle size={15} className="submittals-spin"/>}{t.save}</button></div></form>}
    <div className="submittals-filters" role="group" aria-label={t.status}>{["all", ...statusOrder].map((status) => <button key={status} type="button" className={filter === status ? "is-selected" : ""} onClick={() => setFilter(status)}>{status === "all" ? t.all : t[status]}</button>)}</div>
    {loading ? <div className="submittals-empty"><LoaderCircle className="submittals-spin"/>{t.loading}</div> : visible.length ? <div className="submittals-list">{visible.map((item) => <article className="submittal-card" key={item.id}>
      <div className="submittal-card-top"><span className="submittal-ref">{item.reference_code}</span><span className={"submittal-status status-" + item.status}>{t[item.status] || item.status}</span></div>
      <h2>{item.title}</h2><p className="submittal-project">{t.project}: {projectTitle(item.project_id)}</p>{item.description && <p className="submittal-description">{item.description}</p>}
      <div className="submittal-meta"><span>{t.created}: {formatDate(item.created_at, locale)}</span>{item.due_date && <span>{t.due}: {formatDate(item.due_date, locale)}</span>}</div>
      {item.review_note && <p className="submittal-review-note">{item.review_note}</p>}
      {canReview(item) && <div className="submittal-actions"><button type="button" className="submittal-action approve" onClick={() => { setSelected(item); setDecision("approved"); setReviewNote(""); }}><Check size={14}/>{t.approve}</button><button type="button" className="submittal-action revise" onClick={() => { setSelected(item); setDecision("revise_resubmit"); setReviewNote(""); }}><RotateCcw size={14}/>{t.revise}</button><button type="button" className="submittal-action reject" onClick={() => { setSelected(item); setDecision("rejected"); setReviewNote(""); }}><X size={14}/>{t.reject}</button></div>}
    </article>)}</div> : <div className="submittals-empty"><FileCheck2 size={26}/><p>{projects.length === 0 ? t.noProjects : t.empty}</p>{canCreate && projects.length > 0 && <button type="button" className="button button-primary" onClick={() => setShowForm(true)}>{t.start}</button>}</div>}
    {selected && <div className="submittal-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="submittal-dialog" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title"><button type="button" className="submittal-dialog-close" aria-label={t.cancel} onClick={() => setSelected(null)}><X size={18}/></button><h2 id="review-dialog-title">{t[decision]}</h2><p>{selected.reference_code} · {selected.title}</p><label>{t.comment}<textarea rows="4" maxLength={2000} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder={t.reviewerComment}/></label><div className="submittals-form-actions"><button type="button" className="button button-white" onClick={() => setSelected(null)}>{t.cancel}</button><button type="button" className="button button-primary" disabled={busy} onClick={review}>{busy && <LoaderCircle size={15} className="submittals-spin"/>}{t[decision]}</button></div></section></div>}
  </section>;
}
