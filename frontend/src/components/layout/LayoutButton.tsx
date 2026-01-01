import React from "react";
import { Layers } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import dagre from "dagre";

const LayoutButton: React.FC = () => {
  const { nodes, edges, setNodes } = useAppStore();

  const handleLayout = () => {
    if (nodes.length === 0) return;

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 100, ranksep: 200 });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((node) => {
      // Use node width/height if available, otherwise defaults
      const width = node.width || 250;
      const height = node.height || 150;
      g.setNode(node.id, { width, height });
    });

    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = g.node(node.id);
      const width = node.width || 250;
      const height = node.height || 150;

      return {
        ...node,
        position: {
          // Dagre returns the center of the node, React Flow expects top-left
          x: nodeWithPosition.x - width / 2,
          y: nodeWithPosition.y - height / 2,
        },
      };
    });

    setNodes(layoutedNodes);
  };

  return (
    <button
      onClick={handleLayout}
      className="p-2 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
      title="Auto Layout Nodes"
    >
      <Layers size={16} />
    </button>
  );
};

export default LayoutButton;
