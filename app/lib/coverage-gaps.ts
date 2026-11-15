/** Pure joins for Coverage dig panels (OpenAPI, Live AC, smoke, epic, blast, …). */

export type CovOp = { key: string; method: string; path: string };

export type LiveAcRow = {
  key: string;
  summary: string;
  observed: number;
  total: number;
  missing: Array<{ text: string; via?: string; nodeId?: string; nodeTitle?: string; nodePath?: string }>;
  screenIds: string[];
  screenLabels: string[];
};

export type AcCaseLink = { acText: string; caseIds: string[]; scenarios: string[] };

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "is",
  "be",
  "as",
  "by",
  "at",
  "from",
  "user",
  "can",
  "should",
  "must",
  "will",
  "able",
]);

export function tokenize(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function tokenOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const bs = new Set(b);
  let hit = 0;
  for (const t of a) if (bs.has(t)) hit++;
  return hit / Math.max(a.length, 1);
}

export function prioWeight(byPriority: Record<string, number> | undefined): number {
  const p = byPriority || {};
  if ((p.Critical || 0) > 0 || (p.Highest || 0) > 0) return 4;
  if ((p.High || 0) > 0) return 3;
  if ((p.Medium || 0) > 0 || (p.Normal || 0) > 0) return 2;
  if ((p.Low || 0) > 0 || (p.Lowest || 0) > 0) return 1;
  return 2;
}

export function verifiedPct(byExecutionStatus: Record<string, number> | undefined, tests: number): number {
  if (!tests) return 0;
  const passed = byExecutionStatus?.Passed || 0;
  return Math.round((100 * passed) / tests);
}

export function executedPct(byExecutionStatus: Record<string, number> | undefined, tests: number): number {
  if (!tests) return 0;
  const s = byExecutionStatus || {};
  const n = (s.Passed || 0) + (s.Failed || 0) + (s.Blocked || 0) + (s.Skipped || 0);
  return Math.round((100 * n) / tests);
}

/** Smoke = Positive cases; deep = other depth types. */
export function smokeDeep(byType: Record<string, number> | undefined): { smoke: number; deep: number; smokeCovered: boolean } {
  const t = byType || {};
  const smoke = t.Positive || 0;
  const deep = Object.entries(t).reduce((n, [k, v]) => (k === "Positive" ? n : n + (v || 0)), 0);
  return { smoke, deep, smokeCovered: smoke > 0 };
}

export function weightedGapScore(opts: {
  byPriority?: Record<string, number>;
  depth: number;
  missingAcRatio: number;
}): number {
  const w = prioWeight(opts.byPriority);
  const thin = Math.max(0, (100 - (opts.depth || 0)) / 100);
  const miss = Math.min(1, Math.max(0, opts.missingAcRatio));
  return Math.round(10 * w * (miss + thin) * 10) / 10;
}

export function liveAcForTickets(opts: {
  issues: Array<{ key: string; summary: string; acceptanceCriteria?: string[] }>;
  coverage: Record<string, string[]>;
  nodeMatches: Record<string, Array<{ key: string; criteria?: Array<{ text: string; observed: boolean; via?: string }> }>>;
  nodes: Array<{ id: string; title: string; path: string }>;
}): LiveAcRow[] {
  const nodeById = new Map(opts.nodes.map((n) => [n.id, n]));
  return opts.issues.map((issue) => {
    const screenIds = opts.coverage[issue.key] || [];
    const screenLabels = screenIds.map((id) => {
      const n = nodeById.get(id);
      return n ? n.title || n.path || id : id;
    });
    const byText = new Map<string, { text: string; observed: boolean; via?: string; nodeId?: string }>();
    for (const sid of screenIds) {
      for (const m of opts.nodeMatches[sid] || []) {
        if (m.key !== issue.key) continue;
        for (const c of m.criteria || []) {
          const prev = byText.get(c.text);
          if (!prev) byText.set(c.text, { text: c.text, observed: c.observed, via: c.via, nodeId: sid });
          else if (c.observed) byText.set(c.text, { text: c.text, observed: true, via: c.via || prev.via, nodeId: sid });
        }
      }
    }
    let list = [...byText.values()];
    if (!list.length && (issue.acceptanceCriteria || []).length) {
      list = (issue.acceptanceCriteria || []).map((text) => ({ text, observed: false }));
    }
    const missing = list
      .filter((c) => !c.observed)
      .map((c) => {
        const n = c.nodeId ? nodeById.get(c.nodeId) : undefined;
        return {
          text: c.text,
          via: c.via,
          nodeId: c.nodeId,
          nodeTitle: n?.title,
          nodePath: n?.path,
        };
      });
    const observed = list.filter((c) => c.observed).length;
    return {
      key: issue.key,
      summary: issue.summary,
      observed,
      total: list.length,
      missing,
      screenIds,
      screenLabels,
    };
  });
}

