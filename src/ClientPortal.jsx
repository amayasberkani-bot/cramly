import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, ClipboardList, FileText, Link2, LoaderCircle, MapPin, ShieldCheck } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import "./client-portal.css";

const copy = {
  ar: {
    title: "بوابة العميل", subtitle: "شارك مستجدات المشروع للقراءة فقط، مع تحكمك في المحتوى ومدة الرابط.",
    create: "إنشاء رابط مشاركة", project: "المشروع", expiry: "صلاحية الرابط", days: "يومًا",
    includeLogs: "مشاركة تقارير الموقع", includeDocs: "مشاركة أسماء الوثائق", includeBudget: "إظهار الميزانية المخططة", noBudget: "الميزانية مخفية افتراضيًا", budget: "الميزانية المخططة",
    createSuccess: "تم إنشاء رابط المشاركة.", copy: "نسخ الرابط", copied: "تم نسخ الرابط", revoke: "إلغاء الرابط", revokeSuccess: "تم إلغاء الرابط. لم يعد بإمكان العميل فتحه.",
    loading: "جارٍ تحميل صفحة المشروع…", error: "تعذر فتح صفحة المشروع. قد يكون الرابط غير صالح أو منتهي الصلاحية.",
    createError: "تعذر إنشاء الرابط. تحقّق من صلاحية مالك مساحة العمل.", noProjects: "أنشئ مشروعًا أولًا.",
    ownerOnly: "إنشاء روابط المشاركة متاح لمالك مساحة العمل فقط.",
    previewOnly: "أنشئ رابطًا بعد تسجيل الدخول بحساب مالك مساحة العمل. لا تنشئ المعاينة روابط عامة.",
    viewOnly: "عرض للقراءة فقط", noAccount: "لا تحتاج إلى إنشاء حساب لمشاهدة هذه الصفحة.",
    expires: "ينتهي في", progress: "نسبة الإنجاز", updated: "آخر تحديث", logs: "تقارير الموقع",
    documents: "الوثائق المشتركة", noLogs: "لا توجد تقارير مشتركة.", noDocuments: "لا توجد أسماء وثائق مشتركة.",
    projectUnavailable: "بيانات المشروع غير متاحة.", ownerPortal: "رابط مخصص للعميل",
  },
  fr: {
    title: "Portail client", subtitle: "Partagez les nouvelles du projet en lecture seule, avec contrôle du contenu et de la durée.",
    create: "Créer un lien de partage", project: "Projet", expiry: "Durée du lien", days: "jours",
    includeLogs: "Partager les rapports de chantier", includeDocs: "Partager les noms des documents", includeBudget: "Afficher le budget prévisionnel", noBudget: "Budget masqué par défaut", budget: "Budget prévisionnel",
    createSuccess: "Lien de partage créé.", copy: "Copier le lien", copied: "Lien copié", revoke: "Révoquer le lien", revokeSuccess: "Lien révoqué. Le client ne peut plus l’ouvrir.",
    loading: "Chargement du projet…", error: "Impossible d’ouvrir le projet. Le lien peut être invalide ou expiré.",
    createError: "Impossible de créer le lien. Vérifiez le rôle de propriétaire.", noProjects: "Créez d’abord un projet.",
    ownerOnly: "Seul le propriétaire de l’espace peut créer des liens.",
    previewOnly: "Connectez-vous comme propriétaire pour créer un lien. L’aperçu ne crée pas de lien public.",
    viewOnly: "Consultation uniquement", noAccount: "Aucun compte n’est nécessaire pour consulter cette page.",
    expires: "Expire le", progress: "Avancement", updated: "Dernière mise à jour", logs: "Rapports de chantier",
    documents: "Documents partagés", noLogs: "Aucun rapport partagé.", noDocuments: "Aucun nom de document partagé.",
    projectUnavailable: "Les données du projet ne sont pas disponibles.", ownerPortal: "Lien destiné au client",
  },
  en: {
    title: "Client portal", subtitle: "Share project updates as read-only, with control over content and link duration.",
    create: "Create share link", project: "Project", expiry: "Link duration", days: "days",
    includeLogs: "Share site reports", includeDocs: "Share document names", includeBudget: "Show planned budget", noBudget: "Budget is hidden by default", budget: "Planned budget",
    createSuccess: "Share link created.", copy: "Copy link", copied: "Link copied", revoke: "Revoke link", revokeSuccess: "Link revoked. The client can no longer open it.",
    loading: "Loading project page…", error: "Could not open the project. The link may be invalid or expired.",
    createError: "Could not create the link. Check workspace owner access.", noProjects: "Create a project first.",
    ownerOnly: "Only the workspace owner can create share links.",
    previewOnly: "Sign in as the workspace owner to create a link. Preview mode never creates public links.",
    viewOnly: "Read-only view", noAccount: "No account is needed to view this page.",
    expires: "Expires", progress: "Progress", updated: "Last updated", logs: "Site reports",
    documents: "Shared documents", noLogs: "No reports were shared.", noDocuments: "No document names were shared.",
    projectUnavailable: "Project details are unavailable.", ownerPortal: "Link for your client",
  },
};

