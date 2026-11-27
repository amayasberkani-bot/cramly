import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarClock, Check, CircleDollarSign, ClipboardList, LoaderCircle, Plus, X } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import "./change-orders.css";

const copy = {
  ar: {
    title:"أوامر التغيير", subtitle:"وثّق تغييرات النطاق وأثرها المالي والزمني قبل اعتمادها.", add:"طلب تغيير جديد", ref:"المرجع", subject:"عنوان التغيير", reason:"سبب التغيير ونطاقه", project:"المشروع", amount:"الأثر المالي (دج)", days:"الأثر الزمني (أيام)", create:"إرسال للمراجعة", cancel:"إلغاء", empty:"لا توجد طلبات تغيير بعد.", noProjects:"أنشئ مشروعًا أولًا.", all:"الكل", submitted:"بانتظار الاعتماد", approved:"معتمد", rejected:"مرفوض", cancelled:"ملغي", approve:"اعتماد", reject:"رفض", comment:"ملاحظة القرار (اختياري)", reviewer:"قرار المالك", preview:"معاينة محلية — تحفظ البيانات في هذا المتصفح فقط، ولا تُرسل للفريق.", saved:"تم حفظ طلب التغيير.", decided:"تم تحديث القرار.", loadError:"تعذر تحميل أوامر التغيير.", saveError:"تعذر حفظ التغيير. تحقق من الصلاحيات والاتصال.", signIn:"سجّل الدخول لحفظ البيانات المشتركة.", amountRequired:"أدخل عنوانًا وسببًا ومبلغًا صالحًا.", submittedAt:"تاريخ الطلب", impact:"الأثر", schedule:"المدة", loading:"جارٍ التحميل…", noMatch:"لا توجد طلبات في هذا المرشح.", ownerOnly:"اعتماد أو رفض الطلب متاح لمالك مساحة العمل فقط.", status:"الحالة"
  },
  fr: {
    title:"Ordres de changement", subtitle:"Documentez les changements de portée et leurs impacts avant approbation.", add:"Nouvelle demande", ref:"Référence", subject:"Objet du changement", reason:"Motif et portée", project:"Projet", amount:"Impact financier (DZD)", days:"Impact planning (jours)", create:"Soumettre pour approbation", cancel:"Annuler", empty:"Aucune demande de changement.", noProjects:"Créez d’abord un projet.", all:"Tout", submitted:"En attente d’approbation", approved:"Approuvé", rejected:"Refusé", cancelled:"Annulé", approve:"Approuver", reject:"Refuser", comment:"Note de décision (facultative)", reviewer:"Décision du propriétaire", preview:"Aperçu local — données enregistrées dans ce navigateur uniquement, non partagées.", saved:"Demande enregistrée.", decided:"Décision mise à jour.", loadError:"Impossible de charger les demandes.", saveError:"Enregistrement impossible. Vérifiez l’accès et la connexion.", signIn:"Connectez-vous pour enregistrer des données partagées.", amountRequired:"Indiquez un objet, un motif et un montant valide.", submittedAt:"Date", impact:"Impact", schedule:"Durée", loading:"Chargement…", noMatch:"Aucune demande pour ce filtre.", ownerOnly:"Seul le propriétaire de l’espace peut approuver ou refuser.", status:"Statut"
  },
  en: {
    title:"Change orders", subtitle:"Record scope changes and their cost and schedule impact before approval.", add:"New change request", ref:"Reference", subject:"Change title", reason:"Reason and scope", project:"Project", amount:"Cost impact (DZD)", days:"Schedule impact (days)", create:"Submit for approval", cancel:"Cancel", empty:"No change requests yet.", noProjects:"Create a project first.", all:"All", submitted:"Awaiting approval", approved:"Approved", rejected:"Rejected", cancelled:"Cancelled", approve:"Approve", reject:"Reject", comment:"Decision note (optional)", reviewer:"Owner decision", preview:"Local preview — saved only in this browser and not shared with the team.", saved:"Change request saved.", decided:"Decision updated.", loadError:"Could not load change orders.", saveError:"Could not save the change. Check access and connection.", signIn:"Sign in to save shared project data.", amountRequired:"Enter a title, reason, and valid amount.", submittedAt:"Submitted", impact:"Impact", schedule:"Schedule", loading:"Loading…", noMatch:"No requests for this filter.", ownerOnly:"Only the workspace owner can approve or reject.", status:"Status"
  }
};

