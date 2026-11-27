import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { AlertCircle, Clock3, Download, FileText, FolderOpen, LoaderCircle, Plus, Search, UploadCloud, X } from "lucide-react";
import "./documents.css";

const BUCKET = "chantier-documents";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MIME_TYPES = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const accept = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";

const copy = {
  ar: { title: "وثائق المشروع", subtitle: "احتفظ بالمخططات والمواصفات وإصداراتها في مساحة خاصة بكل مشروع.", add: "رفع وثيقة", project: "المشروع", allProjects: "كل المشاريع", search: "ابحث عن وثيقة…", titleField: "اسم الوثيقة", description: "ملاحظة (اختيارية)", file: "الملف", chooseFile: "اختر ملفاً", save: "رفع وحفظ", cancel: "إلغاء", loading: "جارٍ تحميل الوثائق…", saving: "جارٍ الرفع…", none: "لا توجد وثائق محفوظة بعد.", emptyHelp: "ارفع أول مخطط أو مواصفة ليحفظها فريقك بأمان.", noProject: "أنشئ مشروعاً أولاً لإضافة وثائقه.", noWorkspace: "لا توجد مساحة عمل مرتبطة بهذا الحساب.", preview: "الوثائق التجريبية لا تُرفع إلى الخادم. سجّل الدخول لرفع ملفات حقيقية.", readOnly: "يمكنك مشاهدة الوثائق وتنزيلها، لكن صلاحيتك لا تسمح برفع ملفات.", loadError: "تعذر تحميل الوثائق. تحقق من الاتصال والصلاحية.", uploadError: "تعذر حفظ الملف. لم يُسجل إصدار ناقص؛ حاول مجدداً.", sizeError: "حجم الملف يتجاوز 25 ميغابايت.", typeError: "نوع الملف غير مدعوم. استخدم PDF أو صورة أو Word أو Excel.", titleError: "أدخل اسم الوثيقة واختر ملفاً صالحاً.", versions: "الإصدارات", version: "الإصدار", latest: "الأحدث", open: "فتح / تنزيل", addVersion: "رفع إصدار جديد", versionReady: "أصبح رابط التنزيل جاهزاً لمدة خمس دقائق.", versionUploaded: "حُفظ إصدار جديد.", documentUploaded: "رُفعت الوثيقة.", noVersions: "لا توجد إصدارات محفوظة.", noSearch: "لا توجد وثائق تطابق البحث.", previewLabel: "لا تُرفع ملفاتك إلى مساحة العرض التجريبية." },
  fr: { title: "Documents du projet", subtitle: "Conservez plans, spécifications et versions dans l’espace privé de chaque projet.", add: "Ajouter un document", project: "Projet", allProjects: "Tous les projets", search: "Rechercher un document…", titleField: "Nom du document", description: "Note (facultative)", file: "Fichier", chooseFile: "Choisir un fichier", save: "Envoyer", cancel: "Annuler", loading: "Chargement des documents…", saving: "Envoi…", none: "Aucun document enregistré.", emptyHelp: "Ajoutez le premier plan ou la première spécification de votre équipe.", noProject: "Créez un projet avant d’ajouter des documents.", noWorkspace: "Aucun espace de travail n’est associé à ce compte.", preview: "Les documents de démonstration ne sont pas envoyés au serveur. Connectez-vous pour stocker de vrais fichiers.", readOnly: "Vous pouvez consulter les documents, mais votre rôle ne permet pas d’envoyer des fichiers.", loadError: "Impossible de charger les documents. Vérifiez la connexion et les droits.", uploadError: "Impossible d’enregistrer le fichier. Aucun document incomplet n’a été validé.", sizeError: "Le fichier dépasse 25 Mo.", typeError: "Format non pris en charge. Utilisez PDF, image, Word ou Excel.", titleError: "Saisissez un nom et choisissez un fichier valide.", versions: "Versions", version: "Version", latest: "Dernière", open: "Ouvrir / télécharger", addVersion: "Ajouter une version", versionReady: "Le lien est disponible pendant cinq minutes.", versionUploaded: "Nouvelle version enregistrée.", documentUploaded: "Document envoyé.", noVersions: "Aucune version enregistrée.", noSearch: "Aucun document ne correspond à la recherche.", previewLabel: "Aucun fichier n’est envoyé depuis l’aperçu." },
  en: { title: "Project documents", subtitle: "Keep drawings, specifications, and their versions in each project’s private workspace.", add: "Add document", project: "Project", allProjects: "All projects", search: "Search documents…", titleField: "Document name", description: "Note (optional)", file: "File", chooseFile: "Choose a file", save: "Upload and save", cancel: "Cancel", loading: "Loading documents…", saving: "Uploading…", none: "No documents saved yet.", emptyHelp: "Upload your team’s first drawing or specification.", noProject: "Create a project before adding its documents.", noWorkspace: "No workspace is linked to this account.", preview: "Demo documents are not uploaded to the server. Sign in to store real files.", readOnly: "You can view and download documents, but your role cannot upload files.", loadError: "Could not load documents. Check your connection and access.", uploadError: "Could not save the file. No incomplete version was recorded.", sizeError: "The file exceeds 25 MB.", typeError: "Unsupported file type. Use PDF, image, Word, or Excel.", titleError: "Enter a document name and choose a valid file.", versions: "Versions", version: "Version", latest: "Latest", open: "Open / download", addVersion: "Upload new version", versionReady: "The link is ready for five minutes.", versionUploaded: "New version saved.", documentUploaded: "Document uploaded.", noVersions: "No saved versions.", noSearch: "No documents match your search.", previewLabel: "Files are not uploaded from the demo workspace." },
};

