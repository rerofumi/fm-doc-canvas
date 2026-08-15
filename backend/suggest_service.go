package backend

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Relation batch / Cluster View suggestion limits. These are enforced both in
// the backend (request + tool validation + parse) and the frontend UI.
const (
	MaxRelationBatch      = 8
	MaxClusterViewClusters = 8
	MaxClusterViewNodes    = 40
	MinClusterViewClusters = 2
)

// buildSuggestSourceBody renders the allowlisted source nodes into a provider
// prompt. Text/artifact bodies are inlined; images are metadata-only here (the
// caller resolves vision pixels separately).
func BuildSuggestSourceBody(sourceNodeIDs []string, sourceNodes []NodeSnapshot) (string, []TransformSourcePreview, error) {
	byID := make(map[string]NodeSnapshot, len(sourceNodes))
	for _, node := range sourceNodes {
		byID[node.ID] = node
	}
	sections := make([]string, 0, len(sourceNodeIDs))
	previews := make([]TransformSourcePreview, 0, len(sourceNodeIDs))
	for _, id := range sourceNodeIDs {
		node, ok := byID[id]
		if !ok {
			return "", nil, fmt.Errorf("source node body missing for %q", id)
		}
		switch node.Type {
		case "text", "artifact":
			sections = append(sections, fmt.Sprintf("Node %s (%s, revision %d):\n%s", node.ID, node.Type, node.Revision, node.Markdown))
			previews = append(previews, TransformSourcePreview{NodeID: id, Content: node.Markdown, Revision: node.Revision})
		case "image":
			sections = append(sections, fmt.Sprintf("Node %s (image, revision %d):\nimageRef=%s\nprompt=%s", node.ID, node.Revision, node.ImageRef, node.Prompt))
		}
	}
	return strings.Join(sections, "\n\n"), previews, nil
}

// resolveSuggestVisionImages resolves allowlisted vision images to data URLs.
// A missing / malformed asset fails closed before any provider call, matching
// the F4 vision contract.
func ResolveSuggestVisionImages(sourceNodeIDs []string, sourceNodes []NodeSnapshot, assets ImageAssetPort) ([]string, error) {
	byID := make(map[string]NodeSnapshot, len(sourceNodes))
	for _, node := range sourceNodes {
		byID[node.ID] = node
	}
	images := make([]string, 0, 3)
	for _, id := range sourceNodeIDs {
		node, ok := byID[id]
		if !ok || node.Type != "image" || !node.ImageIncluded {
			continue
		}
		if assets == nil {
			return nil, fmt.Errorf("image-invalid-asset: image asset service is unavailable")
		}
		dataURL, err := assets.GetImageDataURL(node.ImageRef)
		if err != nil || !strings.HasPrefix(dataURL, "data:image/") || !strings.Contains(dataURL, ";base64,") {
			return nil, fmt.Errorf("image-invalid-asset: %s", node.ImageRef)
		}
		images = append(images, dataURL)
	}
	return images, nil
}

// trimJSON extracts the first JSON object from a provider response.
func trimJSON(raw string) string {
	raw = strings.TrimSpace(raw)
	if i := strings.Index(raw, "{"); i >= 0 {
		if j := strings.LastIndex(raw, "}"); j > i {
			return raw[i : j+1]
		}
	}
	return raw
}

func validRelationKind(kind string) bool {
	return kind == "source" || kind == "derived" || kind == "supports" || kind == "opposes" || kind == "similar"
}

func normalizeDirection(direction string) string {
	if direction != "reverse" {
		return "forward"
	}
	return "reverse"
}

