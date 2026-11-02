"use client";

export const DEV_TEST_TOKEN_KEY = "appatlas_dev_test_token";
export const DEV_TEST_USER_KEY = "appatlas_dev_test_user";

function readJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function getDevTestToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const token = sessionStorage.getItem(DEV_TEST_TOKEN_KEY);
  if (!token) return null;
  const exp = readJwtExp(token);
  const now = Math.floor(Date.now() / 1000);
  if (exp !== null && exp <= now) {
    sessionStorage.removeItem(DEV_TEST_TOKEN_KEY);
    sessionStorage.removeItem(DEV_TEST_USER_KEY);
    return null;
  }
  return token;
}

export function hasDevTestSession(): boolean {
  return getDevTestToken() !== null;
}
