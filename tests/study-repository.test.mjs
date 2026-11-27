import test from "node:test";
import assert from "node:assert/strict";
import { createStudyRepository, studyRepositoryMappings } from "../src/lib/study-repository.js";

test("maps timetable rows from the database to the planner view model", () => {
  assert.deepEqual(studyRepositoryMappings.mapClass({
    id: "class-1", module_id: "snv-biologie-cellulaire", day_of_week: 2,
    class_type: "Cours", start_time: "09:00:00", end_time: "10:30:00", room: "A12",
  }), { id: "class-1", module: "Biologie cellulaire", day: 2, type: "Cours", startTime: "09:00", endTime: "10:30", room: "A12" });
});

test("maps exam rows without leaking database-specific names into the UI", () => {
  assert.deepEqual(studyRepositoryMappings.mapExam({
    id: "exam-1", module_id: "snv-chimie-generale", event_type: "Examen", event_date: "2026-12-20", importance: "high",
  }), { id: "exam-1", module: "Chimie générale", type: "Examen", date: "2026-12-20", importance: "high" });
});

test("refuses to write a module that is not in the Cramly catalog mapping", () => {
  assert.throws(() => studyRepositoryMappings.moduleId("Unverified module"), /Unknown Cramly module/);
});

test("loads only mapped lesson progress and totals the user's XP events", async () => {
  const resultByTable = {
    lessons: { data: [{ id: "db-bio", slug: "biologie-cellulaire-organites" }], error: null },
    lesson_progress: { data: [{ lesson_id: "db-bio", step_index: 5, mastery: 30, completed_at: null, answered_steps: ["biology:3"] }], error: null },
    xp_events: { data: [{ points: 10 }, { points: 50 }], error: null },
    streaks: { data: { current_days: 3, longest_days: 8, last_active_on: "2026-11-27", freeze_tokens: 1, active_days_since_freeze: 0 }, error: null },
  };
  const client = { from: (table) => query(resultByTable[table]), rpc: async () => ({ data: 0, error: null }) };
  const repository = createStudyRepository(client);
  const loaded = await repository.loadStudyProgress("student-1", ["biologie-cellulaire-organites"]);
  assert.equal(loaded.xp, 60);
  assert.equal(loaded.progress["biologie-cellulaire-organites"].stepIndex, 5);
  assert.equal(loaded.streakState.currentDays, 3);
});

test("saves step progress and calls the server-side idempotent XP function", async () => {
  const writes = [];
  const client = {
    from: () => ({ ...query({ data: { id: "db-bio" }, error: null }), upsert(row, options) { writes.push({ row, options }); return Promise.resolve({ error: null }); } }),
    rpc: async (name, args) => ({ data: name === "award_study_xp" && args.p_reason === "correct_answer" ? 10 : 0, error: null }),
  };
  const repository = createStudyRepository(client);
  await repository.saveLessonProgress("student-1", { slug: "biologie-cellulaire-organites", stepIndex: 4, answeredSteps: ["biology:3"] });
  assert.equal(writes[0].row.lesson_id, "db-bio");
  assert.equal(writes[0].row.step_index, 4);
  assert.equal("completed_at" in writes[0].row, false);
  assert.equal(await repository.awardXp("correct_answer", "biology:3"), 10);
});

function query(response) {
  const builder = {
    select() { return builder; },
    in() { return builder; },
    eq() { return builder; },
    order() { return builder; },
    maybeSingle() { return Promise.resolve(response); },
    single() { return Promise.resolve(response); },
    then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
  };
  return builder;
}