export function openApiGaps(opts: {
  tickets: Array<{ key: string; summary: string; acs: string[] }>;
  ops: CovOp[];
  threshold?: number;
}): {
  ticketNoOp: Array<{ key: string; summary: string }>;
  opNoTicket: CovOp[];
  matches: Record<string, string[]>;
} {
  const thr = opts.threshold ?? 0.28;
  const matches: Record<string, string[]> = {};
  const ticketTok = opts.tickets.map((t) => ({
    key: t.key,
    summary: t.summary,
    tok: tokenize([t.summary, ...t.acs].join(" ")),
  }));
  const opTok = opts.ops.map((o) => ({
    ...o,
    tok: tokenize(`${o.method} ${o.path}`),
  }));

  for (const t of ticketTok) {
    const hit: string[] = [];
    for (const o of opTok) {
      if (tokenOverlap(t.tok, o.tok) >= thr || tokenOverlap(o.tok, t.tok) >= thr) hit.push(o.key);
    }
    matches[t.key] = hit;
  }

  const ticketNoOp = ticketTok.filter((t) => !(matches[t.key] || []).length).map((t) => ({ key: t.key, summary: t.summary }));
  const claimed = new Set(Object.values(matches).flat());
  const opNoTicket = opTok.filter((o) => !claimed.has(o.key)).map(({ key, method, path }) => ({ key, method, path }));
  return { ticketNoOp, opNoTicket, matches };
}

export function linkAcToCases(
  missingAcs: string[],
  cases: Array<{ id: string; scenario: string; steps?: string; requirementId?: string }>,
  threshold = 0.35,
): AcCaseLink[] {
  return missingAcs.map((acText) => {
    const tok = tokenize(acText);
    const hit: { id: string; scenario: string; score: number }[] = [];
    for (const c of cases) {
      const score = tokenOverlap(tok, tokenize(`${c.scenario} ${c.steps || ""}`));
      if (score >= threshold) hit.push({ id: c.id, scenario: c.scenario, score });
    }
    hit.sort((a, b) => b.score - a.score);
    return {
      acText,
      caseIds: hit.slice(0, 5).map((h) => h.id),
      scenarios: hit.slice(0, 5).map((h) => h.scenario),
    };
  });
}

export function undocumentedAndZombie(opts: {
  nodes: Array<{ id: string; title: string; path: string; stateCount?: number; screenshotUrl?: string }>;
  nodeMatches: Record<string, unknown[]>;
  coverage: Record<string, string[]>;
  issueKeys: string[];
}): {
  undocumentedScreens: Array<{ id: string; title: string; path: string }>;
  ticketsNoScreen: string[];
  zombieScreens: Array<{ id: string; title: string; path: string }>;
} {
  const undocumentedScreens = opts.nodes.filter((n) => !(opts.nodeMatches[n.id] || []).length).map((n) => ({
    id: n.id,
    title: n.title || n.path,
    path: n.path,
  }));
  const ticketsNoScreen = opts.issueKeys.filter((k) => !(opts.coverage[k] || []).length);
  const zombieScreens = opts.nodes
    .filter((n) => (opts.nodeMatches[n.id] || []).length > 0 && !(n.stateCount || 0) && !n.screenshotUrl)
    .map((n) => ({ id: n.id, title: n.title || n.path, path: n.path }));
  return { undocumentedScreens, ticketsNoScreen, zombieScreens };
}

