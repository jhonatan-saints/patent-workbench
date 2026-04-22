import { useRef, useState } from 'react';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { generatePatentContent } from '@/api/client';
import { useWorkbenchStore } from '@/store/workbench';
import { useShallow } from 'zustand/react/shallow';
import { generateId } from '@/utils';


const DIAGRAM_PROMPT_PREFIX = `Read the following patent Full Description carefully and identify the key steps of the process.

Full Description:
`;

const DIAGRAM_PROMPT_SUFFIX = `

Now generate a flowchart JSON that accurately represents the steps described above.
IMPORTANT: Node labels MUST come from the Full Description — do NOT copy example labels.
Output ONLY the raw JSON object. No explanation, no markdown, no code fences.

Rules:
- node "type" must be one of: start, end, process, decision, io
- positions: use x=400,y=50 for the first node and increase y by 150 for each subsequent step; branch nodes offset x by +250
- all edge source/target values must match existing node ids
- output ONLY the JSON, nothing else

Example structure (labels must come from the description, not from this example):
{"nodes":[{"id":"1","type":"start","position":{"x":400,"y":50},"data":{"label":"Start"}},{"id":"2","type":"process","position":{"x":400,"y":200},"data":{"label":"Step A"}},{"id":"3","type":"decision","position":{"x":400,"y":350},"data":{"label":"Condition?"}},{"id":"4","type":"process","position":{"x":650,"y":350},"data":{"label":"Alt step"}},{"id":"5","type":"end","position":{"x":400,"y":500},"data":{"label":"End"}}],"edges":[{"id":"e1","source":"1","target":"2"},{"id":"e2","source":"2","target":"3"},{"id":"e3","source":"3","target":"4"},{"id":"e4","source":"3","target":"5"},{"id":"e5","source":"4","target":"5"}]}

Output ONLY the JSON, nothing else`;

interface DiagramResult {
  nodes: Node[];
  edges: Edge[];
}

function stripFences(text: string): string {
  return text.replaceAll(/```(?:json)?\n?/gi, '').replaceAll('```', '').trim();
}

function fixTrailingCommas(s: string): string {
  // Remove trailing commas before ] or }
  return s.replaceAll(/,(\s*[}\]])/g, '$1');
}

function extractJson(text: string): string | null {
  // Prefer a block that starts with {"nodes" to avoid partial matches
  const targeted = /\{\s*"nodes"\s*:[\s\S]*\}/.exec(text);
  if (targeted) return targeted[0];
  const fallback = /\{[\s\S]*\}/.exec(text);
  return fallback ? fallback[0] : null;
}

const X_CENTER = 400;
const X_BRANCH_OFFSET = 260;
const Y_START = 60;
const Y_STEP = 160;

function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const childrenOf: Record<string, string[]> = {};
  const parentsOf: Record<string, string[]> = {};
  for (const n of nodes) { childrenOf[n.id] = []; parentsOf[n.id] = []; }
  for (const e of edges) {
    childrenOf[e.source]?.push(e.target);
    parentsOf[e.target]?.push(e.source);
  }

  // Assign depth via longest-path from roots
  const depth: Record<string, number> = {};
  function visit(id: string, d: number) {
    if ((depth[id] ?? -1) >= d) return;
    depth[id] = d;
    for (const c of childrenOf[id] ?? []) visit(c, d + 1);
  }
  const roots = nodes.filter(n => parentsOf[n.id].length === 0);
  (roots.length ? roots : [nodes[0]]).forEach(r => visit(r.id, 0));
  nodes.forEach(n => { depth[n.id] ??= 0; });

  // Group nodes by depth level
  const byLevel: Record<number, string[]> = {};
  for (const [id, d] of Object.entries(depth)) {
    byLevel[d] ??= [];
    byLevel[d].push(id);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  for (const [lvlStr, ids] of Object.entries(byLevel)) {
    const lvl = Number(lvlStr);
    const y = Y_START + lvl * Y_STEP;
    const count = ids.length;
    const totalW = (count - 1) * X_BRANCH_OFFSET;
    ids.forEach((id, i) => {
      positions[id] = { x: X_CENTER - totalW / 2 + i * X_BRANCH_OFFSET, y };
    });
  }

  return nodes.map(n => ({ ...n, position: positions[n.id] ?? n.position }));
}

function edgeHandles(
  sp: { x: number; y: number },
  tp: { x: number; y: number }
): { sourceHandle: string; targetHandle: string } {
  const dx = tp.x - sp.x;
  const dy = tp.y - sp.y;
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0
      ? { sourceHandle: 'bottom', targetHandle: 'top' }
      : { sourceHandle: 'top', targetHandle: 'bottom' };
  }
  return dx > 0
    ? { sourceHandle: 'right', targetHandle: 'left' }
    : { sourceHandle: 'left', targetHandle: 'right' };
}

function parseAIResponse(text: string): DiagramResult | null {
  const clean = stripFences(text);
  const raw = extractJson(clean);
  if (!raw) return null;

  const jsonStr = fixTrailingCommas(raw);

  try {
    const parsed = JSON.parse(jsonStr) as { nodes?: unknown[]; edges?: unknown[] };
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;

    const rawNodes = (parsed.nodes as Node[]).map((n) => ({
      ...n,
      id: String(n.id ?? generateId()),
    }));

    const nodeIds = new Set(rawNodes.map((n) => n.id));

    const rawEdges = (parsed.edges as Edge[])
      .filter((e) => nodeIds.has(String(e.source)) && nodeIds.has(String(e.target)))
      .map((e) => ({
        ...e,
        id: String(e.id ?? generateId()),
        source: String(e.source),
        target: String(e.target),
        type: e.type ?? 'default',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#555' },
        style: { strokeWidth: 2, stroke: '#555' },
      }));

    // Override model positions with a clean layered layout
    const nodes = autoLayout(rawNodes, rawEdges);

    // Compute handles from final positions so arrows enter/exit the correct side
    const posMap = Object.fromEntries(nodes.map((n) => [n.id, n.position]));
    const edges = rawEdges.map((e) => ({
      ...e,
      ...edgeHandles(posMap[e.source] ?? { x: 0, y: 0 }, posMap[e.target] ?? { x: 0, y: 0 }),
    }));

    return { nodes, edges };
  } catch {
    return null;
  }
}

export function useGenerateDiagram() {
  const { artifact, setDiagramGenerating } = useWorkbenchStore(
    useShallow(s => ({ artifact: s.artifact, setDiagramGenerating: s.setDiagramGenerating }))
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setAll = (v: boolean) => {
    setGenerating(v);
    setDiagramGenerating(v);
  };

  const fullDescription = artifact?.sections['full_description']?.content?.trim() ?? '';
  const canGenerate = fullDescription.length > 0;

  const generate = async (): Promise<DiagramResult | null> => {
    if (!artifact || !canGenerate) return null;
    abortRef.current = new AbortController();
    setAll(true);
    setError(null);
    try {
      const context = fullDescription;
      const result = await generatePatentContent(
        { prompt: `${DIAGRAM_PROMPT_PREFIX}${context}${DIAGRAM_PROMPT_SUFFIX}`, model: artifact.model },
        abortRef.current.signal
      );
      if (!result.success) {
        setError(result.error);
        return null;
      }
      const parsed = parseAIResponse(result.data.response);
      if (!parsed) {
        setError('Could not parse diagram from AI response.');
        return null;
      }
      return parsed;
    } finally {
      setAll(false);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setAll(false);
  };

  return { generating, error, generate, cancel, canGenerate };
}
