"use client";

import type { PrerequisiteStep } from "@/app/interfaces/api-testing";
import { newId } from "./rows";

/**
 * Setup shared by every endpoint of one Swagger spec: your variables (a second user's token is the same for all of them) and,
 * when you choose, the prerequisite steps. Memory only, like the rest: steps can hold passwords.
 */
type Shared = { variables?: Record<string, string>; prerequisites?: PrerequisiteStep[]; defaultHeaders?: Record<string, string> };
const shared = new Map<string, Shared>();

export const getSharedVariables = (specUrl: string) => shared.get(specUrl)?.variables;
export function setSharedVariables(specUrl: string, variables: Record<string, string>) {
  shared.set(specUrl, { ...shared.get(specUrl), variables });
}

export const getSharedSetup = (specUrl: string): { prerequisites: PrerequisiteStep[]; defaultHeaders: Record<string, string> } | null => {
  const s = shared.get(specUrl);
  return s?.prerequisites?.length ? { prerequisites: s.prerequisites, defaultHeaders: s.defaultHeaders ?? {} } : null;
};
export function setSharedSetup(specUrl: string, prerequisites: PrerequisiteStep[], defaultHeaders: Record<string, string>) {
  shared.set(specUrl, { ...shared.get(specUrl), prerequisites: prerequisites.map((p) => ({ ...p })), defaultHeaders: { ...defaultHeaders } });
}
export function stopSharingSetup(specUrl: string) {
  const s = shared.get(specUrl);
  if (s) shared.set(specUrl, { variables: s.variables });
}

/** A copy for one endpoint: new step ids, so editing it there does not change the shared one. */
export const cloneSteps = (steps: PrerequisiteStep[]): PrerequisiteStep[] => steps.map((s) => ({ ...s, id: newId(), request: structuredClone(s.request ?? {}), extract: s.extract.map((e) => ({ ...e })) }));

export const clearShared = (specUrl: string) => void shared.delete(specUrl);
