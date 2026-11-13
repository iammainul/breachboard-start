import { describe, expect, it } from "vitest";
import {
  DISCUSS_SECONDS,
  discussExpiryWrite,
  formatClock,
  isRunKind,
  isSessionPhase,
  remainingSeconds,
  runKindLabel,
  shouldOpenAnswersFromDiscuss,
} from "@/lib/session-clock";

describe("session-clock", () => {
  it("exposes a 2-minute discuss window", () => {
    expect(DISCUSS_SECONDS).toBe(120);
  });

  it("computes remaining seconds from startedAt", () => {
    const started = new Date("2026-09-06T10:00:00.000Z");
    const now = Date.parse("2026-09-06T10:00:30.000Z");
    expect(remainingSeconds(started, 120, now)).toBe(90);
    expect(remainingSeconds(null, 120, now)).toBe(120);
    expect(remainingSeconds(started, 0, now)).toBe(0);
    expect(remainingSeconds(started, 10, Date.parse("2026-09-06T10:01:00.000Z"))).toBe(0);
  });

  it("formats mm:ss clocks", () => {
    expect(formatClock(125)).toBe("02:05");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-3)).toBe("00:00");
  });

  it("validates phase and run-kind enums", () => {
    expect(isSessionPhase("discuss")).toBe(true);
    expect(isSessionPhase("paused")).toBe(false);
    expect(isRunKind("engagement")).toBe(true);
    expect(isRunKind("practice")).toBe(false);
    expect(runKindLabel("draft")).toBe("Draft run");
    expect(runKindLabel("engagement")).toBe("Engagement");
  });

  it("opens answering only after a live discuss window expires", () => {
    const started = new Date("2026-09-06T10:00:00.000Z");
    const during = Date.parse("2026-09-06T10:01:00.000Z");
    const after = Date.parse("2026-09-06T10:02:00.000Z");
    const liveDiscuss = {
      id: "s1",
      status: "live",
      phase: "discuss",
      currentInjectStartedAt: started,
    };
    expect(shouldOpenAnswersFromDiscuss(liveDiscuss, during)).toBe(false);
    expect(discussExpiryWrite(liveDiscuss, during)).toBeNull();
    expect(shouldOpenAnswersFromDiscuss(liveDiscuss, after)).toBe(true);
    expect(shouldOpenAnswersFromDiscuss({ ...liveDiscuss, status: "draft" }, after)).toBe(
      false,
    );
    expect(shouldOpenAnswersFromDiscuss({ ...liveDiscuss, phase: "answering" }, after)).toBe(
      false,
    );
    expect(
      shouldOpenAnswersFromDiscuss({ ...liveDiscuss, currentInjectStartedAt: null }, after),
    ).toBe(false);

    const write = discussExpiryWrite(liveDiscuss, after);
    expect(write).toEqual({
      where: {
        id: "s1",
        status: "live",
        phase: "discuss",
        currentInjectStartedAt: started,
      },
      data: {
        phase: "answering",
        currentInjectStartedAt: new Date(after),
      },
    });
  });

  it("keeps the expiry write conditional so a second flip is a no-op", () => {
    const started = new Date("2026-09-06T10:00:00.000Z");
    const after = Date.parse("2026-09-06T10:02:05.000Z");
    const first = discussExpiryWrite(
      {
        id: "s1",
        status: "live",
        phase: "discuss",
        currentInjectStartedAt: started,
      },
      after,
    );
    expect(first?.where.phase).toBe("discuss");
    expect(
      discussExpiryWrite(
        {
          id: "s1",
          status: "live",
          phase: "answering",
          currentInjectStartedAt: first?.data.currentInjectStartedAt ?? null,
        },
        after + 1_000,
      ),
    ).toBeNull();
  });
});
