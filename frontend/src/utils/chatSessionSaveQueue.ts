/**
 * Serialize chat-session writes by the backend's real key: Canvas ID.
 *
 * Runtime generations are UI freshness tokens, not persistence keys.  A
 * per-Canvas monotonic version means a queued snapshot from an older
 * generation is skipped once a newer snapshot for that Canvas exists, while
 * the last snapshot of a Canvas remains queued when the user navigates away.
 */
export interface CanvasSaveQueue<T> {
  enqueue(canvasId: string, generation: string, payload: T): Promise<void>;
}

/** Pure monotonic freshness rule, kept exportable for logic tests. */
export function isLatestCanvasSave(candidateVersion: number, latestVersion: number): boolean {
  return candidateVersion === latestVersion;
}

interface QueueState<T> {
  nextVersion: number;
  latest: { version: number; generation: string; payload: T } | null;
  tail: Promise<void>;
}

export function createCanvasSaveQueue<T>(
  save: (canvasId: string, payload: T) => Promise<void>,
): CanvasSaveQueue<T> {
  const states = new Map<string, QueueState<T>>();

  return {
    enqueue(canvasId, generation, payload) {
      const state = states.get(canvasId) ?? {
        nextVersion: 0,
        latest: null,
        tail: Promise.resolve(),
      };
      const version = state.nextVersion + 1;
      state.nextVersion = version;
      state.latest = { version, generation, payload };

      const task = state.tail.catch(() => undefined).then(async () => {
        // Coalescing is checked after the previous write settles.  This is
        // the critical guard against an old-generation waiter overwriting a
        // newer generation's completed snapshot.
        if (!state.latest || !isLatestCanvasSave(version, state.latest.version)) return;
        await save(canvasId, payload);
      });
      state.tail = task;
      states.set(canvasId, state);
      return task;
    },
  };
}
