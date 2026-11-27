import { AlertTriangle, ArrowUpRight, CircleDollarSign, ClipboardList, Flag, ListChecks } from "lucide-react";
import "./project-signals.css";

const copy = {
  ar: {
    title: "يتطلب الانتباه",
    subtitle: "إشارات محسوبة من مهام وتقارير وميزانيات مشاريعك.",
    overdue: "مهمة متأخرة",
    overdueMany: "مهام متأخرة",
    high: "مهمة عالية الأولوية مفتوحة",
    highMany: "مهام عالية الأولوية مفتوحة",
    blocker: "عائق مسجّل في تقرير الموقع",
    blockerMany: "عوائق مسجّلة في تقارير الموقع",
    overBudget: "التكلفة الفعلية تجاوزت الميزانية المخططة",
    goTasks: "مراجعة المهام",
    goLogs: "مراجعة التقارير",
    goProject: "عرض المشروع",
    none: "لا توجد إشارات عاجلة في البيانات الحالية.",
    count: "عنصر يتطلب الانتباه",
  },
  fr: {
    title: "À surveiller",
    subtitle: "Signaux calculés à partir des tâches, rapports et budgets de vos projets.",
    overdue: "tâche en retard",
    overdueMany: "tâches en retard",
    high: "tâche ouverte à priorité élevée",
    highMany: "tâches ouvertes à priorité élevée",
    blocker: "blocage signalé dans un rapport de chantier",
    blockerMany: "blocages signalés dans les rapports de chantier",
    overBudget: "Le coût réel dépasse le budget prévisionnel",
    goTasks: "Voir les tâches",
    goLogs: "Voir les rapports",
    goProject: "Voir le projet",
    none: "Aucun signal urgent dans les données actuelles.",
    count: "élément(s) à surveiller",
  },
  en: {
    title: "Needs attention",
    subtitle: "Signals calculated from your project tasks, reports, and budgets.",
    overdue: "overdue task",
    overdueMany: "overdue tasks",
    high: "open high-priority task",
    highMany: "open high-priority tasks",
    blocker: "blocker recorded in a site report",
    blockerMany: "blockers recorded in site reports",
    overBudget: "Actual cost is above the planned budget",
    goTasks: "Review tasks",
    goLogs: "Review reports",
    goProject: "View project",
    none: "No urgent signals in the current data.",
    count: "item(s) need attention",
  },
};

const closedStatuses = new Set(["complete", "completed", "done", "solved", "closed", "approved"]);
const normalize = (value) => String(value ?? "").trim().toLowerCase();
const todayLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const amount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

function deriveSignals({ projects, tasks, logs, locale }) {
  const messages = copy[locale] || copy.en;
  const currentDate = todayLocal();
  const signals = [];

  const openTasks = tasks.filter((task) => !closedStatuses.has(normalize(task.status)));
  const overdueTasks = openTasks.filter((task) => task.due && task.due.slice(0, 10) < currentDate);
  if (overdueTasks.length) {
    signals.push({
      id: "overdue-tasks",
      type: "warning",
      icon: ListChecks,
      title: `${overdueTasks.length} ${overdueTasks.length === 1 ? messages.overdue : messages.overdueMany}`,
      detail: overdueTasks.slice(0, 3).map((task) => task.title).filter(Boolean).join(" · "),
      action: messages.goTasks,
      view: "tasks",
      projectId: overdueTasks.length === 1 ? overdueTasks[0].projectId : undefined,
    });
  }

  const highPriorityTasks = openTasks.filter((task) => ["high", "urgent", "critical"].includes(normalize(task.priority)));
  if (highPriorityTasks.length) {
    signals.push({
      id: "high-priority-tasks",
      type: "urgent",
      icon: Flag,
      title: `${highPriorityTasks.length} ${highPriorityTasks.length === 1 ? messages.high : messages.highMany}`,
      detail: highPriorityTasks.slice(0, 3).map((task) => task.title).filter(Boolean).join(" · "),
      action: messages.goTasks,
      view: "tasks",
      projectId: highPriorityTasks.length === 1 ? highPriorityTasks[0].projectId : undefined,
    });
  }

  const blockedLogs = logs.filter((log) => String(log.blockers || "").trim());
  if (blockedLogs.length) {
    signals.push({
      id: "site-blockers",
      type: "warning",
      icon: AlertTriangle,
      title: `${blockedLogs.length} ${blockedLogs.length === 1 ? messages.blocker : messages.blockerMany}`,
      detail: blockedLogs.slice(0, 2).map((log) => log.blockers.trim()).join(" · "),
      action: messages.goLogs,
      view: "logs",
      projectId: blockedLogs.length === 1 ? blockedLogs[0].projectId : undefined,
    });
  }

  for (const project of projects) {
    const planned = amount(project.budget ?? project.planned_budget);
    if (!planned) continue;
    const actual = logs
      .filter((log) => log.projectId === project.id)
      .reduce((sum, log) => sum + amount(log.actualCost ?? log.actual_cost), 0);
    if (actual > planned) {
      const format = new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en", { maximumFractionDigits: 0 });
      signals.push({
        id: `budget-${project.id}`,
        type: "urgent",
        icon: CircleDollarSign,
        title: messages.overBudget,
        detail: `${project.name || project.nameKey || ""} · ${format.format(actual)} / ${format.format(planned)} DZD`,
        action: messages.goProject,
        view: "project",
        projectId: project.id,
      });
    }
  }
  return { signals, messages };
}

/**
 * Props: projects, tasks and logs are the currently loaded workspace records;
 * locale is `ar`, `fr`, or `en`; onNavigate(view, projectId?) is optional.
 * This component only derives signals and never creates demo/sample records.
 */
export default function ProjectSignals({ projects = [], tasks = [], logs = [], locale = "ar", onNavigate }) {
  const { signals, messages } = deriveSignals({ projects, tasks, logs, locale });
  return (
    <section className="project-signals" aria-labelledby="project-signals-title">
      <div className="project-signals-heading">
        <span className="project-signals-icon"><AlertTriangle size={17} aria-hidden="true" /></span>
        <div>
          <h2 id="project-signals-title">{messages.title}</h2>
          <p>{messages.subtitle}</p>
        </div>
        <span className="project-signals-count" aria-label={`${signals.length} ${messages.count}`}>{signals.length}</span>
      </div>
      {signals.length ? (
        <ul className="project-signals-list">
          {signals.map((signal) => {
            const Icon = signal.icon;
            return (
              <li className={`project-signal project-signal-${signal.type}`} key={signal.id}>
                <span className="project-signal-mark"><Icon size={17} aria-hidden="true" /></span>
                <div className="project-signal-copy">
                  <strong>{signal.title}</strong>
                  {signal.detail && <span>{signal.detail}</span>}
                </div>
                {onNavigate && <button type="button" onClick={() => onNavigate(signal.view, signal.projectId)}>
                  {signal.action}<ArrowUpRight size={14} aria-hidden="true" />
                </button>}
              </li>
            );
          })}
        </ul>
      ) : <p className="project-signals-empty">{messages.none}</p>}
    </section>
  );
}