// parseSuggestRelations parses and validates a Relation batch JSON response.
// Direction resolves to effective endpoints; duplicate pair+kind is rejected.
func ParseSuggestRelations(raw string, sourceNodeIDs []string) ([]RelationBatchItem, error) {
	validNodeIDs := SourceIDSet(sourceNodeIDs)
	var parsed struct {
		Relations []RelationBatchItem `json:"relations"`
	}
	if err := json.Unmarshal([]byte(trimJSON(raw)), &parsed); err != nil {
		return nil, fmt.Errorf("invalid relation batch JSON: %w", err)
	}
	if len(parsed.Relations) == 0 {
		return nil, fmt.Errorf("relation-batch-empty")
	}
	if len(parsed.Relations) > MaxRelationBatch {
		return nil, fmt.Errorf("relation-batch-cap-exceeded")
	}
	seen := map[string]bool{}
	out := make([]RelationBatchItem, 0, len(parsed.Relations))
	for _, item := range parsed.Relations {
		item.Direction = normalizeDirection(item.Direction)
		from, to := item.SourceNodeID, item.TargetNodeID
		if item.Direction == "reverse" {
			from, to = to, from
		}
		item.SourceNodeID, item.TargetNodeID = from, to
		if from == "" || to == "" {
			return nil, fmt.Errorf("relation-endpoint-missing")
		}
		if from == to {
			return nil, fmt.Errorf("self-relation")
		}
		if !validNodeIDs[from] || !validNodeIDs[to] {
			return nil, fmt.Errorf("relation-endpoint-out-of-scope")
		}
		if !validRelationKind(item.Kind) {
			return nil, fmt.Errorf("invalid relation kind")
		}
		key := from + "|" + to + "|" + item.Kind
		if seen[key] {
			return nil, fmt.Errorf("duplicate relation in batch")
		}
		seen[key] = true
		out = append(out, item)
	}
	return out, nil
}

// parseSuggestClusters parses and validates a Cluster View JSON response.
func ParseSuggestClusters(raw string, sourceNodeIDs []string) (viewLabel string, clusters []ClusterViewCluster, ungrouped []string, err error) {
	validNodeIDs := SourceIDSet(sourceNodeIDs)
	var parsed struct {
		Label    string              `json:"label"`
		Clusters []ClusterViewCluster `json:"clusters"`
		Ungrouped []string           `json:"ungroupedNodeIds"`
	}
	if err := json.Unmarshal([]byte(trimJSON(raw)), &parsed); err != nil {
		return "", nil, nil, fmt.Errorf("invalid cluster view JSON: %w", err)
	}
	if len(parsed.Clusters) < MinClusterViewClusters {
		return "", nil, nil, fmt.Errorf("cluster-view-requires-2-clusters")
	}
	if len(parsed.Clusters) > MaxClusterViewClusters {
		return "", nil, nil, fmt.Errorf("cluster-view-cap-exceeded")
	}
	seen := map[string]bool{}
	total := 0
	cleaned := make([]ClusterViewCluster, 0, len(parsed.Clusters))
	for _, c := range parsed.Clusters {
		if strings.TrimSpace(c.Label) == "" {
			return "", nil, nil, fmt.Errorf("cluster-label-required")
		}
		if len(c.NodeIDs) == 0 {
			return "", nil, nil, fmt.Errorf("cluster-member-empty")
		}
		ids := make([]string, 0, len(c.NodeIDs))
		for _, id := range c.NodeIDs {
			if !validNodeIDs[id] {
				return "", nil, nil, fmt.Errorf("cluster-member-out-of-scope")
			}
			if seen[id] {
				return "", nil, nil, fmt.Errorf("cluster-member-duplicate")
			}
			seen[id] = true
			ids = append(ids, id)
			total++
		}
		c.NodeIDs = ids
		cleaned = append(cleaned, c)
	}
	if total > MaxClusterViewNodes {
		return "", nil, nil, fmt.Errorf("cluster-view-node-cap-exceeded")
	}
	ungrouped = make([]string, 0, len(parsed.Ungrouped))
	for _, id := range parsed.Ungrouped {
		if !validNodeIDs[id] {
			return "", nil, nil, fmt.Errorf("cluster-ungrouped-out-of-scope")
		}
		if seen[id] {
			return "", nil, nil, fmt.Errorf("cluster-ungrouped-duplicate")
		}
		ungrouped = append(ungrouped, id)
	}
	return parsed.Label, cleaned, ungrouped, nil
}

// SourceIDSet builds a lookup of the allowlisted source IDs.
func SourceIDSet(sourceNodeIDs []string) map[string]bool {
	set := make(map[string]bool, len(sourceNodeIDs))
	for _, id := range sourceNodeIDs {
		set[id] = true
	}
	return set
}
