import test from "node:test";
import assert from "node:assert/strict";
import { studyRepositoryMappings } from "../src/lib/study-repository.js";

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
