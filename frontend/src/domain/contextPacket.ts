/** Context Packet contract for F-3 Web Context (observation vs inference). */

export const MAX_PACKET_SOURCES = 8;
export const MAX_PROMOTE_ITEMS = 5;
export const HINT_EXCERPT_MAX = 240;
export const WEB_SEARCH_QUERY_MAX = 400;

export type PacketStatus = "complete" | "partial" | "failed";
export type ClaimKind = "consensus" | "disagreement" | "minority" | "uncertainty" | "freshness";
export type ContextProviderId = "ollama-web" | "kagi-web" | "brave-web" | "fake-web";
export type WebSearchEntryRoute = "dialogue-agent" | "direct-action";

export interface ContextSource {
  sourceId: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  retrievedAt: string;
  clusterId?: string;
}

export interface ContextClaim {
  claimId: string;
  kind: ClaimKind;
  text: string;
  sourceIds: string[];
  relatedNodeIds?: string[];
}

export interface SuggestedPacketRelation {
  claimId?: string;
  sourceId?: string;
  targetNodeId: string;
  kind: "supports" | "opposes" | "similar";
  reason?: string;
}

export interface ContextPacketError {
  code: string;
  message: string;
}

export interface ContextPacket {
  packetId: string;
  query: string;
  retrievedAt: string;
  executor: "direct-tool";
  contextProvider: ContextProviderId;
  status: PacketStatus;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  runId?: string;
  runEpoch?: number;
  sources: ContextSource[];
  claims: ContextClaim[];
  suggestedRelations: SuggestedPacketRelation[];
  unresolved: string[];
  followups: string[];
  error?: ContextPacketError;
}

export interface WebSearchRequest {
  query: string;
  hintNodeIds?: string[];
  hintSummaries?: string[];
  knownUrls?: string[];
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  entryRoute: WebSearchEntryRoute;
  maxSources?: number;
  runId?: string;
  runEpoch?: number;
}

export interface NormalizedHttpsUrl {
  url: string;
  domain: string;
}

export const CLAIM_KINDS: readonly ClaimKind[] = [
  "consensus",
  "disagreement",
  "minority",
  "uncertainty",
  "freshness",
];

export function isClaimKind(value: string): value is ClaimKind {
  return (CLAIM_KINDS as readonly string[]).includes(value);
}

export function normalizeHttpsUrl(raw: string): NormalizedHttpsUrl | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: "web-search-invalid-url" };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: "web-search-invalid-url" };
  }
  if (parsed.protocol !== "https:") return { error: "web-search-invalid-url" };
  if (!parsed.hostname) return { error: "web-search-invalid-url" };
  if (parsed.username || parsed.password) return { error: "web-search-invalid-url" };
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  if (parsed.port === "443") parsed.port = "";
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }
  return { url: parsed.toString(), domain: parsed.hostname };
}

export function clusterIdForDomain(domain: string): string {
  return `cluster:${domain.toLowerCase()}`;
}

export function hintExcerpt(summary: string, content: string): string {
  const fromSummary = summary.trim();
  if (fromSummary) return fromSummary.slice(0, HINT_EXCERPT_MAX);
  const firstLine = content.trim().split(/\r?\n/, 1)[0] ?? "";
  return firstLine.slice(0, HINT_EXCERPT_MAX);
}

export function resolveWebSearchQuery(raw: string, hintSummaries: string[]): string {
  const query = raw.trim();
  const summary = hintSummaries.map((item) => item.trim()).find(Boolean);
  if (!query) return summary?.slice(0, WEB_SEARCH_QUERY_MAX) ?? "";
  if (query.length <= WEB_SEARCH_QUERY_MAX) return query;
  if (summary) return summary.slice(0, WEB_SEARCH_QUERY_MAX);
  const firstLine = query.split(/\r?\n/, 1)[0]?.trim() || query;
  return firstLine.slice(0, WEB_SEARCH_QUERY_MAX);
}

export function normalizeSources(
  inputs: Array<Pick<ContextSource, "sourceId" | "title" | "url" | "snippet" | "retrievedAt">>,
  maxSources = MAX_PACKET_SOURCES,
): { sources: ContextSource[]; unresolved: string[] } {
  const sources: ContextSource[] = [];
  const seen = new Set<string>();
  const unresolved: string[] = [];
  const limit = Math.min(Math.max(maxSources, 0), MAX_PACKET_SOURCES);
  for (const input of inputs) {
    const normalized = normalizeHttpsUrl(input.url);
    if ("error" in normalized) {
      unresolved.push(`invalid-url:${input.url}`);
      continue;
    }
    if (seen.has(normalized.url)) continue;
    seen.add(normalized.url);
    sources.push({
      sourceId: input.sourceId,
      title: input.title.trim() || normalized.url,
      url: normalized.url,
      domain: normalized.domain,
      snippet: input.snippet,
      retrievedAt: input.retrievedAt,
      clusterId: clusterIdForDomain(normalized.domain),
    });
    if (sources.length >= limit) break;
  }
  return { sources, unresolved };
}