function humanSize(value, locale) {
  if (!value) return "—";
  return new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en", { style: "unit", unit: "megabyte", maximumFractionDigits: 1 }).format(value / 1048576);
}

function dateLabel(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en-GB", { dateStyle: "medium" }).format(date);
}

function safeFileName(name) {
  const cleaned = String(name || "document").replace(/[\\/\\?%*:|"<>\u0000-\u001f]/g, "_").trim().slice(-180);
  return cleaned || "document";
}

function countLabel(count, locale) {
  if (locale === "ar") return `${new Intl.NumberFormat("ar-DZ").format(count)} ملف`;
  if (locale === "fr") return `${count} ${count === 1 ? "fichier" : "fichiers"}`;
  return `${count} ${count === 1 ? "file" : "files"}`;
}

export default function DocumentsWorkspace({ locale, projects, projectName, workspaceId, user, workspaceRole }) {
  const t = copy[locale] || copy.en;
  const isPreview = !user;
  const canUpload = Boolean(user && workspaceId && ["owner", "editor"].includes(workspaceRole));
  const [documents, setDocuments] = useState([]);
  const [versions, setVersions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [readyLink, setReadyLink] = useState(null);
  const [versionTarget, setVersionTarget] = useState("");
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!user || !workspaceId || !supabase) {
      setDocuments([]); setVersions([]); setLoading(false);
      if (user && !workspaceId) setError(t.noWorkspace);
      return;
    }
    setLoading(true); setError("");
    try {
      const { data: docs, error: docError } = await supabase.from("project_documents")
        .select("id,workspace_id,project_id,title,description,created_by,created_at")
        .eq("workspace_id", workspaceId).order("created_at", { ascending: false });
      if (docError) throw docError;
      const items = docs || [];
      let versionItems = [];
      if (items.length) {
        const result = await supabase.from("project_document_versions")
          .select("id,document_id,workspace_id,project_id,version_number,file_name,storage_path,mime_type,size_bytes,uploaded_by,created_at")
          .in("document_id", items.map((item) => item.id)).order("version_number", { ascending: false });
        if (result.error) throw result.error;
        versionItems = result.data || [];
      }
      setDocuments(items); setVersions(versionItems);
      setSelectedId((current) => items.some((item) => item.id === current) ? current : items[0]?.id || "");
    } catch {
      setError(t.loadError);
    } finally { setLoading(false); }
  }, [user, workspaceId, t.loadError, t.noWorkspace]);

  useEffect(() => { void load(); }, [load]);

  const selected = documents.find((item) => item.id === selectedId) || null;
  const selectedVersions = versions.filter((item) => item.document_id === selectedId).sort((a, b) => b.version_number - a.version_number);
  const visible = useMemo(() => documents.filter((item) => {
    const matchProject = projectFilter === "all" || item.project_id === projectFilter;
    const name = `${item.title} ${item.description || ""} ${projectName(projects.find((p) => p.id === item.project_id)) || ""}`.toLocaleLowerCase();
    return matchProject && name.includes(query.trim().toLocaleLowerCase());
  }), [documents, projectFilter, query, projectName, projects]);

  const validateFile = (candidate) => {
    if (!candidate || !MIME_TYPES.has(candidate.type)) { setError(t.typeError); return false; }
    if (candidate.size < 1 || candidate.size > MAX_FILE_SIZE) { setError(t.sizeError); return false; }
    return true;
  };

  const uploadNew = async (event) => {
    event.preventDefault(); setError(""); setNotice(""); setReadyLink(null);
    const chosenProjectId = projectId || projects[0]?.id || "";
    if (!canUpload || !chosenProjectId || !title.trim() || !file) { setError(t.titleError); return; }
    if (!validateFile(file)) return;
    setBusy(true);
    const documentId = crypto.randomUUID();
    const path = `${workspaceId}/${chosenProjectId}/${documentId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    try {
      const { error: storageError } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "60", upsert: false, contentType: file.type });
      if (storageError) throw storageError;
      const { error: registerError } = await supabase.rpc("register_project_document", {
        p_document_id: documentId, p_workspace_id: workspaceId, p_project_id: chosenProjectId,
        p_title: title.trim(), p_description: description.trim(), p_file_name: safeFileName(file.name),
        p_storage_path: path, p_mime_type: file.type, p_size_bytes: file.size,
      });
      if (registerError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw registerError;
      }
      setCreating(false); setTitle(""); setDescription(""); setFile(null); setNotice(t.documentUploaded);
      await load(); setSelectedId(documentId);
    } catch { setError(t.uploadError); }
    finally { setBusy(false); }
  };

  const uploadVersion = async (candidate, document) => {
    setError(""); setNotice(""); setReadyLink(null);
    if (!canUpload || !document || !validateFile(candidate)) return;
    setBusy(true);
    const path = `${document.workspace_id}/${document.project_id}/${document.id}/${crypto.randomUUID()}-${safeFileName(candidate.name)}`;
    try {
      const { error: storageError } = await supabase.storage.from(BUCKET).upload(path, candidate, { cacheControl: "60", upsert: false, contentType: candidate.type });
      if (storageError) throw storageError;
      const { error: versionError } = await supabase.rpc("append_project_document_version", {
        p_document_id: document.id, p_file_name: safeFileName(candidate.name), p_storage_path: path,
        p_mime_type: candidate.type, p_size_bytes: candidate.size,
      });
      if (versionError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw versionError;
      }
      setNotice(t.versionUploaded); await load();
    } catch { setError(t.uploadError); }
    finally { setBusy(false); setVersionTarget(""); if (fileRef.current) fileRef.current.value = ""; }
  };

  const openVersion = async (version) => {
    setError(""); setNotice(""); setReadyLink(null); setBusy(true);
    try {
      const { data, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(version.storage_path, 300, { download: version.file_name });
      if (signedError || !data?.signedUrl) throw signedError || new Error("signed_url_missing");
      setReadyLink({ url: data.signedUrl, name: version.file_name }); setNotice(t.versionReady);
    } catch { setError(t.loadError); }
    finally { setBusy(false); }
  };

  const projectLabel = (id) => projectName(projects.find((project) => project.id === id)) || t.project;

  return <section className="documents-page" dir={locale === "ar" ? "rtl" : "ltr"} aria-labelledby="documents-title">
    <div className="documents-heading">
      <span className="documents-heading-icon"><FolderOpen size={21}/></span>
      <div><span className="documents-eyebrow">{t.project}</span><h1 id="documents-title">{t.title}</h1><p>{t.subtitle}</p></div>
      {canUpload && <button type="button" className="button button-primary" onClick={() => { setCreating((value) => !value); setError(""); setNotice(""); }}><Plus size={16}/>{t.add}</button>}
    </div>
    {isPreview && <p className="documents-notice">{t.preview}</p>}
    {user && workspaceId && !canUpload && <p className="documents-notice">{t.readOnly}</p>}
    {error && <p className="documents-message is-error" role="alert"><AlertCircle size={15}/>{error}</p>}
    {notice && <p className="documents-message is-success" role="status">{notice}</p>}

    {creating && <form className="documents-upload panel" onSubmit={uploadNew}>
      <div className="documents-upload-head"><div><h2>{t.add}</h2><p>{t.previewLabel}</p></div><button type="button" className="icon-button" aria-label={t.cancel} onClick={() => setCreating(false)}><X size={17}/></button></div>
      {!projects.length ? <p>{t.noProject}</p> : <>
        <div className="documents-form-grid">
          <label>{t.project}<select value={projectId || projects[0]?.id || ""} onChange={(event) => setProjectId(event.target.value)} required>{projects.map((project) => <option key={project.id} value={project.id}>{projectName(project)}</option>)}</select></label>
          <label>{t.titleField}<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required autoFocus/></label>
          <label>{t.file}<input type="file" accept={accept} onChange={(event) => { setFile(event.target.files?.[0] || null); setError(""); }}/><small>{file ? `${file.name} · ${humanSize(file.size, locale)}` : `${t.chooseFile} · 25 MB`}</small></label>
          <label>{t.description}<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000}/></label>
        </div>
        <div className="documents-form-actions"><button type="button" className="button button-white" onClick={() => setCreating(false)}>{t.cancel}</button><button type="submit" className="button button-primary" disabled={busy}><UploadCloud size={15}/>{busy ? t.saving : t.save}</button></div>
      </>}
    </form>}

    <div className="documents-toolbar">
      <label className="documents-search"><Search size={16}/><input aria-label={t.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search}/></label>
      <label className="documents-project-filter"><span>{t.project}</span><select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">{t.allProjects}</option>{projects.map((project) => <option key={project.id} value={project.id}>{projectName(project)}</option>)}</select></label>
    </div>

    {loading ? <div className="documents-state"><LoaderCircle className="documents-spinner" size={19}/>{t.loading}</div> : documents.length === 0 ? <div className="documents-empty panel"><span><FileText size={25}/></span><h2>{t.none}</h2><p>{isPreview ? t.previewLabel : t.emptyHelp}</p>{canUpload && projects.length > 0 && <button className="button button-primary" onClick={() => setCreating(true)}><Plus size={15}/>{t.add}</button>}</div> : visible.length === 0 ? <div className="documents-state">{t.noSearch}</div> : <div className="documents-columns">
      <div className="documents-list" aria-label={t.title}>{visible.map((item) => {
        const latest = versions.filter((version) => version.document_id === item.id).reduce((top, version) => !top || version.version_number > top.version_number ? version : top, null);
        return <button className={`documents-list-item ${item.id === selectedId ? "is-active" : ""}`} key={item.id} type="button" onClick={() => { setSelectedId(item.id); setReadyLink(null); setError(""); }}>
          <span className="documents-file-icon"><FileText size={19}/></span><span className="documents-list-copy"><b>{item.title}</b><small>{projectLabel(item.project_id)}</small><small>{latest ? `${t.version} ${latest.version_number} · ${dateLabel(latest.created_at, locale)}` : t.noVersions}</small></span><span className="documents-list-arrow">›</span>
        </button>;
      })}</div>
      {selected ? <article className="documents-detail panel">
        <header className="documents-detail-header"><div className="documents-detail-icon"><FileText size={21}/></div><div><span className="documents-eyebrow">{projectLabel(selected.project_id)}</span><h2>{selected.title}</h2>{selected.description && <p>{selected.description}</p>}</div></header>
        <div className="documents-version-header"><div><h3>{t.versions}</h3><p>{countLabel(selectedVersions.length, locale)}</p></div>{canUpload && <button type="button" className="button button-white" disabled={busy} onClick={() => { setVersionTarget(selected.id); fileRef.current?.click(); }}><Plus size={15}/>{t.addVersion}</button>}</div>
        {selectedVersions.length ? <ol className="documents-version-list">{selectedVersions.map((version, index) => <li key={version.id}>
          <span className="documents-version-number">v{version.version_number}</span><div className="documents-version-copy"><b>{version.file_name}</b><small><Clock3 size={12}/>{dateLabel(version.created_at, locale)} · {humanSize(version.size_bytes, locale)} · {version.uploaded_by === user?.id ? user.email : ""}</small></div>{index === 0 && <span className="documents-latest">{t.latest}</span>}<button type="button" className="documents-open" disabled={busy} aria-label={`${t.open}: ${version.file_name}`} onClick={() => void openVersion(version)}><Download size={15}/><span>{t.open}</span></button>
        </li>)}</ol> : <p className="documents-state">{t.noVersions}</p>}
        {readyLink && <a className="documents-ready-link" href={readyLink.url} target="_blank" rel="noopener noreferrer" download={readyLink.name}><Download size={14}/>{t.open}: {readyLink.name}</a>}
      </article> : <div className="documents-state panel">{t.noSearch}</div>}
    </div>}

    <input ref={fileRef} className="documents-hidden-file" type="file" accept={accept} aria-label={t.addVersion} onChange={(event) => { const candidate = event.target.files?.[0]; if (candidate && versionTarget) void uploadVersion(candidate, documents.find((item) => item.id === versionTarget)); }}/>
  </section>;
}
