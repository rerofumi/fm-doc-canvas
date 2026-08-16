/**
 * Per-run ordering for transport events.
 *
 * The transport may deliver a run's events out of order, while legacy test
 * adapters omit sequence metadata altogether.  This module deliberately has
 * no store or UI dependency so the ordering and bounded-cleanup rules can be
 * tested without mounting the drawer.
 */
export interface OrderedEventQueueOptions<E> {
  getRunId: (event: E) => string | undefined;
  onEvent: (event: E) => void;
  isTerminal: (event: E) => boolean;
  /** Maximum number of runs retained in the active/tombstone maps. */
  maxRuns?: number;
  /** Maximum number of buffered events for one run. */
  maxPendingEvents?: number;
  /** Maximum missing sequence distance tolerated for one run. */
  maxSequenceGap?: number;
  /** Maximum producer sequence accepted before fail-closed cleanup. */
  maxSequence?: number;
  /** A missing sequence cannot keep a run buffered forever. */
  maxGapAgeMs?: number;
  now?: () => number;
  onDiagnostic?: (diagnostic: OrderedEventQueueDiagnostic) => void;
}

export type OrderedEventQueueDiagnostic = {
  runId: string;
  reason:
    | "invalid-run"
    | "invalid-sequence"
    | "sequence-gap"
    | "pending-overflow"
    | "run-overflow"
    | "gap-expired";
};

export type OrderedEventEnqueueResult =
  | { status: "processed"; processed: number }
  | { status: "queued"; pending: number }
  | { status: "duplicate" }
  | { status: "dropped"; reason: OrderedEventQueueDiagnostic["reason"] };

type RunState<E> = {
  next: number;
  pending: Map<number, E>;
  gapStartedAt?: number;
};

const DEFAULT_MAX_RUNS = 128;
const DEFAULT_MAX_PENDING_EVENTS = 64;
const DEFAULT_MAX_SEQUENCE_GAP = 256;
const DEFAULT_MAX_SEQUENCE = 1_000_000;
const DEFAULT_MAX_GAP_AGE_MS = 30_000;

export interface OrderedEventQueue<E> {
  enqueue: (event: E, sequence?: number) => OrderedEventEnqueueResult;
  /** Expire runs whose missing sequence has remained unresolved. */
  expire: (at?: number) => number;
  /** Drop local queue state. A run is not marked cancelled by this method. */
  clear: (runId?: string) => void;
  activeRunCount: () => number;
  pendingCount: (runId: string) => number;
}

