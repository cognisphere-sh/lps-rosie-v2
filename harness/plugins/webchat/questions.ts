/** Versioned text envelope keeps questionnaires in the existing durable transcript. */
export interface Questionnaire {
  id: string;
  title: string;
  /** `multiSelect` questions take several choices (checkboxes); answers join them with "; ". */
  questions: { question: string; options: string[]; multiSelect?: true }[];
}

export function validateQuestions(raw: unknown): Omit<Questionnaire, "id"> {
  if (!raw || typeof raw !== "object") throw new Error("questionnaire must be an object");
  const value = raw as Record<string, unknown>;
  const validText = (s: unknown, max: number): s is string =>
    typeof s === "string" && s.trim().length > 0 && s.length <= max;
  if (!validText(value.title, 200)) throw new Error("title required (max 200 characters)");
  if (!Array.isArray(value.questions) || !value.questions.length || value.questions.length > 20)
    throw new Error("provide 1–20 questions");
  const questions = value.questions.map((q) => {
    if (!q || !validText(q.question, 1000) || !Array.isArray(q.options) || !q.options.length || q.options.length > 10 ||
      !q.options.every((s: unknown) => validText(s, 300)))
      throw new Error("each question needs text and 1–10 nonempty options");
    if (q.multiSelect !== undefined && typeof q.multiSelect !== "boolean")
      throw new Error("multiSelect must be true or false");
    const options = (q.options as string[]).map(s => s.trim()).filter(s => s.toLowerCase() !== "something else");
    if (!options.length || new Set(options.map(s => s.toLowerCase())).size !== options.length)
      throw new Error("provide distinct choices besides Something else");
    return { question: q.question.trim() as string, options, ...(q.multiSelect ? { multiSelect: true as const } : {}) };
  });
  return { title: value.title.trim().replace(/\s+/g, " "), questions };
}

const PREFIX = "webchat-questionnaire:v1\n";
export function encodeQuestionnaire(value: Questionnaire): string {
  return `Questionnaire: ${value.title}\n` + PREFIX + JSON.stringify(value);
}
export function parseQuestionnaire(text: string): Questionnaire | null {
  const marker = text.indexOf("\n" + PREFIX);
  if (!text.startsWith("Questionnaire: ") || marker < 0) return null;
  try {
    const raw = JSON.parse(text.slice(marker + 1 + PREFIX.length));
    if (typeof raw.id !== "string" || !/^[a-f0-9-]{36}$/.test(raw.id)) return null;
    return { id: raw.id, ...validateQuestions(raw) };
  } catch { return null; }
}

export function answerHeading(id: string): string { return `Answers to questionnaire ${id}`; }
export function questionnaireAnswers(value: Questionnaire, answers: string[]): string {
  if (answers.length !== value.questions.length || answers.some(a => !a.trim()))
    throw new Error("Answer every question before submitting");
  return `${answerHeading(value.id)}\n${value.title}\n\n` + value.questions.map((q, i) =>
    `${i + 1}. ${q.question}\nAnswer: ${answers[i].trim()}`).join("\n\n");
}

/** Handles truncated notification previews as well as full envelopes. */
export function questionnairePreview(text: string): string {
  return text.startsWith("Questionnaire: ") ? text.split("\n", 1)[0] : questionnaireMessageText(text);
}

/** The correlation ID is for the agent/history, not the visible answer bubble. */
export function questionnaireMessageText(text: string): string {
  return text.replace(/^Answers to questionnaire [a-f0-9-]{36}\n/, "");
}
