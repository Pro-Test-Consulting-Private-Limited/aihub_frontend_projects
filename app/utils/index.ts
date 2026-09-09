export function formatTime(seconds: number) {
  if (seconds >= 3600) {
    return { time: (seconds / 3600).toFixed(1), key: " hours" };
  } else if (seconds >= 60) {
    return { time: (seconds / 60).toFixed(1), key: " minutes" };
  } else {
    return { time: seconds, key: " seconds" };
  }
}

export function validateURL(url: string) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
}

export function validateJSON(str: string) {
  if (typeof str !== "string") {
    return false;
  }
  try {
    const json = JSON.parse(str);
    return json && typeof json === "object";
  } catch {
    return false;
  }
}
