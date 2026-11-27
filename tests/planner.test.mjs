import test from "node:test";
import assert from "node:assert/strict";
import { planReminders, plannerDate } from "../src/lib/planner.js";

const now = new Date(2026, 10, 27, 12, 0); // Friday
const profile = { locale: "fr", preferredEveningTime: "19:00", quietHours: { start: "22:30", end: "07:00" } };

test("reminds the student about tomorrow's module in their preferred evening slot", () => {
  const reminders = planReminders(profile, [{ day: 0, module: "Biologie cellulaire", startTime: "09:00", endTime: "10:30" }], [], [], now);
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].kind, "class-preview");
  assert.match(reminders[0].message, /Biologie cellulaire/);
  assert.equal(reminders[0].scheduledAt.getHours(), 19);
});

test("uses the exam countdown at T-7, T-3, T-1 and exam day", () => {
  const event = (offset) => ({ module: "Chimie générale", date: plannerDate.dayKey(plannerDate.addDays(now, offset)) });
  for (const offset of [7, 3, 1, 0]) {
    const reminders = planReminders(profile, [], [event(offset)], [], new Date(2026, 10, 27, 7, 0));
    assert.equal(reminders[0]?.kind, offset ? `exam-t${offset}` : "exam-day");
  }
});

test("respects quiet hours, rest days, paused reminders and muted modules", () => {
  const saturdayClass = [{ day: 0, module: "Mathématiques 1", startTime: "09:00", endTime: "10:00" }];
  assert.deepEqual(planReminders({ ...profile, quietHours: { start: "18:00", end: "07:00" } }, saturdayClass, [], [], now), []);
  assert.deepEqual(planReminders({ ...profile, restDay: 6 }, saturdayClass, [], [], now), []);
  assert.deepEqual(planReminders({ ...profile, pausedUntil: "2026-11-28T23:59:00" }, saturdayClass, [], [], now), []);
  assert.deepEqual(planReminders({ ...profile, mutedModules: ["Mathématiques 1"] }, saturdayClass, [], [], now), []);
});

test("suggests due flashcards in an available preferred review slot", () => {
  const reminders = planReminders({ ...profile, preferredReviewTimes: ["17:30"] }, [], [], [{ module: "Physique 1", dueCount: 5 }], now);
  assert.equal(reminders[0]?.kind, "due-review");
  assert.match(reminders[0]?.message, /5 cartes/);
  assert.equal(reminders[0]?.scheduledAt.getHours(), 17);
});

test("does not repeat exam or review reminders for a module studied today", () => {
  const today = plannerDate.dayKey(now);
  const progress = [{ module: "Biologie cellulaire", dueCount: 4, lastStudiedAt: `${today}T10:00:00` }];
  const event = { module: "Biologie cellulaire", date: plannerDate.dayKey(plannerDate.addDays(now, 1)) };
  const reminders = planReminders(profile, [], [event], progress, now);
  assert.equal(reminders.some((item) => item.module === "Biologie cellulaire"), false);
});

test("caps general free-slot nudges and allows students to turn them off", () => {
  const mastery = [22, 31, 39, 45].map((value, index) => ({ module: `Module ${index}`, mastery: value }));
  const reminders = planReminders({ ...profile, streak: 0, maxNudgesPerDay: 2 }, [], [], mastery, now);
  assert.equal(reminders.filter((item) => item.kind === "nudge").length, 2);
  assert.deepEqual(planReminders({ ...profile, streak: 0, maxNudgesPerDay: 0 }, [], [], mastery, now), []);
});
