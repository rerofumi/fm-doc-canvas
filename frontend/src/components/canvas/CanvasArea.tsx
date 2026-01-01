import React, { useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  NodeTypes,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useAppStore } from "../../store/useAppStore";
import CustomNode from "./CustomNode";
import ImageNode from "./ImageNode";
import ContextMenu from "../ui/ContextMenu";
import { AppNode, AppEdge } from "../../types";
import * as AppBackend from "../../../wailsjs/go/main/App";

const nodeTypes: NodeTypes = {
  customNode: CustomNode,
  imageNode: ImageNode as any, // 型の不一致を一時的に回避
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
  const reactFlowInstance = useReactFlow();
  const { addNode } = useAppStore();

  // Memoize addNode to prevent unnecessary re-renders
  const memoizedAddNode = useCallback(
    (node: any) => {
      addNode(node);
    },
    [addNode],
  );

  // Enable file drop

  // Enable file drop
  useEffect(() => {
    const handleFileDrop = (x: number, y: number, paths: string[]) => {
      console.log("Files dropped at", x, y, paths);
      // Implement file import logic
      // This will involve calling the backend ImportFile method for each path
      // and then adding the appropriate node (TextNode or ImageNode) to the canvas
      paths.forEach(async (filePath) => {
        try {
          const result: any = await AppBackend.ImportFile(filePath);

          // Convert screen coordinates to flow coordinates
          const flowPosition = reactFlowInstance.screenToFlowPosition({
            x,
            y,
          });

          if (result.type === "text") {
            // Add a new text node
            const newNode: AppNode = {
              id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: "customNode",
              position: flowPosition,
              data: {
                content: result.content,
                summary:
                  result.content.substring(0, 100) +
                  (result.content.length > 100 ? "..." : ""),
              },
              width: 200,
              height: 100,
            };
            memoizedAddNode(newNode);
          } else if (result.type === "image") {
            // Add a new image node
            const newNode: AppNode = {
              id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: "imageNode",
              position: flowPosition,
              data: {
                src: result.content, // This should be the relative path
                alt: `Imported image from ${filePath}`,
              },
              width: 300,
              height: 200,
            };
            memoizedAddNode(newNode);
          }
        } catch (error) {
          console.error("Failed to import file:", filePath, error);
          alert(`Failed to import file: ${filePath}`);
        }
      });
    };

    // Register the file drop handler with Wails runtime
    // Note: This requires enabling file drop in main.go options.App
    const wailsRuntime: any = (window as any).runtime; // Type assertion to avoid TS errors
    if (wailsRuntime) {
      // Enable drop target highlighting
      wailsRuntime.OnFileDrop(handleFileDrop, true); // useDropTarget = true
    }

    // Cleanup
    return () => {
      if (wailsRuntime) {
        wailsRuntime.OnFileDrop(null, false);
      }
    };
  }, [memoizedAddNode, reactFlowInstance]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: AppNode) => {
      // Only set active node for text nodes (customNode)
      // Image nodes cannot be edited, so don't set them as active
      if (node.type === "customNode") {
        setActiveNode(node.id);
      }
      setMenu(null);
    },
    [setActiveNode],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: AppNode) => {
      // Only open drawer for text nodes (customNode)
      // Image nodes cannot be edited, so don't open the drawer
      if (node.type === "customNode") {
        setActiveNode(node.id);
        setDrawerOpen(true);
      }
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
        // Enable file drop target
        // useDropTarget is not a valid prop in newer versions of React Flow
        // It's handled through the OnFileDrop registration above
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
