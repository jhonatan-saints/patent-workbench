import { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  useReactFlow,
  type Connection,
  type NodeProps,
  type Node,
  type Edge,
  MarkerType,
  getNodesBounds,
  getViewportForBounds,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button, Group, Text, Box, TextInput } from '@mantine/core';
import { IconTrash, IconCheck, IconSquare, IconDiamond } from '@tabler/icons-react';
import { toPng } from 'html-to-image';
import { generateId } from '@/utils/sanitize';
import type { FigureItem } from '@/types';

const IMAGE_W = 900;
const IMAGE_H = 500;

function ProcessNode(props: Readonly<NodeProps>) {
  const { data, selected } = props;
  return (
    <div
      style={{
        padding: '8px 20px',
        borderRadius: 4,
        border: `2px solid ${selected ? 'var(--accent, #6366f1)' : '#bbb'}`,
        background: '#fff',
        fontSize: 13,
        fontFamily: 'monospace',
        minWidth: 120,
        textAlign: 'center',
        color: '#111',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} />
      <span>{(data.label as string) || 'Step'}</span>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function DecisionNode(props: Readonly<NodeProps>) {
  const { data, selected } = props;
  return (
    <div style={{ width: 110, height: 110, position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={{ top: 2, left: '50%' }} />
      <Handle type="target" position={Position.Left} style={{ left: 2, top: '50%' }} />
      <div
        style={{
          position: 'absolute',
          inset: 12,
          background: '#fff',
          border: `2px solid ${selected ? 'var(--accent, #6366f1)' : '#bbb'}`,
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
          padding: '0 18px',
          pointerEvents: 'none',
          color: '#111',
        }}
      >
        {(data.label as string) || '?'}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ bottom: 2, left: '50%' }} />
      <Handle type="source" position={Position.Right} style={{ right: 2, top: '50%' }} />
    </div>
  );
}

const NODE_TYPES = { process: ProcessNode, decision: DecisionNode };

interface DiagramEditorProps {
  onAddFigure: (figure: FigureItem) => void;
  figureNumber: number;
}

function DiagramEditorInner(props: Readonly<DiagramEditorProps>) {
  const { onAddFigure, figureNumber } = props;
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const { getNodes } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  const onConnect = useCallback(
    (connection: Connection & { id?: string; sourceHandle?: string | null; targetHandle?: string | null }) =>
      setEdges((eds: Edge[]) => {
        const newEdge: Edge = {
          id: connection.id ?? generateId(),
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 2, stroke: '#555' },
        };
        return addEdge(newEdge, eds);
      }),
    [setEdges]
  );

  const onSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
    if (sel.length === 1) {
      setSelectedId(sel[0].id);
      setLabelInput((sel[0].data.label as string) || '');
    } else {
      setSelectedId(null);
    }
  }, []);

  const applyLabel = useCallback(() => {
    if (!selectedId) return;
    setNodes((nds: Node[]) =>
      nds.map((n: Node) => (n.id === selectedId ? { ...n, data: { ...n.data, label: labelInput } } : n))
    );
  }, [selectedId, labelInput, setNodes]);

  const addNode = useCallback(
    (type: 'process' | 'decision') => {
      const newNode: Node = {
        id: generateId(),
        type,
        position: { x: 80 + Math.random() * 300, y: 80 + Math.random() * 150 },
        data: { label: type === 'process' ? 'New Step' : 'Decision' },
      };
      setNodes((nds: Node[]) => [...nds, newNode]);
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

    try {
      const dataUrl = await toPng(rfViewport, {
        backgroundColor: '#ffffff',
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
    }
  }, [getNodes, onAddFigure, figureNumber]);

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Group
        gap={8}
        p="8px 14px"
        wrap="nowrap"
        style={{
          background: 'var(--surface-raised)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <Button
          size="xs"
          variant="default"
          leftSection={<IconSquare size={12} />}
          onClick={() => addNode('process')}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
        >
          + PROCESS
        </Button>
        <Button
          size="xs"
          variant="default"
          leftSection={<IconDiamond size={12} />}
          onClick={() => addNode('decision')}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
        >
          + DECISION
        </Button>

        {selectedId && (
          <>
            <Box style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
            <TextInput
              size="xs"
              value={labelInput}
              onChange={(e) => setLabelInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyLabel();
              }}
              placeholder="Node label…"
              style={{ width: 180 }}
              styles={{
                input: {
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                },
              }}
            />
            <Button
              size="xs"
              variant="default"
              onClick={applyLabel}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
            >
              RENAME
            </Button>
          </>
        )}

        <Box style={{ flex: 1 }} />

        <Button
          size="xs"
          variant="subtle"
          color="red"
          leftSection={<IconTrash size={12} />}
          onClick={() => {
            setNodes([]);
            setEdges([]);
          }}
          disabled={nodes.length === 0}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
        >
          CLEAR
        </Button>
        <Button
          size="xs"
          leftSection={<IconCheck size={12} />}
          onClick={handleExport}
          disabled={nodes.length === 0}
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            border: 'none',
          }}
        >
          ADD TO FIGURES
        </Button>
      </Group>

      {/* Canvas */}
      <div ref={canvasRef} style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          nodeTypes={NODE_TYPES}
          fitView
          deleteKeyCode="Delete"
          style={{ background: '#fafafa' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#ccc" />
          <Controls />
        </ReactFlow>
      </div>

      {/* Hint bar */}
      <Box
        p="5px 14px"
        style={{
          background: 'var(--surface-raised)',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <Text size="xs" c="var(--text-muted)" ff="monospace">
          Click to select · Select a node to rename it · Drag from handles to connect · Delete key removes selected
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
