const STEP_TYPES = new Set(["write", "draw", "highlight", "pause", "ask", "reveal", "celebrate"]);
const SHAPE_TYPES = new Set(["circle", "ellipse", "line", "rect"]);
const TEXT_FIELDS = ["ar", "fr"];

export function validateLesson(lesson) {
  const errors = [];
  if (!lesson || typeof lesson !== "object") return { valid: false, errors: ["Lesson must be an object."] };
  for (const field of ["id", "moduleFr", "moduleAr", "titleFr", "titleAr"]) {
    if (typeof lesson[field] !== "string" || !lesson[field].trim()) errors.push(`Lesson ${field} is required.`);
  }
  if (!Array.isArray(lesson.steps) || lesson.steps.length < 1) errors.push("Lesson steps must be a non-empty array.");
  (lesson.steps || []).forEach((step, index) => {
    const at = `Step ${index + 1}`;
    if (!step || typeof step !== "object" || !STEP_TYPES.has(step.type)) { errors.push(`${at} has an unsupported type.`); return; }
    if (step.type === "write" || step.type === "reveal" || step.type === "celebrate" || step.type === "highlight") {
      for (const locale of TEXT_FIELDS) if (typeof step[locale] !== "string") errors.push(`${at} is missing ${locale} text.`);
    }
    if (step.type === "draw") {
      if (!Array.isArray(step.shapes) || !step.shapes.length) errors.push(`${at} must contain at least one drawing shape.`);
      (step.shapes || []).forEach((shape, shapeIndex) => {
        if (!shape || !SHAPE_TYPES.has(shape.type)) errors.push(`${at} shape ${shapeIndex + 1} is not allowed.`);
        else if (Object.entries(shape).some(([key, value]) => key !== "type" && key !== "label" && key !== "color" && !Number.isFinite(value))) errors.push(`${at} shape ${shapeIndex + 1} contains invalid coordinates.`);
      });
      for (const locale of TEXT_FIELDS) if (typeof step.caption?.[locale] !== "string") errors.push(`${at} is missing its ${locale} caption.`);
    }
    if (step.type === "ask") {
      if (typeof step.questionAr !== "string" || typeof step.questionFr !== "string") errors.push(`${at} is missing its localized question.`);
      if (!Array.isArray(step.options) || step.options.length < 2) errors.push(`${at} must have at least two answer options.`);
      else if (!step.options.some((option) => option.id === step.answerId)) errors.push(`${at} answerId must match an option.`);
      for (const locale of TEXT_FIELDS) if (typeof step.correctText?.[locale] !== "string" || typeof step.wrongText?.[locale] !== "string") errors.push(`${at} is missing localized feedback.`);
    }
  });
  if ((lesson.steps || []).filter((step) => step?.type === "ask").length < 3) errors.push("Each sample lesson must include at least three question steps.");
  return { valid: errors.length === 0, errors };
}

export function assertValidLesson(lesson) {
  const result = validateLesson(lesson);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  return lesson;
}
