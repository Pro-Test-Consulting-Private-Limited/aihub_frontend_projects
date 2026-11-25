/* global figma, __html__ */
figma.showUI(__html__, { width: 360, height: 520, themeColors: true });

function serializeNode(node) {
  const box = "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;
  const out = {
    id: node.id,
    name: node.name,
    type: node.type,
    absoluteBoundingBox: box
      ? { x: box.x, y: box.y, width: box.width, height: box.height }
      : null,
  };
  if ("characters" in node && typeof node.characters === "string") {
    out.characters = node.characters.slice(0, 500);
  }
  if ("style" in node && node.style) {
    out.style = {
      fontSize: node.style.fontSize,
      fontWeight: node.style.fontWeight,
    };
  }
  if ("fills" in node && Array.isArray(node.fills) && node.fills !== figma.mixed) {
    out.fills = node.fills
      .filter((f) => f && f.visible !== false)
      .slice(0, 8)
      .map((f) => ({
        type: f.type,
        color: f.color
          ? { r: f.color.r, g: f.color.g, b: f.color.b, a: f.opacity }
          : undefined,
      }));
  }
  if ("clipsContent" in node) out.clipsContent = !!node.clipsContent;
  if ("children" in node && Array.isArray(node.children)) {
    out.children = node.children.slice(0, 400).map(serializeNode);
  }
  return out;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "get-selection") {
    const sel = figma.currentPage.selection[0];
    if (!sel) {
      figma.ui.postMessage({ type: "error", error: "Select a frame (or component) first." });
      return;
    }
    let frame = sel;
    while (frame && frame.type !== "FRAME" && frame.type !== "COMPONENT" && frame.type !== "INSTANCE" && frame.parent) {
      frame = frame.parent;
    }
    if (!frame || !("absoluteBoundingBox" in frame)) {
      figma.ui.postMessage({ type: "error", error: "Select a frame to validate." });
      return;
    }
    figma.ui.postMessage({
      type: "selection",
      fileKey: figma.fileKey || null,
      pageId: figma.currentPage.id,
      pageName: figma.currentPage.name,
      frameId: frame.id,
      frameName: frame.name,
      tree: serializeNode(frame),
    });
    return;
  }

  if (msg.type === "notify") {
    figma.notify(String(msg.message || ""), { error: !!msg.error });
  }
};
