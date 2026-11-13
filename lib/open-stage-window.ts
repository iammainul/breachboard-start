/**
 * Open Stage on a secondary display when the Window Management API is available;
 * otherwise a centered popup the facilitator can drag to the projector.
 */
export async function openStageWindow(
  sessionId: string,
  immediate = false,
): Promise<Window | null> {
  const url = `/sessions/${sessionId}/stage`;
  const features = "popup=yes,noopener,noreferrer,width=1280,height=800";

  // A direct click must call window.open before any await, otherwise popup
  // blockers can prevent the projector window from opening.
  if (immediate) {
    const win = window.open(url, `ttx-stage-${sessionId}`, features);
    win?.focus();
    return win;
  }

  try {
    // Progressive enhancement — Chromium + permission
    const getScreenDetails = (
      window as Window & {
        getScreenDetails?: () => Promise<{
          screens: { availLeft: number; availTop: number; availWidth: number; availHeight: number; isPrimary?: boolean }[];
          currentScreen: { availLeft: number; availTop: number; availWidth: number; availHeight: number };
        }>;
      }
    ).getScreenDetails;

    if (typeof getScreenDetails === "function") {
      const details = await getScreenDetails();
      const secondary =
        details.screens.find((s) => !s.isPrimary) ??
        details.screens.find(
          (s) =>
            s.availLeft !== details.currentScreen.availLeft ||
            s.availTop !== details.currentScreen.availTop,
        );
      if (secondary) {
        const placed = window.open(
          url,
          `ttx-stage-${sessionId}`,
          `${features},left=${secondary.availLeft + 40},top=${secondary.availTop + 40},width=${Math.min(1440, secondary.availWidth - 80)},height=${Math.min(900, secondary.availHeight - 80)}`,
        );
        if (placed) {
          placed.focus();
          return placed;
        }
      }
    }
  } catch {
    // Permission denied or unsupported — fall through
  }

  const win = window.open(url, `ttx-stage-${sessionId}`, features);
  win?.focus();
  return win;
}
