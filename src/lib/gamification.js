export const XP_REWARDS = Object.freeze({
  correct_answer: 10,
  lesson_complete: 50,
  daily_review: 30,
  shared_lesson: 20,
  streak_7_days: 100,
  exam_checklist: 20,
});

const LEVELS = [
  { threshold: 0, fr: "Graine", ar: "بذرة" },
  { threshold: 100, fr: "Étudiant", ar: "طالبة" },
  { threshold: 200, fr: "Chercheur", ar: "باحثة" },
  { threshold: 600, fr: "Expert", ar: "خبيرة" },
  { threshold: 1500, fr: "Génie", ar: "عبقرية" },
];

export function getStudyLevel(xp = 0, locale = "ar") {
  const current = [...LEVELS].reverse().find((level) => xp >= level.threshold) || LEVELS[0];
  const index = LEVELS.indexOf(current);
  return { number: index + 1, name: current[locale === "fr" ? "fr" : "ar"], nextXp: LEVELS[index + 1]?.threshold ?? null };
}

export function awardStudyXp(state, reason, sourceId) {
  const points = XP_REWARDS[reason];
  if (!points) throw new Error(`Unknown XP reason: ${reason}`);
  const eventId = `${reason}:${sourceId}`;
  const events = state.xpEvents || [];
  if (events.includes(eventId)) return state;
  return { ...state, xp: (state.xp || 0) + points, xpEvents: [...events, eventId] };
}

function localDateKey(value) {
  if (typeof value === "string") return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function dayDifference(next, previous) {
  const a = new Date(`${next}T00:00:00Z`).getTime();
  const b = new Date(`${previous}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86400000);
}

/** Counts a study day after five minutes or a completed lesson; rest days preserve but do not grow a streak. */
export function recordStudyDay(streakState = {}, date = new Date(), activity = {}) {
  const day = localDateKey(date);
  const currentDays = Math.max(0, streakState.currentDays || 0);
  const freezeTokens = Math.max(0, Math.min(2, streakState.freezeTokens || 0));
  const previousActive = streakState.lastActiveOn || "";
  const base = { ...streakState, currentDays, freezeTokens, lastActiveOn: previousActive };

  if (activity.restDay) {
    const restMonth = day.slice(0, 7);
    const restDaysUsed = streakState.restMonth === restMonth ? streakState.restDaysUsed || 0 : 0;
    if (restDaysUsed >= 4) return { ...base, counted: false, usedFreeze: false };
    return { ...base, lastActiveOn: day, restDaysUsed: restDaysUsed + 1, restMonth, counted: true, usedFreeze: false };
  }

  if ((activity.minutes || 0) < 5 && !activity.lessonCompleted) return { ...base, counted: false, usedFreeze: false };
  if (previousActive === day) return { ...base, counted: true, usedFreeze: false };

  const gap = previousActive ? dayDifference(day, previousActive) : 0;
  const missedDays = gap > 0 ? gap - 1 : 0;
  const usedFreeze = missedDays > 0 && missedDays <= freezeTokens;
  const resetStreak = !previousActive || (missedDays > 0 && !usedFreeze);
  const nextDays = resetStreak ? 1 : currentDays + 1;
  const nextTokens = usedFreeze ? freezeTokens - missedDays : freezeTokens;
  let activeDaysSinceFreeze = resetStreak ? 1 : (streakState.activeDaysSinceFreeze || 0) + 1;
  let earnedFreeze = false;
  let finalTokens = nextTokens;
  if (activeDaysSinceFreeze >= 3 && finalTokens < 2) {
    finalTokens += 1;
    activeDaysSinceFreeze = 0;
    earnedFreeze = true;
  }

  return {
    ...base,
    currentDays: nextDays,
    longestDays: Math.max(streakState.longestDays || 0, nextDays),
    lastActiveOn: day,
    freezeTokens: finalTokens,
    activeDaysSinceFreeze,
    counted: true,
    usedFreeze,
    earnedFreeze,
  };
}
