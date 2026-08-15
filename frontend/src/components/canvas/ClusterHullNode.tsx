import type React from "react";
import type { NodeProps, Node } from "@xyflow/react";

export interface ClusterHullNodeData extends Record<string, unknown> {
  label: string;
  width: number;
  height: number;
  color: string;
}

export type ClusterHullNodeType = Node<ClusterHullNodeData, "clusterHull">;

/**
 * Non-interactive pseudo node that renders a translucent cluster hull behind
 * member nodes. It is injected for display only and never touches the document.
 */
const ClusterHullNode: React.FC<NodeProps<ClusterHullNodeType>> = ({
  data,
}) => {
  return (
    <div
      className="pointer-events-none rounded-lg border-2"
      style={{
        width: data.width,
        height: data.height,
        borderColor: data.color,
        backgroundColor: `${data.color}14`,
      }}
      data-testid={`cluster-hull-${data.label}`}
    >
      <div
        className="px-2 py-0.5 text-[11px] font-bold"
        style={{ color: data.color }}
        aria-hidden="true"
      >
        {data.label}
      </div>
    </div>
  );
};

export default ClusterHullNode;
