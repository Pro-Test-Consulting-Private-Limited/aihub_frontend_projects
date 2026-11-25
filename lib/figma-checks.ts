export type FigmaFrameNode = {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  characters?: string;
  style?: { fontSize?: number; fontWeight?: number };
  fills?: Array<{ type?: string; color?: { r: number; g: number; b: number; a?: number } }>;
  clipsContent?: boolean;
  children?: FigmaFrameNode[];
};

export type FigmaFinding = {
  id: string;
  ruleId: string;
  severity: "error" | "warn" | "info";
  title: string;
  detail: string;
  nodeId: string | null;
  nodeName: string | null;
  evidence: Record<string, unknown>;
};

const RULESET_VERSION = "figma-dv-1";

function newId() {
  return `find_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function luminance(c: { r: number; g: number; b: number }) {
  const lin = [c.r, c.g, c.b].map((v) => {
    const s = Math.max(0, Math.min(1, v));
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const L1 = luminance(a);
  const L2 = luminance(b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function solidFill(node: FigmaFrameNode) {
  const fill = (node.fills || []).find((f) => f.type === "SOLID" && f.color);
  return fill?.color ? { r: fill.color.r, g: fill.color.g, b: fill.color.b } : null;
}

/** Deterministic design / WCAG-adjacent checks on a Figma node tree. */
export function runDeterministicChecks(root: FigmaFrameNode): FigmaFinding[] {
  const findings: FigmaFinding[] = [];
  const walk = (node: FigmaFrameNode, parentFill: { r: number; g: number; b: number } | null) => {
    const box = node.absoluteBoundingBox;
    const ownFill = solidFill(node) || parentFill;

    if (node.type === "TEXT") {
      const fontSize = node.style?.fontSize;
      if (typeof fontSize === "number" && fontSize > 0 && fontSize < 12) {
        findings.push({
          id: newId(),
          ruleId: "text.min-size",
          severity: "warn",
          title: "Text smaller than 12px",
          detail: `"${node.name || "Text"}" uses ${fontSize}px. Prefer at least 12px for body text.`,
          nodeId: node.id,
          nodeName: node.name || null,
          evidence: { fontSize },
        });
      }
      const textFill = solidFill(node);
      if (textFill && parentFill) {
        const ratio = contrastRatio(textFill, parentFill);
        if (ratio < 4.5) {
          findings.push({
            id: newId(),
            ruleId: "contrast.aa",
            severity: ratio < 3 ? "error" : "warn",
            title: "Low text contrast",
            detail: `"${node.name || "Text"}" contrast ≈ ${ratio.toFixed(2)}:1 (target ≥ 4.5:1).`,
            nodeId: node.id,
            nodeName: node.name || null,
            evidence: { ratio, textFill, parentFill, ruleset: RULESET_VERSION },
          });
        }
      }
    }

    const interactive =
      /button|cta|tab|chip|icon.?button|toggle|checkbox|radio/i.test(node.name || "") ||
      node.type === "INSTANCE" ||
      node.type === "COMPONENT";
    if (interactive && box && (box.width < 44 || box.height < 44)) {
      findings.push({
        id: newId(),
        ruleId: "touch.target",
        severity: "warn",
        title: "Touch target under 44×44",
        detail: `"${node.name}" is ${Math.round(box.width)}×${Math.round(box.height)}. Aim for at least 44×44.`,
        nodeId: node.id,
        nodeName: node.name || null,
        evidence: { width: box.width, height: box.height },
      });
    }

    if (node.clipsContent && node.type !== "FRAME" && box) {
      findings.push({
        id: newId(),
        ruleId: "layout.clips",
        severity: "info",
        title: "Node clips content",
        detail: `"${node.name}" has clipsContent — check for truncated text or overflow.`,
        nodeId: node.id,
        nodeName: node.name || null,
        evidence: { clipsContent: true },
      });
    }

    for (const child of node.children || []) walk(child, ownFill);
  };
  walk(root, solidFill(root));
  return findings;
}

export function scoreFromFindings(findings: FigmaFinding[]) {
  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  const infos = findings.filter((f) => f.severity === "info").length;
  const score = Math.max(0, Math.min(100, 100 - errors * 18 - warns * 8 - infos * 2));
  return { score, summary: { errors, warns, infos }, rulesetVersion: RULESET_VERSION };
}

/** Collect top-level FRAME/COMPONENT nodes under pages. */
export function listFramesFromDocument(document: FigmaFrameNode): Array<{
  pageId: string;
  pageName: string;
  frameId: string;
  frameName: string;
  width: number | null;
  height: number | null;
}> {
  const out: Array<{
    pageId: string;
    pageName: string;
    frameId: string;
    frameName: string;
    width: number | null;
    height: number | null;
  }> = [];
  for (const page of document.children || []) {
    if (page.type !== "CANVAS" && page.type !== "PAGE") continue;
    for (const child of page.children || []) {
      if (child.type === "FRAME" || child.type === "COMPONENT" || child.type === "COMPONENT_SET") {
        out.push({
          pageId: page.id,
          pageName: page.name,
          frameId: child.id,
          frameName: child.name,
          width: child.absoluteBoundingBox?.width ?? null,
          height: child.absoluteBoundingBox?.height ?? null,
        });
      }
    }
  }
  return out;
}
