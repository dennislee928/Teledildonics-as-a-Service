import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  ReactFlow,
  addEdge, 
  Background, 
  Controls, 
  MiniMap,
  Connection,
  Edge,
  Node,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Inbound Event ($ Tip)' },
    position: { x: 250, y: 5 },
  },
  {
    id: '2',
    data: { label: 'Step Mapper (Amount -> Intensity)' },
    position: { x: 250, y: 100 },
  },
  {
    id: '3',
    type: 'output',
    data: { label: 'Device Command (Vibrate)' },
    position: { x: 250, y: 200 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
];

function RuleDesigner() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onSave = () => {
    console.log('Saving RuleSet Graph...', { nodes, edges });
    alert('RuleSet saved locally (demo)');
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
        <Panel position="top-right">
            <button onClick={onSave} style={{ padding: '10px', cursor: 'pointer' }}>
                Save Logic Graph
            </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<RuleDesigner />);
}
