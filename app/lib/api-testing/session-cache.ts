/**
 * Values saved by successful, cacheable prerequisites (typically a login token), kept for this browser session only.
 * Module memory: never written to localStorage, sessionStorage, logs or saved results; gone on reload.
 */
const store = new Map<string, Record<string, string>>();

export const sessionKey = (specUrl: string, baseUrl: string) => `${specUrl}|${baseUrl.trim().replace(/\/+$/, "")}`;

export const getSession = (key: string): Record<string, string> => ({ ...(store.get(key) ?? {}) });

export function mergeSession(key: string, values: Record<string, string>) {
  if (Object.keys(values).length) store.set(key, { ...(store.get(key) ?? {}), ...values });
}

export const clearSession = (key: string) => void store.delete(key);
