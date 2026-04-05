import { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeResizer,
  useReactFlow,
  ConnectionMode,
  type Connection,
  type NodeProps,
  type Node,
  type Edge,
  MarkerType,
  getViewportForBounds,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button, Group, Text, Box, TextInput, Switch, ColorInput, Select } from '@mantine/core';
import { useI18n } from '@/i18n/useI18n';
import {
  IconTrash,
  IconCheck,
  IconSquare,
  IconDiamond,
  IconPlayerPlay,
  IconPlayerStop,
  IconArrowsRightLeft,
} from '@tabler/icons-react';
import { toPng } from 'html-to-image';
import { generateId } from '@/utils/sanitize';
import type { FigureItem } from '@/types';

const IMAGE_W = 900;
const IMAGE_H = 500;

const H_STYLE: React.CSSProperties = {
  width: 10,
  height: 10,
  background: '#888',
  border: '2px solid #fff',
  borderRadius: '50%',
  zIndex: 10,
};

function AllHandles() {
  return (
    <>
      <Handle type="source" position={Position.Top} id="top" style={H_STYLE} />
      <Handle type="source" position={Position.Right} id="right" style={H_STYLE} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={H_STYLE} />
      <Handle type="source" position={Position.Left} id="left" style={H_STYLE} />
    </>
  );
}

