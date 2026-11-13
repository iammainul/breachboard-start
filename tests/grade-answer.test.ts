import { beforeEach, describe, expect, it, vi } from "vitest";

const getLanguageModel = vi.fn();
const generateObject = vi.fn();

vi.mock("@/lib/ai/providers", () => ({
  getLanguageModel: () => getLanguageModel(),
}));

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObject(...args),
}));

import {
  GRADE_NEEDS_REVIEW_AI_UNAVAILABLE,
  GRADE_NEEDS_REVIEW_NO_RUBRIC,
  gradeAnswerWithRubric,
} from "@/lib/ai/grade-answer";

const base = {
  maxPoints: 40,
  questionPrompts: ["What is your first containment decision?"],
  expectedActions: ["Isolate the segment"],
  rubric: "Reward timely containment and comms.",
  answerBody: "Isolate SWIFT and call Gold cell.",
  roleLabel: "SOC Lead",
};

describe("gradeAnswerWithRubric", () => {
  beforeEach(() => {
    getLanguageModel.mockReset();
    generateObject.mockReset();
  });

  it("marks empty rubric and expected actions as needing review", async () => {
    const grade = await gradeAnswerWithRubric({
      ...base,
      rubric: "   ",
      expectedActions: ["", "  "],
    });
    expect(grade).toEqual({
      autoPoints: 0,
      aiNotes: GRADE_NEEDS_REVIEW_NO_RUBRIC,
      needsReview: true,
    });
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("does not award full points when AI grading fails", async () => {
    getLanguageModel.mockRejectedValue(new Error("no provider"));
    const grade = await gradeAnswerWithRubric(base);
    expect(grade).toEqual({
      autoPoints: 0,
      aiNotes: GRADE_NEEDS_REVIEW_AI_UNAVAILABLE,
      needsReview: true,
    });
  });

  it("returns a scored result when the model responds", async () => {
    getLanguageModel.mockResolvedValue({ model: "test" });
    generateObject.mockResolvedValue({
      object: { scoreRatio: 0.5, notes: "Partial credit for isolation." },
    });
    const grade = await gradeAnswerWithRubric(base);
    expect(grade).toEqual({
      autoPoints: 20,
      aiNotes: "Partial credit for isolation.",
      needsReview: false,
    });
  });

  it("returns zero without review when the question has no points", async () => {
    const grade = await gradeAnswerWithRubric({ ...base, maxPoints: 0 });
    expect(grade).toEqual({ autoPoints: 0, aiNotes: null, needsReview: false });
  });
});
