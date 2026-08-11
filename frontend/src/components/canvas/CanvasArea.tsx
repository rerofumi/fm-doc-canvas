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
import ArtifactNode from "./ArtifactNode";
import FolderNode from "./FolderNode";
import ContextMenu from "../ui/ContextMenu";
import RelationEditorDialog, {
  RelationEditorValue,
  RelationKindOption,
} from "../ui/RelationEditorDialog";
import { AppNode, AppEdge } from "../../types";
import * as AppBackend from "../../../wailsjs/go/main/App";
import { OnFileDrop, OnFileDropOff } from "../../../wailsjs/runtime/runtime";
import { isTextBearing } from "../../domain/workspace";

const nodeTypes: NodeTypes = {
  customNode: CustomNode,
  imageNode: ImageNode as any, // 型の不一致を一時的に回避
  artifactNode: ArtifactNode as any,
  folderNode: FolderNode as any,
};

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;

const CanvasArea: React.FC = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setActiveNode,
    setEditorOpen,
    deleteNode,
    deleteEdge,
  } = useAppStore();

  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    id: string;
    type: "node" | "edge";
  } | null>(null);
  const [relationEditor, setRelationEditor] = useState<
    | {
        mode: "create" | "edit";
        relationId?: string;
        initial: RelationEditorValue;
        nodeOptions: Array<{ id: string; label: string }>;
      }
    | null
  >(null);
  const reactFlowInstance = useReactFlow();
  const { addNode, navigateCanvas, createSubCanvas, dispatch, runDirectTransform } = useAppStore() as any;

  const nodeOptionsForEditor = useCallback(() => {
    const workspace = useAppStore.getState().workspace;
    return Object.values(workspace.document.nodes)
      .filter((node) => node.parentCanvasId === workspace.runtime.currentCanvasId)
      .map((node) => ({
        id: node.id,
        label: isTextBearing(node)
          ? `${node.id}: ${(node.content || "").slice(0, 32) || node.kind}`
          : `${node.id}: ${node.kind}`,
      }));
  }, []);

  const openCreateRelation = useCallback(() => {
    if (!menu || menu.type !== "node") return;
    const selected = nodes.filter((node) => node.selected).map((node) => node.id);
    const ids = selected.includes(menu.id) ? selected : [...selected, menu.id];
    if (ids.length < 2) {
      useAppStore.setState({ lastError: "Select 2+ nodes to add a Relation" });
      return;
    }
    const [source, target] = ids;
    setRelationEditor({
      mode: "create",
      initial: {
        sourceNodeId: source,
        targetNodeId: target,
        kind: "supports",
        reason: "",
        direction: "forward",
      },
      nodeOptions: nodeOptionsForEditor(),
    });
  }, [menu, nodes, nodeOptionsForEditor]);

  const openEditRelation = useCallback(() => {
    if (!menu || menu.type !== "edge") return;
    const relation = useAppStore.getState().workspace.document.relations[menu.id];
    if (!relation) return;
    setRelationEditor({
      mode: "edit",
      relationId: menu.id,
      initial: {
        sourceNodeId: relation.sourceNodeId,
        targetNodeId: relation.targetNodeId,
        kind: (relation.kind === "context" ? "supports" : relation.kind) as RelationKindOption,
        reason: relation.reason || "",
        direction: "forward",
      },
      nodeOptions: nodeOptionsForEditor(),
    });
  }, [menu, nodeOptionsForEditor]);

  const submitRelationEditor = useCallback(
    (value: RelationEditorValue) => {
      const sourceNodeId = value.direction === "reverse" ? value.targetNodeId : value.sourceNodeId;
      const targetNodeId = value.direction === "reverse" ? value.sourceNodeId : value.targetNodeId;
      if (relationEditor?.mode === "create") {
        dispatch({
          type: "addRelation",
          relation: {
            id: `relation-${Date.now()}`,
            sourceNodeId,
            targetNodeId,
            kind: value.kind,
            status: "accepted",
            reason: value.reason.trim() || undefined,
            provenance: { origin: "user" },
          },
        });
      } else if (relationEditor?.mode === "edit" && relationEditor.relationId) {
        const current = useAppStore.getState().workspace.document.relations[relationEditor.relationId];
        dispatch({
          type: "updateRelation",
          id: relationEditor.relationId,
          patch: {
            kind: value.kind,
            reason: value.reason.trim() || undefined,
          },
        });
        if (
          current &&
          current.sourceNodeId === targetNodeId &&
          current.targetNodeId === sourceNodeId
        ) {
          dispatch({ type: "reverseRelation", id: relationEditor.relationId });
        }
      }
      setRelationEditor(null);
    },
    [dispatch, relationEditor],
  );

  // E2E: open the real ContextMenu component without relying on overlapping RF hit targets.
  useEffect(() => {
    (window as any).__E2E_OPEN_CONTEXT_MENU__ = (target: {
      type: "node" | "edge";
      id: string;
      x?: number;
      y?: number;
    }) => {
      setMenu({
        x: target.x ?? 240,
        y: target.y ?? 180,
        id: target.id,
        type: target.type,
      });
    };
    return () => {
      delete (window as any).__E2E_OPEN_CONTEXT_MENU__;
    };
  }, []);

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
            const basename = (result as any).filename || filePath.split(/[/\\\\]/).pop() || "untitled.md";
            const newNode: AppNode = {
              id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: "artifactNode",
              position: flowPosition,
              data: {
                content: result.content,
                summary: result.content.substring(0, 100) + (result.content.length > 100 ? "..." : ""),
                filename: basename,
                language: "markdown",
                revision: 0,
                charCount: result.content.length,
                wordCount: result.content.trim() ? result.content.trim().split(/\s+/).length : 0,
              },
              width: 300,
              height: 220,
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
    OnFileDrop(handleFileDrop, true);

    // Cleanup
    return () => {
      OnFileDropOff();
    };
  }, [memoizedAddNode, reactFlowInstance]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: AppNode) => {
      // React Flow updates its selection before this click callback. Preserve
      // that latest set for modifier-key clicks instead of collapsing it back
      // to the clicked node. An explicit call also keeps controlled domain and
      // projected React Flow selection synchronized across rerenders.
      const preserveSelection = event.ctrlKey || event.metaKey || event.shiftKey;
      // Modifier-clicking an already selected node is React Flow's toggle-off
      // path. Let its onNodesChange event remove the node instead of adding it
      // back through the active-node synchronization below.
      if (!(preserveSelection && node.selected)) {
        setActiveNode(node.id, preserveSelection);
      }
      if (node.type !== "customNode" && node.type !== "artifactNode") {
        // Images remain preview-only but can still be a chat/context target.
        setEditorOpen(false);
      }
      setMenu(null);
    },
    [setActiveNode, setEditorOpen],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: AppNode) => {
      if (node.type === "folderNode") {
        const childId = (node.data as any).childCanvasId;
        if (childId) navigateCanvas(childId);
      } else if (node.type === "customNode" || node.type === "artifactNode") {
        setActiveNode(node.id);
        setEditorOpen(true);
      }
      setMenu(null);
    },
    [setActiveNode, setEditorOpen, navigateCanvas],
  );

  const onPaneClick = useCallback(() => {
    setActiveNode(null);
    setEditorOpen(false);
    setMenu(null);
  }, [setActiveNode, setEditorOpen]);

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

  // Export handlers
  const handleExport = useCallback(async () => {
    if (!menu || menu.type !== "node") return;

    try {
      await useAppStore.getState().exportNode(menu.id);
      setMenu(null);
    } catch (error: any) {
      console.error("Failed to export node:", error);
      alert(`Failed to export node: ${error.message || "Unknown error"}`);
    }
  }, [menu]);

  const handleExportMarp = useCallback(async () => {
    if (!menu || menu.type !== "node") return;

    try {
      // Get all selected nodes
      const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);

      // If the right-clicked node isn't in the selection, add it
      const nodeIdsToExport = selectedNodeIds.includes(menu.id)
        ? selectedNodeIds
        : [...selectedNodeIds, menu.id];

      await useAppStore.getState().exportNodesAsMarp(nodeIdsToExport);
      setMenu(null);
    } catch (error: any) {
      console.error("Failed to export node as Marp:", error);
      alert(
        `Failed to export node as Marp: ${error.message || "Unknown error"}`,
      );
    }
  }, [menu, nodes]);

  return (
    <div
      className="w-full h-full"
      style={{ "--wails-drop-target": "drop" } as React.CSSProperties}
    >
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
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        multiSelectionKeyCode={["Control", "Meta", "Shift"]}
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
          onExport={menu.type === "node" ? handleExport : undefined}
          onExportMarp={menu.type === "node" ? handleExportMarp : undefined}
          onCreateSubCanvas={menu.type === "node" ? () => {
            const selected = nodes.filter(n => n.selected).map(n => n.id);
            const ids = selected.length >= 2 ? selected : [menu.id, ...selected].filter((v,i,a)=>a.indexOf(v)===i);
            if (ids.length >= 2) createSubCanvas(ids);
            else alert("Select 2+ nodes to create a SubCanvas");
          } : undefined}
          onTransform={menu.type === "node" ? (operation) => { void runDirectTransform(operation); } : undefined}
          onAddRelation={menu.type === "node" ? openCreateRelation : undefined}
          onEditRelation={menu.type === "edge" ? openEditRelation : undefined}
          onReverseRelation={menu.type === "edge" ? () => { dispatch({ type: "reverseRelation", id: menu.id }); } : undefined}
        />
      )}

      {relationEditor && (
        <RelationEditorDialog
          title={relationEditor.mode === "create" ? "Add Relation" : "Edit Relation"}
          initial={relationEditor.initial}
          nodeOptions={relationEditor.nodeOptions}
          onSubmit={submitRelationEditor}
          onCancel={() => setRelationEditor(null)}
        />
      )}
    </div>
  );
};

export default CanvasArea;


