import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Download, LoaderCircle, Plus, Users } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import "./time-clock.css";

const text = {
  ar: {
    title: "ساعات العمل", subtitle: "سجّل ساعات الفرق واربطها بالمشروع أو المهمة لتوضيح تكلفة التنفيذ.",
    preview: "معاينة محلية — تبقى الساعات في هذا المتصفح ولا تُرسل إلى الفريق.",
    project: "المشروع", worker: "اسم العامل أو الفريق", task: "المهمة (اختياري)", none: "بدون مهمة",
    date: "تاريخ العمل", hours: "الساعات", notes: "ملاحظات", save: "تسجيل الساعات", add: "إضافة سجل",
    allProjects: "كل المشاريع", today: "اليوم", week: "هذا الأسبوع", export: "تصدير CSV",
    dailyTotal: "ساعات الفترة", workers: "أفراد مسجّلون", empty: "لا توجد ساعات مسجّلة لهذه الفترة.",
    loading: "جارٍ تحميل الساعات…", loadError: "تعذر تحميل سجلات الوقت.", saveError: "تعذر حفظ السجل. تحقق من الاتصال والصلاحية.",
    success: "تم تسجيل ساعات العمل.", readOnly: "لديك صلاحية قراءة فقط.", noWorkspace: "تحتاج ساعات العمل إلى مساحة عمل متصلة.",
    validation: "أدخل اسم العامل أو الفريق، وحدد المشروع، وسجّل ساعات بين 0 و24.",
  },
  fr: {
    title: "Temps de travail", subtitle: "Suivez les heures des équipes par projet ou tâche pour mieux comprendre le coût d’exécution.",
    preview: "Aperçu local — les heures restent dans ce navigateur et ne sont pas partagées.",
    project: "Projet", worker: "Nom de l’ouvrier ou de l’équipe", task: "Tâche (facultatif)", none: "Sans tâche",
    date: "Date de travail", hours: "Heures", notes: "Notes", save: "Enregistrer les heures", add: "Ajouter une saisie",
    allProjects: "Tous les projets", today: "Aujourd’hui", week: "Cette semaine", export: "Exporter CSV",
    dailyTotal: "Heures de la période", workers: "Personnes enregistrées", empty: "Aucune heure pour cette période.",
    loading: "Chargement des heures…", loadError: "Impossible de charger les feuilles de temps.", saveError: "Impossible d’enregistrer. Vérifiez la connexion et les droits.",
    success: "Heures enregistrées.", readOnly: "Votre accès est en lecture seule.", noWorkspace: "Le suivi du temps nécessite un espace connecté.",
    validation: "Saisissez un nom, choisissez un projet et indiquez entre 0 et 24 heures.",
  },
  en: {
    title: "Work hours", subtitle: "Record crew time against projects or tasks to make labor costs easier to understand.",
    preview: "Local preview — time entries stay in this browser and are not shared with the team.",
    project: "Project", worker: "Worker or crew name", task: "Task (optional)", none: "No task",
    date: "Work date", hours: "Hours", notes: "Notes", save: "Save hours", add: "Add time entry",
    allProjects: "All projects", today: "Today", week: "This week", export: "Export CSV",
    dailyTotal: "Hours in period", workers: "People recorded", empty: "No time entries for this period.",
    loading: "Loading time entries…", loadError: "Could not load time entries.", saveError: "Could not save. Check your connection and access.",
    success: "Work hours recorded.", readOnly: "Your access is read-only.", noWorkspace: "Time tracking requires a connected workspace.",
    validation: "Enter a worker name, choose a project, and record between 0 and 24 hours.",
  },
};

