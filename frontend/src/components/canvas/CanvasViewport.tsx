import {
  Background,
  BackgroundVariant,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useState } from "react";
import { OnFileDrop, OnFileDropOff } from "../../../wailsjs/runtime/runtime";
import { hasWailsRuntime } from "../../services/wailsBridge";
import { useCanvasStore } from "../../store/useCanvasStore";
import type { CanvasNode } from "../../types/canvas";
import { ContextMenu, type ContextMenuState } from "../overlay/ContextMenu";
import { ImageCardNode } from "./ImageCardNode";
import { TextCardNode } from "./TextCardNode";

const nodeTypes = {
  customNode: TextCardNode,
  imageNode: ImageCardNode,
};

export function CanvasViewport() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const importFilesAtPosition = useCanvasStore(
    (s) => s.importFilesAtPosition,
  );
  const { screenToFlowPosition } = useReactFlow();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    if (!hasWailsRuntime()) {
      return;
    }

    OnFileDrop((x, y, paths) => {
      if (!paths || paths.length === 0) return;
      const flowPos = screenToFlowPosition({ x, y });
      void importFilesAtPosition(paths, flowPos);
    }, false);

    return () => {
      OnFileDropOff();
    };
  }, [importFilesAtPosition, screenToFlowPosition]);

  const closeMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (selectedNodeIds.length > 1 && selectedNodeIds.includes(node.id)) {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          target: { kind: "multiSelection", nodeIds: selectedNodeIds },
        });
        return;
      }

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target:
          node.type === "imageNode"
            ? { kind: "imageNode", nodeId: node.id }
            : { kind: "textNode", nodeId: node.id },
      });
    },
    [selectedNodeIds],
  );

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target: { kind: "edge", edgeId: edge.id },
      });
    },
    [],
  );

  const handleSelectionContextMenu = useCallback(
    (event: React.MouseEvent, selectedNodes: Node[]) => {
      event.preventDefault();
      if (selectedNodes.length <= 1) return;
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target: {
          kind: "multiSelection",
          nodeIds: selectedNodes.map((n) => n.id),
        },
      });
    },
    [],
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow<CanvasNode, Edge>
        nodes={nodes}
        edges={edges as Edge[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(connection) => {
          onConnect(connection);
        }}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onSelectionContextMenu={handleSelectionContextMenu}
        onPaneClick={closeMenu}
        onMoveEnd={(_event, viewport) => setZoom(viewport.zoom)}
        minZoom={0.1}
        maxZoom={4.0}
        panOnDrag
        panActivationKeyCode="Space"
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        deleteKeyCode={["Delete", "Backspace"]}
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#cbd5e1"
        />
      </ReactFlow>

      <ContextMenu menu={contextMenu} onClose={closeMenu} />
    </div>
  );
}
