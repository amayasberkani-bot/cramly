const DAY_MS = 24 * 60 * 60 * 1000;

const messages = {
  ar: {
    class: (moduleName) => `غداً لديك ${moduleName}. راجعي الدرس 10 دقائق؟`,
    exam: (moduleName, days) => days === 0
      ? `امتحان ${moduleName} اليوم. خذي نفساً وراجعي النقاط الأساسية.`
      : `بقي ${days} أيام على امتحان ${moduleName}. مراجعة قصيرة تساعدك.`,
    review: (moduleName, count) => `${count} بطاقات من ${moduleName} تنتظر المراجعة.`,
    streak: "جلسة قصيرة اليوم تحافظ على استمراريتك. خذيها على راحتك.",
    nudge: (moduleName) => `لديك وقت مناسب لمراجعة ${moduleName}. ابدئي بعشر دقائق.`,
  },
  fr: {
    class: (moduleName) => `Demain, tu as ${moduleName}. 10 min de révision ?`,
    exam: (moduleName, days) => days === 0
      ? `Examen de ${moduleName} aujourd'hui. Respire et revois l'essentiel.`
      : `Plus que ${days} jours avant l'examen de ${moduleName}. Une courte révision aide.`,
    review: (moduleName, count) => `${count} cartes de ${moduleName} sont à revoir.`,
    streak: "Une courte séance aujourd'hui entretient ton rythme. À ton rythme.",
    nudge: (moduleName) => `Un bon créneau pour revoir ${moduleName}. Commence par 10 min.`,
  },
};

const dayIndex = (date) => (date.getDay() + 1) % 7; // Saturday = 0, Friday = 6
const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const atTime = (date, value = "09:00") => {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours || 0, minutes || 0);
};
const asMinutes = (value) => {
  const [hours = 0, minutes = 0] = String(value || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
};
const inQuietHours = (time, quiet = {}) => {
  const minute = asMinutes(time);
  const from = asMinutes(quiet.start || "22:30");
  const to = asMinutes(quiet.end || "07:00");
  if (from === to) return false;
  return from > to ? minute >= from || minute < to : minute >= from && minute < to;
};

function isStudiedToday(progress, moduleName, now) {
  return progress.some((item) => item.module === moduleName &&
    dayKey(new Date(item.lastStudiedAt || item.lastStudiedDate || 0)) === dayKey(now));
}

function hasClassAt(timetable, date, time) {
  const target = asMinutes(time);
  return timetable.some((entry) => {
    if (entry.day !== dayIndex(date)) return false;
    const start = asMinutes(entry.startTime);
    const end = asMinutes(entry.endTime);
    return target >= start - 15 && target < end + 15;
  });
}

/**
 * Produce deterministic, local reminder suggestions. This function never sends
 * notifications; callers decide whether and when to display them.
 */
export function planReminders(profile = {}, timetable = [], events = [], progress = [], now = new Date()) {
  const current = new Date(now);
  const locale = profile.locale === "fr" ? "fr" : "ar";
  const copy = messages[locale];
  const pausedUntil = profile.pausedUntil ? new Date(profile.pausedUntil) : null;
  if (pausedUntil && pausedUntil >= current) return [];

  const todayIndex = dayIndex(current);
  if (profile.restDay === todayIndex) return [];

  const muted = new Set(profile.mutedModules || []);
  const candidates = [];
  const push = (item) => {
    if (!item.module || muted.has(item.module) || inQuietHours(item.time, profile.quietHours)) return;
    const scheduledAt = atTime(item.date, item.time);
    if (scheduledAt <= current) return;
    candidates.push({ ...item, scheduledAt, id: `${item.kind}:${item.module}:${dayKey(item.date)}` });
  };

  const tomorrow = addDays(current, 1);
  for (const entry of timetable) {
    if (entry.day !== dayIndex(tomorrow)) continue;
    const time = profile.preferredEveningTime || "19:00";
    push({ kind: "class-preview", module: entry.module, date: tomorrow, time, priority: 2, pose: "reading", message: copy.class(entry.module) });
  }

  for (const event of events) {
    if (!event.date || !event.module) continue;
    const examDate = new Date(`${event.date}T00:00:00`);
    const days = Math.round((startOfDay(examDate) - startOfDay(current)) / DAY_MS);
    if (![7, 3, 1, 0].includes(days) || isStudiedToday(progress, event.module, current)) continue;
    const time = days === 0 ? "08:00" : profile.preferredEveningTime || "19:00";
    push({ kind: days === 0 ? "exam-day" : `exam-t${days}`, module: event.module, date: examDate, time, priority: 1, pose: "thinking", message: copy.exam(event.module, days) });
  }

  const reviewTimes = profile.preferredReviewTimes?.length ? profile.preferredReviewTimes : ["17:30", "13:00"];
  for (const item of progress) {
    if ((item.dueCount || 0) < 1) continue;
    const time = reviewTimes.find((candidate) => !hasClassAt(timetable, current, candidate));
    if (!time || isStudiedToday(progress, item.module, current)) continue;
    push({ kind: "due-review", module: item.module, date: current, time, priority: 3, pose: "writing-on-board", message: copy.review(item.module, item.dueCount) });
  }

  const nudgeTimes = profile.preferredReviewTimes?.length ? profile.preferredReviewTimes : ["17:30", "13:00"];
  const weakModules = [...progress]
    .filter((item) => Number.isFinite(item.mastery) && item.mastery < 70 && !item.dueCount && !isStudiedToday(progress, item.module, current))
    .sort((a, b) => a.mastery - b.mastery);
  const availableNudgeTimes = nudgeTimes.filter((candidate) => !hasClassAt(timetable, current, candidate));
  weakModules.forEach((item, index) => {
    const time = availableNudgeTimes[index % Math.max(availableNudgeTimes.length, 1)];
    if (time) push({ kind: "nudge", module: item.module, date: current, time, priority: 5, pose: "thinking", message: copy.nudge(item.module) });
  });

  if (profile.streak > 0 && !progress.some((item) => dayKey(new Date(item.lastStudiedAt || item.lastStudiedDate || 0)) === dayKey(current))) {
    const time = profile.preferredEveningTime || "19:00";
    push({ kind: "streak", module: "streak", date: current, time, priority: 4, pose: "celebrating", message: copy.streak });
  }

  const unique = new Map();
  for (const candidate of candidates.sort((a, b) => a.priority - b.priority || a.scheduledAt - b.scheduledAt)) {
    const key = `${candidate.kind}:${candidate.module}:${dayKey(candidate.date)}`;
    if (!unique.has(key)) unique.set(key, candidate);
  }
  const dailyLimit = Math.max(0, Math.min(4, Number(profile.maxNudgesPerDay ?? 2)));
  const nudgesByDay = new Map();
  return [...unique.values()]
    .sort((a, b) => a.scheduledAt - b.scheduledAt || a.priority - b.priority)
    .filter((item) => {
      if (item.kind !== "nudge") return true;
      const key = dayKey(item.date);
      const count = nudgesByDay.get(key) || 0;
      if (count >= dailyLimit) return false;
      nudgesByDay.set(key, count + 1);
      return true;
    });
}

export const plannerDate = { dayIndex, dayKey, addDays, atTime };
