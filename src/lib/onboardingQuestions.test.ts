import { describe, it, expect } from "vitest";
import { WIZARD_QUESTIONS, type WizardQuestion } from "./onboardingQuestions";

// ---------- Structure ----------

describe("WIZARD_QUESTIONS — structure", () => {
  it("has exactly 4 questions", () => {
    expect(WIZARD_QUESTIONS).toHaveLength(4);
  });

  it("each question has a unique id", () => {
    const ids = WIZARD_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each question has a non-empty question string", () => {
    for (const q of WIZARD_QUESTIONS) {
      expect(q.question.length).toBeGreaterThan(0);
    }
  });

  it("each question has at least 2 options", () => {
    for (const q of WIZARD_QUESTIONS) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("no question has duplicate options", () => {
    for (const q of WIZARD_QUESTIONS) {
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });

  it("all option strings are non-empty", () => {
    for (const q of WIZARD_QUESTIONS) {
      for (const opt of q.options) {
        expect(opt.length).toBeGreaterThan(0);
      }
    }
  });
});

// ---------- Expected question ids ----------

describe("WIZARD_QUESTIONS — expected ids", () => {
  it("contains purpose, topics, organization, starter in order", () => {
    expect(WIZARD_QUESTIONS.map((q) => q.id)).toEqual([
      "purpose",
      "topics",
      "organization",
      "starter",
    ]);
  });
});

// ---------- Multi-select ----------

describe("WIZARD_QUESTIONS — multi-select", () => {
  it("only the topics question is multi-select", () => {
    const multiSelectQuestions = WIZARD_QUESTIONS.filter(
      (q) => q.multiSelect
    );
    expect(multiSelectQuestions).toHaveLength(1);
    expect(multiSelectQuestions[0]!.id).toBe("topics");
  });

  it("topics question has maxSelect of 3", () => {
    const topics = WIZARD_QUESTIONS.find((q) => q.id === "topics")!;
    expect(topics.maxSelect).toBe(3);
  });

  it("topics question has more options than maxSelect", () => {
    const topics = WIZARD_QUESTIONS.find((q) => q.id === "topics")!;
    expect(topics.options.length).toBeGreaterThan(topics.maxSelect!);
  });

  it("non-multi-select questions have no maxSelect", () => {
    const singleSelect = WIZARD_QUESTIONS.filter((q) => !q.multiSelect);
    for (const q of singleSelect) {
      expect(q.maxSelect).toBeUndefined();
    }
  });
});

// ---------- Type check (compile-time, but good to verify shape) ----------

describe("WIZARD_QUESTIONS — type conformance", () => {
  it("each entry satisfies the WizardQuestion interface", () => {
    for (const q of WIZARD_QUESTIONS) {
      const typed: WizardQuestion = q;
      expect(typed.id).toBeDefined();
      expect(typed.question).toBeDefined();
      expect(typed.options).toBeDefined();
    }
  });
});