export function epicReady(opts: {
  children: Array<{ depth: number; acObserved: number; acTotal: number }>;
  depthMin?: number;
  acMin?: number;
}): { ready: boolean; readyCount: number; total: number } {
  const depthMin = opts.depthMin ?? 40;
  const acMin = opts.acMin ?? 0.5;
  const total = opts.children.length;
  let readyCount = 0;
  for (const c of opts.children) {
    const acRatio = c.acTotal ? c.acObserved / c.acTotal : 1;
    if (c.depth >= depthMin && acRatio >= acMin) readyCount++;
  }
  return { ready: total > 0 && readyCount === total, readyCount, total };
}

export function blastRadius(opts: {
  control: string;
  ops: CovOp[];
  tickets: Array<{ key: string; summary: string; acs: string[] }>;
  nodes: Array<{ id: string; title: string; path: string }>;
  dependsOn?: Record<string, string[]>;
}): { ops: CovOp[]; tickets: Array<{ key: string; summary: string }>; screens: Array<{ id: string; title: string; path: string }> } {
  const q = tokenize(opts.control);
  const ops = opts.ops.filter((o) => tokenOverlap(q, tokenize(`${o.method} ${o.path}`)) >= 0.25);
  const opKeys = new Set(ops.map((o) => o.key));
  if (opts.dependsOn) {
    for (const [k, deps] of Object.entries(opts.dependsOn)) {
      if (opKeys.has(k) || deps.some((d) => opKeys.has(d))) {
        const found = opts.ops.find((o) => o.key === k);
        if (found) ops.push(found);
        for (const d of deps) {
          const f = opts.ops.find((o) => o.key === d);
          if (f) ops.push(f);
        }
      }
    }
  }
  const uniqOps = [...new Map(ops.map((o) => [o.key, o])).values()];
  const tickets = opts.tickets.filter((t) => tokenOverlap(q, tokenize([t.summary, ...t.acs].join(" "))) >= 0.2);
  const screens = opts.nodes.filter((n) => tokenOverlap(q, tokenize(`${n.title} ${n.path}`)) >= 0.25);
  return { ops: uniqOps, tickets, screens };
}

export function a11yRollup(nodes: Array<{ id: string; title: string; path: string; health?: { a11yViolations?: number; level?: string } | null }>) {
  return nodes
    .filter((n) => (n.health?.a11yViolations || 0) > 0 || n.health?.level === "bad" || n.health?.level === "warn")
    .map((n) => ({
      id: n.id,
      title: n.title || n.path,
      path: n.path,
      violations: n.health?.a11yViolations || 0,
      level: n.health?.level || "warn",
    }))
    .sort((a, b) => b.violations - a.violations);
}

export function suiteDrift(workbooks: Array<{ id: string; generatedAt?: number | null; createdAt: number; caseCount: number; issueKeys: string[] }>) {
  const sorted = [...workbooks].sort((a, b) => (b.generatedAt || b.createdAt) - (a.generatedAt || a.createdAt));
  if (sorted.length < 2) {
    const latest = sorted[0];
    return {
      latestAt: latest ? latest.generatedAt || latest.createdAt : null,
      deltaCases: 0,
      message: latest ? "Only one workbook generation on this canvas." : "No workbooks yet.",
    };
  }
  const [a, b] = sorted;
  const deltaCases = (a.caseCount || 0) - (b.caseCount || 0);
  const ageH = Math.round((Date.now() - (a.generatedAt || a.createdAt)) / 3600_000);
  return {
    latestAt: a.generatedAt || a.createdAt,
    deltaCases,
    message:
      deltaCases === 0
        ? `Latest suite ${ageH}h ago · case count unchanged vs previous gen.`
        : `Latest suite ${ageH}h ago · ${deltaCases > 0 ? `+${deltaCases}` : deltaCases} cases vs previous gen.`,
  };
}