function formatDate(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en-GB", { dateStyle: "medium" }).format(date);
}

function displayName(project, projectName) {
  if (!project) return "";
  return projectName?.(project) || project.name || "";
}

function safePortalPayload(data) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const project = row.project && typeof row.project === "object" ? row.project : row;
  const reports = Array.isArray(row.logs) ? row.logs : Array.isArray(row.reports) ? row.reports : [];
  const docs = Array.isArray(row.documents) ? row.documents : [];
  // Only render whitelisted document labels. Never put storage paths or signed URLs in this view.
  return {
    project: {
      name: String(project.name || ""),
      city: String(project.city || ""),
      progress: Number.isFinite(Number(project.progress)) ? Number(project.progress) : null,
      status: String(project.status || ""),
      updated_at: project.updated_at || project.created_at || null,
    },
    budget: row.budget == null ? null : Number.isFinite(Number(row.budget)) ? Number(row.budget) : null,
    expires_at: row.expires_at || null,
    logs: reports.map((item) => ({
      area: String(item.area || item.title || ""),
      activities: String(item.activities || item.description || ""),
      log_date: item.log_date || item.date || null,
    })),
    documents: docs.map((item) => ({
      title: String(item.title || item.file_name || ""),
      created_at: item.created_at || null,
    })),
  };
}

