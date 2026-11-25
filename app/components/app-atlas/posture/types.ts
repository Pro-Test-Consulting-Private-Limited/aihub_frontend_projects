export type ScreenRef = {
  id: string;
  name: string;
  url: string;
  screenshotUrl?: string | null;
};

export type CheckRow = {
  id: string;
  category: string;
  name: string;
  status: string;
  statusLabel: string;
  reason: string;
  severity?: string | null;
  detectors: string[];
  screenIds?: string[];
  screens?: ScreenRef[];
  screensAffected?: number;
  asvs: string | null;
  cwe: string | null;
  owasp: string | null;
  remediation: string | null;
  automationLevel: string;
  automationReason?: string | null;
  primaryPass?: string | null;
  futurePass: string | null;
  humanStatus: string | null;
  humanByName?: string | null;
  humanAt?: number | null;
  humanNotes?: string | null;
  automatedAlso: string | null;
  lastTestedAt?: number | null;
  evidence?: Record<string, unknown>;
  expected?: string | null;
  observed?: string | null;
  box?: string | null;
};

export type SecurityReport = {
  canvasId: string;
  canvasName?: string;
  appUrl?: string | null;
  generatedAt: number;
  total: number;
  categories?: string[];
  tally: Record<string, number>;
  byCategory?: Record<string, Record<string, number>>;
  grade: {
    label: string;
    progress: {
      tested: number;
      total: number;
      passAmongTested: number;
      passRateLabel: string;
      coverageLabel?: string;
      tally: Record<string, number>;
    };
    checkScore?: {
      available: boolean;
      value: number | null;
      formula: string;
      testedAutomatable: number;
      automatableTotal: number;
      thresholdPct: number;
    };
    unlockHint?: string;
  };
  coverage: {
    screensVisited: number;
    screensOnCanvas: number;
    percent: number;
    requestsSeen: number;
  } | null;
  failures: Array<{
    severity: string;
    title: string;
    checkId: string;
    reason?: string;
    why?: string;
    screenIds?: string[];
    screens?: ScreenRef[];
    expected?: string | null;
    observed?: string | null;
    fix?: string | null;
    remediation?: string | null;
  }>;
  checks: CheckRow[];
  screens?: Array<{
    nodeId: string | null;
    url: string;
    title: string;
    name?: string;
    visited: boolean;
    screenshotUrl?: string | null;
  }>;
  discovery?: Record<string, unknown>;
  probeOutcomes?: Array<{
    path: string;
    url: string;
    status: number | null;
    verdict: string;
    detector: string;
    checkId?: string;
  }>;
  precisionEvidence?: Array<{
    detectorId: string;
    checkId: string;
    caseType: string;
    harnessPath: string;
    expected: string;
    actual?: string | null;
    agreement?: string;
    notes?: string;
  }>;
  perPassResults?: Record<string, Record<string, number>>;
  overlapNote?: string;
};

export type PassInfo = {
  id: string;
  title: string;
  kind: string;
  built: boolean;
  unlockCount: number;
  description: string;
  coverage?: {
    covers: number;
    fullyVerifies: number;
    partiallyObserves: number;
    cannotAutomate: number;
    byCategory?: Record<string, string[]>;
    checkIds?: string[];
  } | null;
};

export type Job = {
  id: string;
  passId: string;
  status: string;
  progress: Record<string, unknown>;
  summary?: Record<string, unknown>;
  error?: string | null;
  startedAt?: number | null;
  finishedAt?: number | null;
  createdByName?: string | null;
};

export type JobEvent = {
  id: number;
  at: number;
  step: string;
  detail: string | null;
  url: string | null;
  detector: string | null;
  result: string | null;
  screenId?: string | null;
};
