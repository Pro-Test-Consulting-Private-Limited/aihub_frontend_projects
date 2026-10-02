"use client";

import {
  Background,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import { TbMinus, TbPlus, TbTopologyStar3 } from "react-icons/tb";
import type { CanvasEdge, CanvasNode } from "@/app/interfaces/appatlas";
import { AtlasScreenNode, NODE_HEIGHT, NODE_WIDTH, ScreenNode } from "./screen-node";
import { BUTTON_EDGE_COLOR, LINK_EDGE_COLOR, Legend, type LegendFilter } from "./legend";

const nodeTypes: NodeTypes = { screen: ScreenNode };

const GAP_X = 170;
const GAP_Y = 50;

/** Left-to-right by distance from the first screen; each column centred vertically. */
function layout(nodes: CanvasNode[], edges: CanvasEdge[]) {
  const depth = new Map<string, number>();
  if (nodes[0]) {
    depth.set(nodes[0].id, 0);
    const queue = [nodes[0].id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of edges) {
        if (e.source === id && !depth.has(e.target)) {
          depth.set(e.target, depth.get(id)! + 1);
          queue.push(e.target);
        }
      }
    }
  }
  let maxDepth = Math.max(0, ...depth.values());
  for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, ++maxDepth);

  const columns = new Map<number, string[]>();
  for (const n of nodes) {
    const d = depth.get(n.id)!;
    columns.set(d, [...(columns.get(d) ?? []), n.id]);
  }
  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, ids] of columns) {
    ids.forEach((id, row) => {
      pos.set(id, {
        x: d * (NODE_WIDTH + GAP_X),
        y: (row - (ids.length - 1) / 2) * (NODE_HEIGHT + GAP_Y),
      });
    });
  }
  return pos;
}

function highlighted(nodes: CanvasNode[], edges: CanvasEdge[], filter: LegendFilter) {
  if (!filter) return null;
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  for (const n of nodes) if ((n.pageObjectCounts?.[filter.type] ?? 0) > 0) nodeIds.add(n.id);
  for (const e of edges) if (nodeIds.has(e.source) && nodeIds.has(e.target)) edgeIds.add(e.id);
  return { nodeIds, edgeIds };
}

type Props = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  editable: boolean;
  focusNodeId?: string | null;
  /** Highlighted node (its side panel is open). */
  selectedNodeId?: string | null;
  jiraCounts?: Record<string, number>;
  onSelectNode?: (id: string | null) => void;
};

type Preview = { url: string; title: string };

function Flow({ nodes, edges, editable, focusNodeId, selectedNodeId, jiraCounts, onSelectNode }: Props) {
  const [filter, setFilter] = useState<LegendFilter>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPreview(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  const positions = useMemo(() => layout(nodes, edges), [nodes, edges]);
  const hl = useMemo(() => highlighted(nodes, edges, filter), [nodes, edges, filter]);

  const flowNodes = useMemo<AtlasScreenNode[]>(
    () =>
      nodes.map((screen) => ({
        id: screen.id,
        type: "screen",
        position: positions.get(screen.id) ?? { x: 0, y: 0 },
        data: {
          screen,
          dimmed: hl ? !hl.nodeIds.has(screen.id) : false,
          selected: (selectedNodeId ?? focusNodeId) === screen.id,
          onOpenShot: (url: string) => setPreview({ url, title: screen.title || screen.path }),
          jiraCount: jiraCounts?.[screen.id],
        },
      })),
    [nodes, positions, hl, focusNodeId, selectedNodeId, jiraCounts],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => {
        const color = e.lineStyle === "dotted" ? LINK_EDGE_COLOR : BUTTON_EDGE_COLOR;
        const dim = hl ? !hl.edgeIds.has(e.id) : false;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label || e.elementLabel,
          style: {
            stroke: color,
            strokeWidth: 1.6,
            strokeDasharray: e.lineStyle === "dotted" ? "6 4" : undefined,
            opacity: dim ? 0.15 : 1,
          },
          labelStyle: { fill: "#1F1F1F", fontSize: 11, opacity: dim ? 0.2 : 1 },
          labelBgStyle: { fill: "#F9FAFC", fillOpacity: dim ? 0.2 : 1 },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        };
      }),
    [edges, hl],
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<AtlasScreenNode>(flowNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>(flowEdges);

  // Keep positions the user dragged; only refresh data and add new nodes.
  useEffect(() => {
    setRfNodes((prev) => {
      const moved = new Map(prev.map((n) => [n.id, n.position]));
      return flowNodes.map((n) => ({ ...n, position: moved.get(n.id) ?? n.position }));
    });
  }, [flowNodes, setRfNodes]);
  useEffect(() => setRfEdges(flowEdges), [flowEdges, setRfEdges]);

  useEffect(() => {
    if (focusNodeId) fitView({ nodes: [{ id: focusNodeId }], duration: 400, maxZoom: 1.1 });
  }, [focusNodeId, fitView]);

  return (
    <div className="relative h-full w-full bg-[#F7F7FA] dark:bg-[#0a0a0a]">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onSelectNode ? (_, node) => onSelectNode(node.id) : undefined}
        onPaneClick={onSelectNode ? () => onSelectNode(null) : undefined}
        nodeTypes={nodeTypes}
        nodesDraggable={editable}
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} color="#E5E7EB" />
      </ReactFlow>

      <div className={`absolute bottom-4 z-10 flex flex-col items-end gap-2 transition-[right] ${selectedNodeId ? "right-[376px]" : "right-4"}`}>
        {legendOpen && <Legend filter={filter} onChange={setFilter} onClose={() => setLegendOpen(false)} />}
        <div className="flex items-center gap-2">
          <div className="flex h-[32px] items-center rounded-[6px] border border-[#E6E1F5] bg-white text-[12px] text-[#1F1F1F] shadow-sm dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#ededed]">
            <button type="button" onClick={() => zoomOut({ duration: 150 })} className="flex h-full w-[30px] items-center justify-center hover:text-[#8664F2]" aria-label="Zoom out">
              <TbMinus size={14} />
            </button>
            <button type="button" onClick={() => fitView({ duration: 300, padding: 0.2 })} className="h-full w-[52px] border-x border-[#E6E1F5] dark:border-[#2a2a2a]" title="Fit to screen">
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" onClick={() => zoomIn({ duration: 150 })} className="flex h-full w-[30px] items-center justify-center hover:text-[#8664F2]" aria-label="Zoom in">
              <TbPlus size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setLegendOpen((o) => !o)}
            className={`flex h-[32px] items-center gap-1.5 rounded-[6px] border px-3 text-[12px] shadow-sm ${
              legendOpen || filter
                ? "border-[#8664F2] bg-[#F2EBFB] text-[#8664F2] dark:bg-[#2a2440]"
                : "border-[#E6E1F5] bg-white text-[#1F1F1F] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#ededed]"
            }`}
          >
            <TbTopologyStar3 size={14} />
            Legend
          </button>
        </div>
      </div>

      {preview && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-8 backdrop-blur-[1px]"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt={preview.title}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-[10px] border border-white/20 bg-white object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}

export function CanvasFlow(props: Props) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}