export const createOrderedEventQueue = <E>(options: OrderedEventQueueOptions<E>): OrderedEventQueue<E> => {
  const maxRuns = Math.max(1, options.maxRuns ?? DEFAULT_MAX_RUNS);
  const maxPendingEvents = Math.max(1, options.maxPendingEvents ?? DEFAULT_MAX_PENDING_EVENTS);
  const maxSequenceGap = Math.max(1, options.maxSequenceGap ?? DEFAULT_MAX_SEQUENCE_GAP);
  const maxSequence = Math.max(1, options.maxSequence ?? DEFAULT_MAX_SEQUENCE);
  const maxGapAgeMs = Math.max(1, options.maxGapAgeMs ?? DEFAULT_MAX_GAP_AGE_MS);
  const now = options.now ?? (() => Date.now());
  const runs = new Map<string, RunState<E>>();
  // Tombstones prevent a duplicate terminal event from creating a fresh
  // pending queue, while the bound prevents stale runs from accumulating.
  const closedRuns = new Set<string>();

  const diagnostic = (runId: string, reason: OrderedEventQueueDiagnostic["reason"]) => {
    options.onDiagnostic?.({ runId, reason });
  };

  const closeRun = (runId: string) => {
    runs.delete(runId);
    closedRuns.add(runId);
    while (closedRuns.size > maxRuns) {
      const oldest = closedRuns.values().next().value as string | undefined;
      if (oldest === undefined) break;
      closedRuns.delete(oldest);
    }
  };

  const failClosed = (runId: string, reason: OrderedEventQueueDiagnostic["reason"]): OrderedEventEnqueueResult => {
    runs.delete(runId);
    closeRun(runId);
    diagnostic(runId, reason);
    return { status: "dropped", reason };
  };

  const deliver = (runId: string, event: E): boolean => {
    const terminal = options.isTerminal(event);
    // Terminal cleanup is in finally so a callback failure cannot leave a
    // queue that might later accept stale events for the same run.
    try {
      options.onEvent(event);
    } finally {
      if (terminal) closeRun(runId);
    }
    return terminal;
  };

  const enqueue = (event: E, sequence?: number): OrderedEventEnqueueResult => {
    const runId = options.getRunId(event);
    if (!runId) {
      diagnostic("", "invalid-run");
      return { status: "dropped", reason: "invalid-run" };
    }
    if (closedRuns.has(runId)) return { status: "duplicate" };

    // Accept an event-carried sequence as a convenience for pure adapters;
    // transport callers may still pass it explicitly. Sequence 0/omitted is
    // the legacy event shape and is delivered directly without buffering.
    const eventSequence = sequence ?? (
      typeof event === "object" && event !== null && "sequence" in event
        ? (event as { sequence?: unknown }).sequence
        : undefined
    );
    if (eventSequence === undefined || eventSequence === 0) {
      const terminal = options.isTerminal(event);
      try {
        options.onEvent(event);
      } finally {
        if (terminal) closeRun(runId);
      }
      return { status: "processed", processed: 1 };
    }
    if (typeof eventSequence !== "number" || !Number.isSafeInteger(eventSequence) || eventSequence < 1 || eventSequence > maxSequence) {
      return failClosed(runId, "invalid-sequence");
    }

    let state = runs.get(runId);
    if (!state) {
      if (runs.size >= maxRuns) return failClosed(runId, "run-overflow");
      state = { next: 1, pending: new Map() };
      runs.set(runId, state);
    }
    if (eventSequence < state.next || state.pending.has(eventSequence)) return { status: "duplicate" };
    if (eventSequence > state.next) {
      const gap = eventSequence - state.next;
      if (gap > maxSequenceGap) return failClosed(runId, "sequence-gap");
      if (state.pending.size >= maxPendingEvents) return failClosed(runId, "pending-overflow");
      state.pending.set(eventSequence, event);
      state.gapStartedAt ??= now();
      return { status: "queued", pending: state.pending.size };
    }

    let processed = 0;
    if (deliver(runId, event)) return { status: "processed", processed: 1 };
    processed += 1;
    state = runs.get(runId);
    if (!state) return { status: "processed", processed };
    state.next += 1;
    while (state.pending.has(state.next)) {
      const next = state.pending.get(state.next)!;
      state.pending.delete(state.next);
      if (deliver(runId, next)) return { status: "processed", processed: processed + 1 };
      processed += 1;
      state = runs.get(runId);
      if (!state) break;
      state.next += 1;
    }
    if (state && state.pending.size === 0) state.gapStartedAt = undefined;
    return { status: "processed", processed };
  };

  const expire = (at = now()) => {
    let expired = 0;
    for (const [runId, state] of runs) {
      if (state.gapStartedAt !== undefined && at - state.gapStartedAt >= maxGapAgeMs) {
        failClosed(runId, "gap-expired");
        expired += 1;
      }
    }
    return expired;
  };

  return {
    enqueue,
    expire,
    clear: (runId?: string) => {
      if (runId) {
        runs.delete(runId);
        closedRuns.delete(runId);
      } else {
        runs.clear();
        closedRuns.clear();
      }
    },
    activeRunCount: () => runs.size,
    pendingCount: (runId) => runs.get(runId)?.pending.size ?? 0,
  };
};