function ProcessNode({ data, selected }: Readonly<NodeProps>) {
  const bg = (data.bgColor as string) || '#ffffff';
  const border = (data.borderColor as string) || '#aaaaaa';
  const color = (data.fontColor as string) || '#111111';
  return (
    <div
      style={{
        padding: '8px 20px',
        borderRadius: 4,
        border: `2px solid ${selected ? '#6366f1' : border}`,
        background: bg,
        fontSize: 13,
        fontFamily: 'monospace',
        width: '100%',
        height: '100%',
        textAlign: 'center',
        color,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <NodeResizer
        minWidth={80}
        minHeight={36}
        isVisible={selected}
        lineStyle={{ border: '1px dashed #6366f1' }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      <AllHandles />
      <span>{(data.label as string) || 'Process'}</span>
    </div>
  );
}

function DecisionNode({ data, selected }: Readonly<NodeProps>) {
  const bg = (data.bgColor as string) || '#ffffff';
  const border = (data.borderColor as string) || '#aaaaaa';
  const color = (data.fontColor as string) || '#111111';
  return (
    <div
      style={{ width: '100%', height: '100%', minWidth: 100, minHeight: 100, position: 'relative' }}
    >
      <NodeResizer
        minWidth={100}
        minHeight={100}
        isVisible={selected}
        lineStyle={{ border: '1px dashed #6366f1' }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      <AllHandles />
      <div
        style={{
          position: 'absolute',
          inset: 10,
          background: bg,
          border: `2px solid ${selected ? '#6366f1' : border}`,
          transform: 'rotate(45deg)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontFamily: 'monospace',
          textAlign: 'center',
          padding: '0 20px',
          pointerEvents: 'none',
          color,
        }}
      >
        {(data.label as string) || 'Decision?'}
      </div>
    </div>
  );
}

function StartNode({ data, selected }: Readonly<NodeProps>) {
  const bg = (data.bgColor as string) || '#d1fae5';
  const border = (data.borderColor as string) || '#10b981';
  const color = (data.fontColor as string) || '#111111';
  return (
    <div
      style={{
        padding: '8px 28px',
        borderRadius: 999,
        border: `2px solid ${selected ? '#6366f1' : border}`,
        background: bg,
        fontSize: 12,
        fontFamily: 'monospace',
        width: '100%',
        height: '100%',
        textAlign: 'center',
        color,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <NodeResizer
        minWidth={80}
        minHeight={36}
        isVisible={selected}
        lineStyle={{ border: '1px dashed #6366f1' }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      <AllHandles />
      <span>{(data.label as string) || 'Start'}</span>
    </div>
  );
}

function EndNode({ data, selected }: Readonly<NodeProps>) {
  const bg = (data.bgColor as string) || '#fee2e2';
  const border = (data.borderColor as string) || '#ef4444';
  const color = (data.fontColor as string) || '#111111';
  const ringColor = selected ? '#6366f1' : border;
  return (
    <div
      style={{
        padding: '8px 28px',
        borderRadius: 999,
        border: `2px solid ${ringColor}`,
        background: bg,
        fontSize: 12,
        fontFamily: 'monospace',
        width: '100%',
        height: '100%',
        textAlign: 'center',
        color,
        position: 'relative',
        boxShadow: `0 0 0 4px ${ringColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <NodeResizer
        minWidth={80}
        minHeight={36}
        isVisible={selected}
        lineStyle={{ border: '1px dashed #6366f1' }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      <AllHandles />
      <span>{(data.label as string) || 'End'}</span>
    </div>
  );
}

function IONode({ data, selected }: Readonly<NodeProps>) {
  const bg = (data.bgColor as string) || '#eff6ff';
  const border = (data.borderColor as string) || '#3b82f6';
  const color = (data.fontColor as string) || '#111111';
  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', minWidth: 100, minHeight: 36 }}
    >
      <NodeResizer
        minWidth={100}
        minHeight={36}
        isVisible={selected}
        lineStyle={{ border: '1px dashed #6366f1' }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      <AllHandles />
      <div
        style={{
          padding: '8px 20px',
          background: bg,
          border: `2px solid ${selected ? '#6366f1' : border}`,
          fontSize: 12,
          fontFamily: 'monospace',
          textAlign: 'center',
          color,
          transform: 'skewX(-15deg)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ display: 'inline-block', transform: 'skewX(15deg)' }}>
          {(data.label as string) || 'Input/Output'}
        </span>
      </div>
    </div>
  );
}

const NODE_TYPES = {
  process: ProcessNode,
  decision: DecisionNode,
  start: StartNode,
  end: EndNode,
  io: IONode,
};

const EDGE_TYPE_OPTIONS = [
  { value: 'default', label: 'Bezier' },
  { value: 'straight', label: 'Straight' },
  { value: 'step', label: 'Step' },
  { value: 'smoothstep', label: 'Smooth Step' },
];

const NODE_DEFAULTS: Record<
  string,
  { label: string; bgColor: string; borderColor: string; fontColor: string }
> = {
  process: { label: 'Process', bgColor: '#ffffff', borderColor: '#aaaaaa', fontColor: '#111111' },
  decision: {
    label: 'Decision?',
    bgColor: '#ffffff',
    borderColor: '#aaaaaa',
    fontColor: '#111111',
  },
  start: { label: 'Start', bgColor: '#d1fae5', borderColor: '#10b981', fontColor: '#111111' },
  end: { label: 'End', bgColor: '#fee2e2', borderColor: '#ef4444', fontColor: '#111111' },
  io: { label: 'Input/Output', bgColor: '#eff6ff', borderColor: '#3b82f6', fontColor: '#111111' },
};

const BTN = { fontFamily: 'var(--font-mono)', fontSize: 11, flexShrink: 0 } as const;

interface DiagramEditorProps {
  onAddFigure: (figure: FigureItem) => void;
  figureNumber: number;
}

function DiagramEditorInner({ onAddFigure, figureNumber }: Readonly<DiagramEditorProps>) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [labelInput, setLabelInput] = useState('');
  const [nodeBg, setNodeBg] = useState('#ffffff');
  const [nodeBorder, setNodeBorder] = useState('#aaaaaa');
  const [nodeFontColor, setNodeFontColor] = useState('#111111');
  const [edgeColor, setEdgeColor] = useState('#555555');
  const [edgeType, setEdgeType] = useState('default');
  const [edgeLabelInput, setEdgeLabelInput] = useState('');

  const [transparentBg, setTransparentBg] = useState(false);
  const { getNodes, getNodesBounds, getEdges } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds: Edge[]) => {
        const newEdge: Edge = {
          id: generateId(),
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
          type: 'default',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#555' },
          style: { strokeWidth: 2, stroke: '#555' },
        };
        return addEdge(newEdge, eds);
      }),
    [setEdges]
  );

  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      if (selNodes.length === 1 && selEdges.length === 0) {
        const n = selNodes[0];
        setSelectedNodeId(n.id);
        setSelectedEdgeId(null);
        setLabelInput((n.data.label as string) || '');
        setNodeBg((n.data.bgColor as string) || '#ffffff');
        setNodeBorder((n.data.borderColor as string) || '#aaaaaa');
        setNodeFontColor((n.data.fontColor as string) || '#111111');
      } else if (selEdges.length === 1 && selNodes.length === 0) {
        const e = selEdges[0];
        setSelectedEdgeId(e.id);
        setSelectedNodeId(null);
        setEdgeColor((e.style?.stroke as string) || '#555555');
        setEdgeType((e.type as string) || 'default');
        setEdgeLabelInput((e.label as string) || '');
      } else {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
      }
    },
    []
  );

  const applyLabel = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((nds: Node[]) =>
      nds.map((n: Node) =>
        n.id === selectedNodeId ? { ...n, data: { ...n.data, label: labelInput } } : n
      )
    );
  }, [selectedNodeId, labelInput, setNodes]);

  const applyNodeColors = useCallback(
    (bg: string, border: string, fontColor: string) => {
      if (!selectedNodeId) return;
      setNodes((nds: Node[]) =>
        nds.map((n: Node) =>
          n.id === selectedNodeId
            ? { ...n, data: { ...n.data, bgColor: bg, borderColor: border, fontColor } }
            : n
        )
      );
    },
    [selectedNodeId, setNodes]
  );

  const applyEdgeStyle = useCallback(
    (color: string, type: string, label: string) => {
      if (!selectedEdgeId) return;
      setEdges((eds: Edge[]) =>
        eds.map((e: Edge) =>
          e.id === selectedEdgeId
            ? {
                ...e,
                type,
                label: label || undefined,
                style: { ...e.style, stroke: color },
                markerEnd: { type: MarkerType.ArrowClosed, color },
              }
            : e
        )
      );
    },
    [selectedEdgeId, setEdges]
  );

  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      setNodes((nds: Node[]) => nds.filter((n: Node) => n.id !== selectedNodeId));
      setEdges((eds: Edge[]) =>
        eds.filter((e: Edge) => e.source !== selectedNodeId && e.target !== selectedNodeId)
      );
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      setEdges((eds: Edge[]) => eds.filter((e: Edge) => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
    }
  }, [selectedNodeId, selectedEdgeId, setNodes, setEdges]);

  const addNode = useCallback(
    (type: keyof typeof NODE_TYPES) => {
      const d = NODE_DEFAULTS[type];
      const nodeId = generateId();
      setNodes((nds: Node[]) => [
        ...nds.map((n: Node) => ({ ...n, selected: false })),
        {
          id: nodeId,
          type,
          position: { x: 100 + Math.random() * 280, y: 80 + Math.random() * 160 },
          data: { ...d },
          selected: true,
        },
      ]);
      // Auto-select so color/label controls appear immediately
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      setLabelInput(d.label);
      setNodeBg(d.bgColor);
      setNodeBorder(d.borderColor);
      setNodeFontColor(d.fontColor);
    },
    [setNodes]
  );

  const handleExport = useCallback(async () => {
    const allNodes = getNodes();
    if (allNodes.length === 0) return;
    const rfViewport = canvasRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
    if (!rfViewport) return;
    const bounds = getNodesBounds(allNodes);
    const vp = getViewportForBounds(bounds, IMAGE_W, IMAGE_H, 0.5, 2, 0.2);

    // Build set of handles that have at least one connection
    const connectedHandles = new Set<string>();
    getEdges().forEach((edge) => {
      if (edge.source && edge.sourceHandle)
        connectedHandles.add(`${edge.source}__${edge.sourceHandle}`);
      if (edge.target && edge.targetHandle)
        connectedHandles.add(`${edge.target}__${edge.targetHandle}`);
    });

    // Hide unconnected handles before export
    const hiddenHandles: HTMLElement[] = [];
    rfViewport.querySelectorAll<HTMLElement>('.react-flow__handle').forEach((el) => {
      const nodeId = el.dataset.nodeid;
      const handleId = el.dataset.handleid;
      if (nodeId && handleId && !connectedHandles.has(`${nodeId}__${handleId}`)) {
        el.style.visibility = 'hidden';
        hiddenHandles.push(el);
      }
    });

    try {
      const dataUrl = await toPng(rfViewport, {
        backgroundColor: transparentBg ? undefined : '#ffffff',
        width: IMAGE_W,
        height: IMAGE_H,
        style: {
          width: `${IMAGE_W}px`,
          height: `${IMAGE_H}px`,
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
          transformOrigin: '0 0',
        },
      });
      onAddFigure({
        id: generateId(),
        dataUrl,
        name: `Figure ${figureNumber}`,
        caption: '',
        width: IMAGE_W,
        height: IMAGE_H,
        type: 'diagram',
      });
    } catch (err) {
      console.error('Diagram export failed:', err);
    } finally {
      hiddenHandles.forEach((el) => (el.style.visibility = ''));
    }
  }, [getNodes, getNodesBounds, getEdges, onAddFigure, figureNumber, transparentBg]);

  const hasSelection = selectedNodeId !== null || selectedEdgeId !== null;

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Box
        p="6px 10px"
        style={{
          background: 'var(--surface-raised)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {/* Row 1: node type buttons */}
        <Group gap={4} wrap="nowrap" mb={4}>
          <Text
            size="xs"
            ff="monospace"
            c="dimmed"
            style={{ flexShrink: 0, fontSize: 10 }}
            className="uppercase"
          >
            {t('res_DiagramAddLabel')}
          </Text>
          <Button
            size="xs"
            variant="light"
            color="teal"
            leftSection={<IconPlayerPlay size={11} />}
            onClick={() => addNode('start')}
            style={BTN}
            className="uppercase"
          >
            {t('res_DiagramStart')}
          </Button>
          <Button
            size="xs"
            variant="light"
            color="indigo"
            leftSection={<IconSquare size={11} />}
            onClick={() => addNode('process')}
            style={BTN}
            className="uppercase"
          >
            {t('res_DiagramProcess')}
          </Button>
          <Button
            size="xs"
            variant="light"
            color="orange"
            leftSection={<IconDiamond size={11} />}
            onClick={() => addNode('decision')}
            style={BTN}
            className="uppercase"
          >
            {t('res_DiagramDecision')}
          </Button>
          <Button
            size="xs"
            variant="light"
            color="blue"
            leftSection={<IconArrowsRightLeft size={11} />}
            onClick={() => addNode('io')}
            style={BTN}
            className="uppercase"
          >
            {t('res_DiagramIO')}
          </Button>
          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconPlayerStop size={11} />}
            onClick={() => addNode('end')}
            style={BTN}
            className="uppercase"
          >
            {t('res_DiagramEnd')}
          </Button>

          <Box style={{ flex: 1 }} />

          <Group gap={8}>
            <Switch
              size="xs"
              checked={transparentBg}
              onChange={(e) => setTransparentBg(e.currentTarget.checked)}
              label={
                <Text size="xs" ff="monospace" c="dimmed" className="uppercase">
                  {t('res_DiagramTransparentBg')}
                </Text>
              }
            />
            <Button
              size="xs"
              variant="outline"
              color="red"
              leftSection={<IconTrash size={11} />}
              onClick={() => {
                setNodes([]);
                setEdges([]);
              }}
              disabled={nodes.length === 0}
              style={BTN}
              className="uppercase"
            >
              {t('res_DiagramClearAll')}
            </Button>
            <Button
              size="xs"
              leftSection={<IconCheck size={11} />}
              onClick={handleExport}
              disabled={nodes.length === 0}
              style={{
                ...BTN,
                background: 'var(--accent)',
                color: 'var(--accent-text)',
                border: 'none',
              }}
              className="uppercase"
            >
              {t('res_DiagramAddToFigures')}
            </Button>
          </Group>
        </Group>

        {/* Row 2: selection controls (only shown when something is selected) */}
        {hasSelection && (
          <Group gap={6} wrap="nowrap" pt={4} style={{ borderTop: '1px solid var(--border)' }}>
            {selectedNodeId && (
              <>
                <Text
                  size="xs"
                  ff="monospace"
                  c="dimmed"
                  style={{ flexShrink: 0, fontSize: 10 }}
                  className="uppercase"
                >
                  {t('res_DiagramNodeLabel')}
                </Text>
                <TextInput
                  size="xs"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyLabel();
                  }}
                  placeholder={t('res_DiagramPlaceholderLabel')}
                  style={{ width: 140, flexShrink: 0 }}
                  styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: 12 } }}
                />
                <Button
                  size="xs"
                  variant="outline"
                  color="gray"
                  onClick={applyLabel}
                  style={BTN}
                  className="uppercase"
                >
                  {t('res_DiagramRename')}
                </Button>
                <ColorInput
                  size="xs"
                  value={nodeBg}
                  onChange={(v) => {
                    setNodeBg(v);
                    applyNodeColors(v, nodeBorder, nodeFontColor);
                  }}
                  placeholder={t('res_DiagramPlaceholderFillColor')}
                  style={{ width: 110, flexShrink: 0 }}
                  format="hex"
                  withEyeDropper={false}
                  popoverProps={{ zIndex: 9999 }}
                  swatches={[
                    '#ffffff',
                    '#f1f5f9',
                    '#dbeafe',
                    '#d1fae5',
                    '#fef9c3',
                    '#fee2e2',
                    '#ede9fe',
                    '#fce7f3',
                    '#111827',
                    '#374151',
                  ]}
                  styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: 11 } }}
                />
                <ColorInput
                  size="xs"
                  value={nodeBorder}
                  onChange={(v) => {
                    setNodeBorder(v);
                    applyNodeColors(nodeBg, v, nodeFontColor);
                  }}
                  placeholder={t('res_DiagramPlaceholderBorderColor')}
                  style={{ width: 110, flexShrink: 0 }}
                  format="hex"
                  withEyeDropper={false}
                  popoverProps={{ zIndex: 9999 }}
                  swatches={[
                    '#aaaaaa',
                    '#6366f1',
                    '#10b981',
                    '#ef4444',
                    '#3b82f6',
                    '#f59e0b',
                    '#8b5cf6',
                    '#ec4899',
                    '#111827',
                    '#000000',
                  ]}
                  styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: 11 } }}
                />
                <ColorInput
                  size="xs"
                  value={nodeFontColor}
                  onChange={(v) => {
                    setNodeFontColor(v);
                    applyNodeColors(nodeBg, nodeBorder, v);
                  }}
                  placeholder={t('res_DiagramPlaceholderFontColor')}
                  style={{ width: 110, flexShrink: 0 }}
                  format="hex"
                  withEyeDropper={false}
                  popoverProps={{ zIndex: 9999 }}
                  swatches={[
                    '#111111',
                    '#000000',
                    '#ffffff',
                    '#6366f1',
                    '#10b981',
                    '#ef4444',
                    '#3b82f6',
                    '#f59e0b',
                    '#8b5cf6',
                    '#ec4899',
                  ]}
                  styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: 11 } }}
                />
              </>
            )}

            {selectedEdgeId && (
              <>
                <Text
                  size="xs"
                  ff="monospace"
                  c="dimmed"
                  style={{ flexShrink: 0, fontSize: 10 }}
                  className="uppercase"
                >
                  {t('res_DiagramEdgeLabel')}
                </Text>
                <ColorInput
                  size="xs"
                  value={edgeColor}
                  onChange={(v) => {
                    setEdgeColor(v);
                    applyEdgeStyle(v, edgeType, edgeLabelInput);
                  }}
                  placeholder={t('res_DiagramPlaceholderLineColor')}
                  style={{ width: 110, flexShrink: 0 }}
                  format="hex"
                  withEyeDropper={false}
                  popoverProps={{ zIndex: 9999 }}
                  swatches={[
                    '#555555',
                    '#000000',
                    '#6366f1',
                    '#10b981',
                    '#ef4444',
                    '#3b82f6',
                    '#f59e0b',
                    '#8b5cf6',
                    '#ec4899',
                    '#ffffff',
                  ]}
                  styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: 11 } }}
                />
                <Select
                  size="xs"
                  data={EDGE_TYPE_OPTIONS}
                  value={edgeType}
                  onChange={(v) => {
                    if (!v) return;
                    setEdgeType(v);
                    applyEdgeStyle(edgeColor, v, edgeLabelInput);
                  }}
                  style={{ width: 120, flexShrink: 0 }}
                  styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: 11 } }}
                />
                <TextInput
                  size="xs"
                  value={edgeLabelInput}
                  onChange={(e) => setEdgeLabelInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyEdgeStyle(edgeColor, edgeType, edgeLabelInput);
                  }}
                  placeholder={t('res_DiagramPlaceholderEdgeLabel')}
                  style={{ width: 170, flexShrink: 0 }}
                  styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: 11 } }}
                />
                <Button
                  size="xs"
                  variant="outline"
                  color="gray"
                  onClick={() => applyEdgeStyle(edgeColor, edgeType, edgeLabelInput)}
                  style={BTN}
                >
                  {t('res_DiagramApply')}
                </Button>
              </>
            )}

            <Box style={{ flex: 1 }} />

            <Button
              size="xs"
              variant="filled"
              color="red"
              leftSection={<IconTrash size={11} />}
              onClick={deleteSelected}
              style={BTN}
              className="uppercase"
            >
              {t('res_DiagramDelete')}
            </Button>
          </Group>
        )}
      </Box>

      {/* Canvas */}
      <div ref={canvasRef} style={{ flex: 1 }}>
        <style>{`
          .react-flow__controls-button {
            background: var(--surface-raised);
            border-bottom: 1px solid var(--border);
            color: var(--text-primary);
            fill: var(--text-primary);
          }
          .react-flow__controls-button:hover {
            background: var(--surface-active, var(--surface));
          }
          .react-flow__controls-button svg {
            fill: var(--text-primary);
          }
          .react-flow__minimap-mask {
            fill: var(--surface);
            opacity: 0.6;
          }
        `}</style>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          nodeTypes={NODE_TYPES}
          connectionMode={ConnectionMode.Loose}
          fitView
          deleteKeyCode={['Delete', 'Backspace']}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'var(--surface)' }}
          defaultEdgeOptions={{
            type: 'default',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#888' },
            style: { strokeWidth: 2, stroke: '#888' },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
          <Controls
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              boxShadow: 'none',
              overflow: 'hidden',
            }}
          />
          <MiniMap
            zoomable
            pannable
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
            nodeColor={(n) => (n.data?.bgColor as string) || 'var(--surface-raised)'}
          />
        </ReactFlow>
      </div>

      {/* Hint bar */}
      <Box
        p="4px 12px"
        style={{
          background: 'var(--surface-raised)',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <Text size="xs" c="var(--text-muted)" ff="monospace">
          {t('res_DiagramHint')}
        </Text>
      </Box>
    </Box>
  );
}

export function DiagramEditor(props: Readonly<DiagramEditorProps>) {
  return (
    <ReactFlowProvider>
      <DiagramEditorInner {...props} />
    </ReactFlowProvider>
  );
}
