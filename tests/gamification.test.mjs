import test from "node:test";
import assert from "node:assert/strict";
import { awardStudyXp, getStudyLevel, recordStudyDay } from "../src/lib/gamification.js";

test("awards XP once per source event", () => {
  const first = awardStudyXp({ xp: 0, xpEvents: [] }, "correct_answer", "lesson:step-1");
  assert.equal(first.xp, 10);
  assert.equal(awardStudyXp(first, "correct_answer", "lesson:step-1"), first);
});

test("maps XP thresholds to Arabic and French levels", () => {
  assert.deepEqual(getStudyLevel(600, "ar"), { number: 4, name: "خبيرة", nextXp: 1500 });
  assert.equal(getStudyLevel(99, "fr").name, "Graine");
});

test("requires a meaningful study activity and counts one streak per day", () => {
  const start = { currentDays: 2, lastActiveOn: "2026-11-25", freezeTokens: 0, activeDaysSinceFreeze: 2 };
  assert.equal(recordStudyDay(start, "2026-11-26", { minutes: 4 }).counted, false);
  const today = recordStudyDay(start, "2026-11-26", { minutes: 5 });
  assert.equal(today.currentDays, 3);
  assert.equal(today.freezeTokens, 1);
  assert.equal(recordStudyDay(today, "2026-11-26", { lessonCompleted: true }).currentDays, 3);
});

test("uses a freeze for one missed day and resets after a longer gap", () => {
  const state = { currentDays: 4, lastActiveOn: "2026-11-24", freezeTokens: 1, activeDaysSinceFreeze: 1 };
  const frozen = recordStudyDay(state, "2026-11-26", { lessonCompleted: true });
  assert.equal(frozen.currentDays, 5);
  assert.equal(frozen.freezeTokens, 0);
  assert.equal(frozen.usedFreeze, true);
  assert.equal(recordStudyDay(state, "2026-11-27", { lessonCompleted: true }).currentDays, 1);
});

test("allows at most four monthly rest days", () => {
  let state = { currentDays: 3, lastActiveOn: "2026-11-20", restMonth: "2026-11", restDaysUsed: 4 };
  state = recordStudyDay(state, "2026-11-21", { restDay: true });
  assert.equal(state.counted, false);
  assert.equal(state.currentDays, 3);
});