const PREVIEW_KEY = "chantier-preview-time-entries";
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const newId = () => globalThis.crypto?.randomUUID?.() || `time-${Date.now()}-${Math.random().toString(16).slice(2)}`;
function readPreview() {
  try { const rows = JSON.parse(localStorage.getItem(PREVIEW_KEY) || "[]"); return Array.isArray(rows) ? rows : []; }
  catch { return []; }
}
function csvCell(value) {
  const raw = String(value ?? "");
  const safe = /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
function startOfWeek(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function TimeClock({ locale = "ar", projects = [], projectName, workspaceId, user, workspaceRole, tasks = [] }) {
  const t = text[locale] || text.en;
  const preview = !user;
  const canWrite = preview || (Boolean(workspaceId) && ["owner", "editor"].includes(workspaceRole));
  const [items, setItems] = useState(() => preview ? readPreview() : []);
  const [loading, setLoading] = useState(Boolean(user));
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [period, setPeriod] = useState("week");
  const [values, setValues] = useState({ project_id: projects[0]?.id || "", task_id: "", worker_name: "", entry_date: localDate(), hours: "", notes: "" });

  const load = useCallback(async () => {
    if (preview) { setItems(readPreview()); setLoading(false); return; }
    if (!user || !workspaceId || !supabase) { setItems([]); setLoading(false); if (user) setError(t.noWorkspace); return; }
    setLoading(true); setError("");
    try {
      const { data, error: queryError } = await supabase.from("project_time_entries")
        .select("id,workspace_id,project_id,task_id,worker_name,entry_date,hours,notes,created_by,created_at")
        .eq("workspace_id", workspaceId).order("entry_date", { ascending: false }).order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setItems(data || []);
    } catch { setError(t.loadError); }
    finally { setLoading(false); }
  }, [preview, user, workspaceId, t.loadError, t.noWorkspace]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (preview) localStorage.setItem(PREVIEW_KEY, JSON.stringify(items)); }, [items, preview]);
  useEffect(() => { if (!values.project_id && projects[0]) setValues((old) => ({ ...old, project_id: projects[0].id })); }, [projects, values.project_id]);

  const weekStart = startOfWeek(localDate());
  const filtered = useMemo(() => items.filter((item) => {
    const projectMatch = projectFilter === "all" || item.project_id === projectFilter;
    const dateValue = String(item.entry_date || "").slice(0, 10);
    const dateMatch = period === "today" ? dateValue === localDate() : dateValue >= weekStart && dateValue <= localDate();
    return projectMatch && dateMatch;
  }), [items, period, projectFilter, weekStart]);
  const totalHours = filtered.reduce((sum, item) => sum + Number(item.hours || 0), 0);
  const peopleCount = new Set(filtered.map((item) => String(item.worker_name || "").trim().toLocaleLowerCase()).filter(Boolean)).size;
  const projectTitle = (id) => projectName?.(projects.find((project) => project.id === id)) || projects.find((project) => project.id === id)?.name || "—";
  const taskTitle = (id) => tasks.find((task) => task.id === id)?.title || "—";

  const submit = async (event) => {
    event.preventDefault(); setError(""); setNotice("");
    const hours = Number(values.hours);
    if (!values.worker_name.trim() || !values.project_id || !Number.isFinite(hours) || hours <= 0 || hours > 24) { setError(t.validation); return; }
    setBusy(true);
    const payload = {
      id: newId(), project_id: values.project_id, task_id: values.task_id || null,
      worker_name: values.worker_name.trim(), entry_date: values.entry_date || localDate(),
      hours, notes: values.notes.trim(),
    };
    try {
      if (preview) {
        const row = { ...payload, workspace_id: "preview", created_by: "preview", created_at: new Date().toISOString() };
        const next = [row, ...readPreview()];
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(next)); setItems(next);
      } else {
        if (!workspaceId || !supabase) throw new Error("workspace");
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user?.id) throw new Error("auth");
        const { data, error: insertError } = await supabase.from("project_time_entries").insert({
          ...payload, workspace_id: workspaceId, created_by: authData.user.id,
        }).select("id,workspace_id,project_id,task_id,worker_name,entry_date,hours,notes,created_by,created_at").single();
        if (insertError) throw insertError;
        setItems((current) => [data, ...current]);
      }
      setNotice(t.success); setCreating(false);
      setValues((current) => ({ ...current, task_id: "", worker_name: "", hours: "", notes: "", entry_date: localDate() }));
    } catch { setError(t.saveError); }
    finally { setBusy(false); }
  };

  const exportCsv = () => {
    const projectLabel = locale === "ar" ? "المشروع" : locale === "fr" ? "Projet" : "Project";
    const workerLabel = locale === "ar" ? "العامل أو الفريق" : locale === "fr" ? "Ouvrier ou équipe" : "Worker or crew";
    const rows = [
      [projectLabel, workerLabel, t.task, t.date, t.hours, t.notes],
      ...filtered.map((item) => [projectTitle(item.project_id), item.worker_name, taskTitle(item.task_id), item.entry_date, item.hours, item.notes]),
    ];
    const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "chantier-iq-time-entries.csv"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <main className="time-clock" dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className="time-clock-heading">
        <div className="time-clock-title"><span className="time-clock-title-icon"><Clock3 size={20} aria-hidden="true" /></span><div><h1>{t.title}</h1><p>{t.subtitle}</p></div></div>
        {canWrite && projects.length > 0 && <button type="button" className="time-clock-primary" onClick={() => { setCreating((value) => !value); setError(""); }}><Plus size={16} />{t.add}</button>}
      </header>
      {preview && <div className="time-clock-preview" role="note">{t.preview}</div>}
      {!preview && !workspaceId && <div className="time-clock-message is-error" role="status">{t.noWorkspace}</div>}
      {!canWrite && <div className="time-clock-message" role="note">{t.readOnly}</div>}
      {error && <div className="time-clock-message is-error" role="alert">{error}</div>}
      {notice && <div className="time-clock-message is-success" role="status">{notice}</div>}

      {creating && <form className="time-clock-form" onSubmit={submit}>
        <label>{t.project}<select required value={values.project_id} onChange={(event) => setValues((old) => ({ ...old, project_id: event.target.value, task_id: "" }))}><option value="">—</option>{projects.map((project) => <option key={project.id} value={project.id}>{projectTitle(project.id)}</option>)}</select></label>
        <label>{t.worker}<input required maxLength={120} value={values.worker_name} onChange={(event) => setValues((old) => ({ ...old, worker_name: event.target.value }))} /></label>
        <label>{t.task}<select value={values.task_id} onChange={(event) => setValues((old) => ({ ...old, task_id: event.target.value }))}><option value="">{t.none}</option>{tasks.filter((task) => task.projectId === values.project_id || task.project_id === values.project_id).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
        <label>{t.date}<input type="date" required value={values.entry_date} onChange={(event) => setValues((old) => ({ ...old, entry_date: event.target.value }))} /></label>
        <label>{t.hours}<input type="number" required min="0.25" max="24" step="0.25" inputMode="decimal" value={values.hours} onChange={(event) => setValues((old) => ({ ...old, hours: event.target.value }))} /></label>
        <label className="time-clock-wide">{t.notes}<textarea rows="2" maxLength={1000} value={values.notes} onChange={(event) => setValues((old) => ({ ...old, notes: event.target.value }))} /></label>
        <div className="time-clock-form-actions"><button type="button" className="time-clock-secondary" onClick={() => setCreating(false)}>{locale === "ar" ? "إلغاء" : locale === "fr" ? "Annuler" : "Cancel"}</button><button type="submit" className="time-clock-primary" disabled={busy}>{busy && <LoaderCircle size={15} className="time-clock-spin" />}{t.save}</button></div>
      </form>}

      <section className="time-clock-summary" aria-label={t.dailyTotal}>
        <article><span><Clock3 size={16} />{t.dailyTotal}</span><strong>{totalHours.toLocaleString(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en", { maximumFractionDigits: 2 })}</strong><small>{t.hours}</small></article>
        <article><span><Users size={16} />{t.workers}</span><strong>{peopleCount.toLocaleString(locale === "ar" ? "ar-DZ" : "en")}</strong></article>
      </section>

      <section className="time-clock-panel">
        <div className="time-clock-toolbar">
          <div className="time-clock-filter-group" role="group" aria-label={t.project}>
            <select aria-label={t.project} value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">{t.allProjects}</option>{projects.map((project) => <option key={project.id} value={project.id}>{projectTitle(project.id)}</option>)}</select>
            <div className="time-clock-period" role="group" aria-label={t.dailyTotal}>
              <button type="button" className={period === "today" ? "selected" : ""} onClick={() => setPeriod("today")}>{t.today}</button>
              <button type="button" className={period === "week" ? "selected" : ""} onClick={() => setPeriod("week")}>{t.week}</button>
            </div>
          </div>
          <button type="button" className="time-clock-export" onClick={exportCsv} disabled={!filtered.length}><Download size={15} />{t.export}</button>
        </div>
        {loading ? <div className="time-clock-empty"><LoaderCircle size={18} className="time-clock-spin" />{t.loading}</div> : filtered.length ? (
          <div className="time-clock-table-wrap"><table className="time-clock-table"><thead><tr><th>{t.project}</th><th>{t.worker}</th><th>{t.task}</th><th>{t.date}</th><th>{t.hours}</th><th>{t.notes}</th></tr></thead><tbody>
            {filtered.map((item) => <tr key={item.id}><td>{projectTitle(item.project_id)}</td><td>{item.worker_name}</td><td>{item.task_id ? taskTitle(item.task_id) : "—"}</td><td>{item.entry_date}</td><td><strong>{Number(item.hours).toLocaleString(locale === "ar" ? "ar-DZ" : "en", { maximumFractionDigits: 2 })}</strong></td><td>{item.notes || "—"}</td></tr>)}
          </tbody></table></div>
        ) : <div className="time-clock-empty"><Clock3 size={20} /><p>{t.empty}</p></div>}
      </section>
    </main>
  );
}
