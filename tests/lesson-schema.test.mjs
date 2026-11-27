import test from "node:test";
import assert from "node:assert/strict";
import biology from "../src/lessons/biologie-cellulaire.json" with { type: "json" };
import derivative from "../src/lessons/mathematiques-derivee.json" with { type: "json" };
import { validateLesson } from "../src/lessons/schema.js";

test("accepts localized sample lessons with three questions", () => {
  assert.equal(validateLesson(biology).valid, true);
  assert.equal(validateLesson(derivative).valid, true);
});

test("rejects drawing primitives outside the safe whitelist", () => {
  const unsafe = structuredClone(biology);
  unsafe.steps.push({ type: "draw", shapes: [{ type: "script", value: 1 }], caption: { ar: "x", fr: "x" } });
  const result = validateLesson(unsafe);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("not allowed")));
});

test("rejects lesson questions without a matching answer", () => {
  const invalid = structuredClone(derivative);
  const question = invalid.steps.find((step) => step.type === "ask");
  question.answerId = "unknown";
  assert.equal(validateLesson(invalid).valid, false);
});
