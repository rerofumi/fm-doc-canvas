import React, { useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useAppStore } from "../../store/useAppStore";
import CustomNode from "./CustomNode";
import ContextMenu from "../ui/ContextMenu";
import { AppNode, AppEdge } from "../../types";

const nodeTypes: NodeTypes = {
  customNode: CustomNode,
};

const CanvasArea: React.FC = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setActiveNode,
    setDrawerOpen,
    deleteNode,
    deleteEdge,
  } = useAppStore();

  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    id: string;
    type: "node" | "edge";
  } | null>(null);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: AppNode) => {
      setActiveNode(node.id);
      setMenu(null);
    },
    [setActiveNode],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: AppNode) => {
      setActiveNode(node.id);
      setDrawerOpen(true);
      setMenu(null);
    },
    [setActiveNode, setDrawerOpen],
  );

  const onPaneClick = useCallback(() => {
    setActiveNode(null);
    setDrawerOpen(false);
    setMenu(null);
  }, [setActiveNode, setDrawerOpen]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: AppNode) => {
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        id: node.id,
        type: "node",
      });
    },
    [],
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: AppEdge) => {
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        id: edge.id,
        type: "edge",
      });
    },
    [],
  );

  const handleDelete = useCallback(() => {
    if (!menu) return;
    if (menu.type === "node") {
      deleteNode(menu.id);
    } else {
      deleteEdge(menu.id);
    }
    setMenu(null);
  }, [menu, deleteNode, deleteEdge]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
        <Panel position="top-right">
          <div className="bg-white p-2 rounded shadow-md border border-gray-200">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              Canvas Mode
            </p>
          </div>
        </Panel>
      </ReactFlow>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label={menu.type === "node" ? "Node" : "Edge"}
          onClose={() => setMenu(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default CanvasArea;