const previewKey = "chantier-preview-change-orders";
const readPreview = () => { try { return JSON.parse(localStorage.getItem(previewKey) || "[]"); } catch { return []; } };
const makeId = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const money = (value, locale) => new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en", { maximumFractionDigits: 0 }).format(Number(value) || 0);
const dateLabel = (value, locale) => value ? new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en-GB", { dateStyle: "medium" }).format(new Date(value)) : "—";

export default function ChangeOrdersWorkspace({ locale = "ar", projects = [], projectName, workspaceId, user, workspaceRole }) {
  const t = copy[locale] || copy.en;
  const preview = !user;
  const isOwner = workspaceRole === "owner";
  const canCreate = preview || ["owner", "editor"].includes(workspaceRole);
  const [items, setItems] = useState(() => preview ? readPreview() : []);
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [form, setForm] = useState({ project_id: projects[0]?.id || "", reference_code:"", title:"", reason:"", amount:"", schedule_days:"0" });

  const load = useCallback(async () => {
    if (preview) { setItems(readPreview()); return; }
    if (!supabase || !workspaceId) { setItems([]); setError(t.saveError); return; }
    setError("");
    const { data, error: queryError } = await supabase.from("project_change_orders")
      .select("id,workspace_id,project_id,reference_code,title,reason,amount,schedule_days,status,created_by,created_at,decision_note")
      .eq("workspace_id", workspaceId).order("created_at", { ascending: false });
    if (queryError) { setError(t.loadError); return; }
    setItems(data || []);
  }, [preview, workspaceId, t.loadError, t.saveError]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!form.project_id && projects[0]?.id) setForm((current) => ({ ...current, project_id: projects[0].id })); }, [projects, form.project_id]);

  const visible = useMemo(() => filter === "all" ? items : items.filter((item) => item.status === filter), [items, filter]);
  const savePreview = (next) => { setItems(next); localStorage.setItem(previewKey, JSON.stringify(next)); };
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const create = async (event) => {
    event.preventDefault(); setError(""); setNotice("");
    const amount = Number(form.amount);
    const scheduleDays = Number(form.schedule_days);
    if (!form.title.trim() || !form.reason.trim() || !Number.isFinite(amount) || amount < 0 || !Number.isInteger(scheduleDays) || scheduleDays < 0) { setError(t.amountRequired); return; }
    setBusy(true);
    try {
      if (preview) {
        const item = { ...form, id: makeId(), workspace_id:"preview", reference_code:form.reference_code.trim() || `CO-${String(items.length + 1).padStart(3,"0")}`, amount, schedule_days:scheduleDays, status:"submitted", created_at:new Date().toISOString(), created_by:"preview" };
        savePreview([item, ...items]);
      } else {
        if (!workspaceId || !supabase) throw new Error("workspace");
        const { error: rpcError } = await supabase.rpc("create_project_change_order", {
          p_workspace_id:workspaceId, p_project_id:form.project_id, p_reference_code:form.reference_code.trim() || null,
          p_title:form.title.trim(), p_reason:form.reason.trim(), p_amount:amount, p_schedule_days:scheduleDays
        });
        if (rpcError) throw rpcError;
        await load();
      }
      setNotice(t.saved); setCreating(false); setForm((current) => ({ ...current, reference_code:"", title:"", reason:"", amount:"", schedule_days:"0" }));
    } catch { setError(t.saveError); }
    finally { setBusy(false); }
  };

  const review = async (item, decision) => {
    setError(""); setNotice(""); setBusy(true);
    try {
      if (preview) {
        savePreview(items.map((row) => row.id === item.id ? { ...row, status:decision, decision_note:decisionNote.trim(), decided_at:new Date().toISOString() } : row));
      } else {
        const { error: rpcError } = await supabase.rpc("review_project_change_order", { p_change_order_id:item.id, p_decision:decision, p_comment:decisionNote.trim() || null });
        if (rpcError) throw rpcError;
        await load();
      }
      setDecisionNote(""); setNotice(t.decided);
    } catch { setError(t.saveError); }
    finally { setBusy(false); }
  };

  const projectLabel = (item) => projectName?.(projects.find((project) => project.id === item.project_id)) || projects.find((project) => project.id === item.project_id)?.name || "—";
  return (
    <main className="change-orders" dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className="change-orders-head">
        <div><span className="change-orders-eyebrow"><CircleDollarSign size={15}/>{t.impact}</span><h1>{t.title}</h1><p>{t.subtitle}</p></div>
        {canCreate && projects.length > 0 && <button className="button button-primary" onClick={() => setCreating((value) => !value)}><Plus size={16}/>{creating ? t.cancel : t.add}</button>}
      </header>
      {preview && <div className="change-orders-preview"><ClipboardList size={16}/>{t.preview}</div>}
      {error && <div className="change-orders-message error" role="alert">{error}</div>}
      {notice && <div className="change-orders-message success" role="status">{notice}</div>}
      {creating && <form className="change-orders-form panel" onSubmit={create}>
        <label>{t.project}<select required value={form.project_id} onChange={(event) => setField("project_id", event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{projectName?.(project) || project.name}</option>)}</select></label>
        <label>{t.ref}<input maxLength={40} value={form.reference_code} onChange={(event) => setField("reference_code", event.target.value)} placeholder="CO-001"/></label>
        <label className="wide">{t.subject}<input required maxLength={180} value={form.title} onChange={(event) => setField("title", event.target.value)}/></label>
        <label className="wide">{t.reason}<textarea required maxLength={4000} rows={3} value={form.reason} onChange={(event) => setField("reason", event.target.value)}/></label>
        <label>{t.amount}<input required type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => setField("amount", event.target.value)}/></label>
        <label>{t.days}<input required type="number" min="0" step="1" inputMode="numeric" value={form.schedule_days} onChange={(event) => setField("schedule_days", event.target.value)}/></label>
        <button className="button button-primary" type="submit" disabled={busy || !projects.length}>{busy ? <LoaderCircle className="co-spin" size={15} /> : <ArrowUpRight size={15} />}{t.create}</button>
      </form>}
      {!projects.length ? <div className="change-orders-empty"><ClipboardList size={22}/><p>{t.noProjects}</p></div> : <>
        <nav className="change-orders-filters" aria-label={t.status}>{["all","submitted","approved","rejected","cancelled"].map((key) => <button key={key} type="button" className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{t[key]}<span>{key === "all" ? items.length : items.filter((item) => item.status === key).length}</span></button>)}</nav>
        {visible.length ? <div className="change-orders-list">{visible.map((item) => <article className="change-order-card panel" key={item.id}>
          <div className="co-main"><div className="co-card-title"><span>{item.reference_code || "—"}</span><h2>{item.title}</h2></div><p>{item.reason}</p><div className="co-meta"><span>{projectLabel(item)}</span><span><CalendarClock size={13}/>{dateLabel(item.created_at, locale)}</span></div></div>
          <div className="co-impacts"><div><small>{t.amount}</small><strong>{money(item.amount, locale)} <i>DZD</i></strong></div><div><small>{t.schedule}</small><strong>{Number(item.schedule_days) || 0} <i>{locale === "ar" ? "يوم" : locale === "fr" ? "j" : "days"}</i></strong></div></div>
          <div className="co-status-wrap"><span className={`co-status status-${item.status}`}>{t[item.status] || t.submitted}</span>{item.decision_note && <small className="co-decision-note">{item.decision_note}</small>}</div>
          {item.status === "submitted" && (preview || isOwner) && <div className="co-review"><label className="sr-only" htmlFor={`co-note-${item.id}`}>{t.comment}</label><input id={`co-note-${item.id}`} value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder={t.comment}/><button className="co-approve" type="button" onClick={() => review(item,"approved")} disabled={busy}><Check size={14}/>{t.approve}</button><button className="co-reject" type="button" onClick={() => review(item,"rejected")} disabled={busy}><X size={14}/>{t.reject}</button></div>}
          {item.status === "submitted" && !preview && !isOwner && <small className="co-owner-note">{t.ownerOnly}</small>}
        </article>)}</div> : <div className="change-orders-empty"><ClipboardList size={22}/><p>{items.length ? t.noMatch : t.empty}</p></div>}
      </>}
    </main>
  );
}