export default function ClientPortal({ locale = "ar", projects = [], projectName, workspaceId, user, workspaceRole, token = "" }) {
  const t = copy[locale] || copy.en;
  const isViewer = Boolean(token);
  const isOwner = Boolean(user && workspaceId && workspaceRole === "owner");
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [days, setDays] = useState("14");
  const [includeLogs, setIncludeLogs] = useState(true);
  const [includeDocuments, setIncludeDocuments] = useState(false);
  const [includeBudget, setIncludeBudget] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(isViewer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPortal = useCallback(async () => {
    if (!token) return;
    if (!supabase) { setError(t.error); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("view_project_portal", { p_token: token });
      if (rpcError) throw rpcError;
      const cleaned = safePortalPayload(data);
      if (!cleaned?.project.name) throw new Error("portal unavailable");
      setPayload(cleaned);
    } catch {
      setError(t.error);
      setPayload(null);
    } finally { setLoading(false); }
  }, [token, t.error]);

  useEffect(() => { void loadPortal(); }, [loadPortal]);
  useEffect(() => {
    if (!projectId && projects[0]?.id) setProjectId(projects[0].id);
  }, [projectId, projects]);

  const createLink = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setShareUrl("");
    if (!isOwner || !projectId || !supabase) { setError(t.createError); return; }
    setBusy(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("create_project_portal_link", {
        p_project_id: projectId,
        p_expires_days: Math.max(1, Math.min(90, Number(days) || 14)),
        p_include_logs: includeLogs,
        p_include_documents: includeDocuments,
        p_include_budget: includeBudget,
      });
      if (rpcError) throw rpcError;
      const secret = typeof data === "string" ? data : data?.token;
      if (!secret || typeof secret !== "string") throw new Error("No portal token returned");
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      url.searchParams.set("portal", secret);
      setShareUrl(url.toString());
      setNotice(t.createSuccess);
    } catch { setError(t.createError); }
    finally { setBusy(false); }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setError(t.createError); }
  };

  const revokeLink = async () => {
    const secret = new URL(shareUrl).searchParams.get("portal");
    if (!secret || !supabase) { setError(t.createError); return; }
    setBusy(true); setError("");
    try {
      const { error: revokeError } = await supabase.rpc("revoke_project_portal_token", { p_token: secret });
      if (revokeError) throw revokeError;
      setShareUrl(""); setNotice(t.revokeSuccess);
    } catch { setError(t.createError); }
    finally { setBusy(false); }
  };

  if (isViewer) {
    return (
      <main className="client-portal client-portal-view" dir={locale === "ar" ? "rtl" : "ltr"}>
        <header className="client-portal-top">
          <div className="client-portal-brand"><span><ShieldCheck size={19}/></span><b>CHANTIER IQ</b></div>
          <span className="client-portal-readonly"><ShieldCheck size={14}/>{t.viewOnly}</span>
        </header>
        {loading && <div className="client-portal-state"><LoaderCircle className="client-portal-spin" size={22}/>{t.loading}</div>}
        {error && <div className="client-portal-state is-error" role="alert">{error}</div>}
        {!loading && payload && <article className="client-portal-card">
          <div className="client-portal-title">
            <span className="client-portal-kicker">{t.ownerPortal}</span>
            <h1>{payload.project.name}</h1>
            {payload.project.city && <p><MapPin size={15}/>{payload.project.city}</p>}
          </div>
          <div className="client-portal-summary">
            {payload.project.progress !== null && <div><small>{t.progress}</small><strong>{new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : locale).format(payload.project.progress)}%</strong><span className="client-portal-progress"><i style={{ width: `${Math.max(0, Math.min(100, payload.project.progress))}%` }}/></span></div>}
            {payload.budget !== null && <div><small>{t.budget}</small><strong>{new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : locale, { maximumFractionDigits: 0 }).format(payload.budget)} DZD</strong></div>}
            <div><small>{t.updated}</small><strong>{formatDate(payload.project.updated_at, locale)}</strong></div>
            {payload.expires_at && <div><small>{t.expires}</small><strong>{formatDate(payload.expires_at, locale)}</strong></div>}
          </div>
          {payload.logs.length > 0 && <section className="client-portal-section">
            <h2><ClipboardList size={17}/>{t.logs}</h2>
            <div className="client-portal-records">{payload.logs.map((item, index) => <article key={`${item.area}-${index}`}><div><b>{item.area || t.logs}</b><time>{formatDate(item.log_date, locale)}</time></div><p>{item.activities}</p></article>)}</div>
          </section>}
          <section className="client-portal-section">
            <h2><FileText size={17}/>{t.documents}</h2>
            {payload.documents.length ? <ul className="client-portal-docs">{payload.documents.map((item, index) => <li key={`${item.title}-${index}`}><FileText size={15}/><span>{item.title}</span>{item.created_at && <time>{formatDate(item.created_at, locale)}</time>}</li>)}</ul> : <p className="client-portal-empty">{t.noDocuments}</p>}
          </section>
          {payload.logs.length === 0 && <p className="client-portal-empty">{t.noLogs}</p>}
          <footer>{t.viewOnly} · {t.noAccount}</footer>
        </article>}
      </main>
    );
  }

  return (
    <section className="client-portal client-portal-owner" dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className="client-portal-heading">
        <span className="client-portal-heading-icon"><Link2 size={20}/></span>
        <div><h1>{t.title}</h1><p>{t.subtitle}</p></div>
      </header>
      {!user && <div className="client-portal-note">{t.previewOnly}</div>}
      {user && !isOwner && <div className="client-portal-note">{t.ownerOnly}</div>}
      {projects.length === 0 && <div className="client-portal-note">{t.noProjects}</div>}
      {isOwner && projects.length > 0 && <form className="client-portal-form" onSubmit={createLink}>
        <label>{t.project}<select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>{projects.map((project) => <option key={project.id} value={project.id}>{displayName(project, projectName)}</option>)}</select></label>
        <label>{t.expiry}<span className="client-portal-expiry"><input type="number" min="1" max="90" value={days} onChange={(event) => setDays(event.target.value)} required/><span>{t.days}</span></span></label>
        <label className="client-portal-check"><input type="checkbox" checked={includeLogs} onChange={(event) => setIncludeLogs(event.target.checked)}/><span>{t.includeLogs}</span></label>
        <label className="client-portal-check"><input type="checkbox" checked={includeDocuments} onChange={(event) => setIncludeDocuments(event.target.checked)}/><span>{t.includeDocs}</span></label>
        <label className="client-portal-check"><input type="checkbox" checked={includeBudget} onChange={(event) => setIncludeBudget(event.target.checked)}/><span>{t.includeBudget}</span></label>
        <p className="client-portal-budget-note"><ShieldCheck size={14}/>{t.noBudget}</p>
        <button className="client-portal-primary" type="submit" disabled={busy || !projectId}>{busy ? <LoaderCircle className="client-portal-spin" size={16}/> : <Link2 size={16}/>}<span>{t.create}</span></button>
      </form>}
      {error && <div className="client-portal-state is-error" role="alert">{error}</div>}
      {notice && <div className="client-portal-state is-success" role="status"><Check size={16}/>{notice}</div>}
      {shareUrl && <div className="client-portal-link-result"><div><b>{t.ownerPortal}</b><span dir="ltr">{shareUrl}</span></div><button type="button" onClick={copyLink}>{copied ? <Check size={15}/> : <Link2 size={15}/>} {copied ? t.copied : t.copy}</button><button type="button" onClick={()=>void revokeLink()} disabled={busy}>{t.revoke}</button></div>}
    </section>
  );
}