export function normalizeClaims(
  claims: ContextClaim[],
  validSourceIds: Set<string>,
): { claims: ContextClaim[]; unresolved: string[] } {
  const out: ContextClaim[] = [];
  const unresolved: string[] = [];
  for (const claim of claims) {
    if (!isClaimKind(claim.kind)) {
      unresolved.push(`invalid-claim-kind:${claim.claimId}`);
      continue;
    }
    const text = claim.text.trim();
    if (!text) {
      unresolved.push(`empty-claim:${claim.claimId}`);
      continue;
    }
    const sourceIds = [...new Set(claim.sourceIds)].filter((id) => validSourceIds.has(id));
    if (sourceIds.length === 0) {
      unresolved.push(`claim-missing-source:${claim.claimId}`);
      continue;
    }
    out.push({
      ...claim,
      text,
      sourceIds,
    });
  }
  return { claims: out, unresolved };
}

export function normalizeSuggestedRelations(
  relations: SuggestedPacketRelation[],
  validSourceIds: Set<string>,
  validClaimIds: Set<string>,
  existingNodeIds: Set<string>,
): { relations: SuggestedPacketRelation[]; unresolved: string[] } {
  const out: SuggestedPacketRelation[] = [];
  const unresolved: string[] = [];
  for (const relation of relations) {
    if (!["supports", "opposes", "similar"].includes(relation.kind)) {
      unresolved.push(`invalid-relation-kind:${relation.targetNodeId}`);
      continue;
    }
    if (!existingNodeIds.has(relation.targetNodeId)) {
      unresolved.push(`relation-target-missing:${relation.targetNodeId}`);
      continue;
    }
    if (relation.claimId && !validClaimIds.has(relation.claimId)) {
      unresolved.push(`relation-claim-missing:${relation.claimId}`);
      continue;
    }
    if (relation.sourceId && !validSourceIds.has(relation.sourceId)) {
      unresolved.push(`relation-source-missing:${relation.sourceId}`);
      continue;
    }
    if (!relation.claimId && !relation.sourceId) {
      unresolved.push(`relation-missing-origin:${relation.targetNodeId}`);
      continue;
    }
    out.push(relation);
  }
  return { relations: out, unresolved };
}

export function normalizeContextPacket(
  packet: ContextPacket,
  existingNodeIds: Set<string> = new Set(),
): ContextPacket {
  if (packet.status === "failed") {
    return {
      ...packet,
      sources: [],
      claims: [],
      suggestedRelations: [],
      unresolved: packet.unresolved ?? [],
      followups: packet.followups ?? [],
    };
  }
  const normalizedSources = normalizeSources(packet.sources, MAX_PACKET_SOURCES);
  const sourceIds = new Set(normalizedSources.sources.map((source) => source.sourceId));
  const normalizedClaims = normalizeClaims(packet.claims, sourceIds);
  const claimIds = new Set(normalizedClaims.claims.map((claim) => claim.claimId));
  const normalizedRelations = normalizeSuggestedRelations(
    packet.suggestedRelations,
    sourceIds,
    claimIds,
    existingNodeIds,
  );
  const unresolved = [
    ...(packet.unresolved ?? []),
    ...normalizedSources.unresolved,
    ...normalizedClaims.unresolved,
    ...normalizedRelations.unresolved,
  ];
  let status: PacketStatus = packet.status;
  if (normalizedSources.sources.length === 0) {
    status = "failed";
  } else if (normalizedClaims.claims.length === 0) {
    status = "partial";
  }
  return {
    ...packet,
    status,
    sources: status === "failed" ? [] : normalizedSources.sources,
    claims: status === "failed" ? [] : normalizedClaims.claims,
    suggestedRelations: status === "failed" ? [] : normalizedRelations.relations,
    unresolved,
    followups: packet.followups ?? [],
    error:
      status === "failed"
        ? packet.error ?? { code: "web-search-empty", message: "No usable sources" }
        : packet.error,
  };
}

export function packetCorrelationMatches(
  packet: Pick<ContextPacket, "workspaceId" | "canvasId" | "runtimeGeneration" | "scopeEpoch" | "packetId">,
  expected: Pick<ContextPacket, "workspaceId" | "canvasId" | "runtimeGeneration" | "scopeEpoch"> & {
    packetId?: string;
  },
): boolean {
  if (packet.workspaceId !== expected.workspaceId) return false;
  if (packet.canvasId !== expected.canvasId) return false;
  if (packet.runtimeGeneration !== expected.runtimeGeneration) return false;
  if (packet.scopeEpoch !== expected.scopeEpoch) return false;
  if (expected.packetId && packet.packetId !== expected.packetId) return false;
  return true;
}

export function incomingPacketRejection(
  packet: ContextPacket,
  expected: {
    workspaceId: string;
    canvasId: string;
    runtimeGeneration: string;
    scopeEpoch: number;
  },
  entryRoute: WebSearchEntryRoute,
  run?: { runId: string; epoch: number; status: string },
): string | null {
  if (!packetCorrelationMatches(packet, expected)) return "promote-stale";
  if (entryRoute !== "dialogue-agent") return null;
  if (!packet.runId) return "promote-stale";
  if (packet.runEpoch == null) return "promote-stale";
  if (!run || run.runId !== packet.runId || run.status !== "active") return "promote-stale";
  if (packet.runEpoch !== run.epoch) return "promote-stale";
  return null;
}

export function countPromoteItems(claimIds: string[], sourceIds: string[]): number {
  return new Set(claimIds).size + new Set(sourceIds).size;
}
