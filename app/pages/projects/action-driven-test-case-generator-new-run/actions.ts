"use client";

type OpenExternalTabOptions = {
  url: string;
  onClosed: () => Promise<void> | void;
  pollInterval?: number;
};

export function openExternalTabAndWait({
  url,
  onClosed,
  pollInterval = 500,
}: OpenExternalTabOptions) {
  let childWindow: Window | null = null;
  let called = false;
  let intervalId: number | null = null;

  const cleanup = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("focus", onFocus);
  };

  const handleCloseOnce = async () => {
    if (called) return;
    called = true;
    cleanup();
    await onClosed();
  };

  const checkIfClosed = () => {
    if (childWindow && childWindow.closed) {
      handleCloseOnce();
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      checkIfClosed();
    }
  };

  const onFocus = () => {
    checkIfClosed();
  };

  // 🔹 MUST be triggered by user action
  const win = window.open(url, "_blank");
  if (!win) {
    throw new Error("Popup blocked");
  }

  childWindow = win;

  intervalId = window.setInterval(checkIfClosed, pollInterval);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("focus", onFocus);
}
