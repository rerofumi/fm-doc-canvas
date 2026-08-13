import React, { createContext, useContext } from "react";

export type RuntimeMode = "production" | "e2e";

export interface AppBackendPort {
  GetConfig(): Promise<unknown>;
  SaveConfig(config: unknown): Promise<void>;
  SaveCanvasToFile(jsonData: string): Promise<string>;
  LoadCanvasFromFile(): Promise<string>;
  GenerateText(prompt: string, contextData: string): Promise<string>;
  GenerateSummary(text: string): Promise<string>;
  GenerateImage(
    prompt: string,
    contextData: string,
    refImages: string[],
  ): Promise<string>;
  GenerateImageWithProvider(
    prompt: string,
    contextData: string,
    refImages: string[],
    provider: string,
  ): Promise<string>;
  GetImageDataURL(src: string): Promise<string>;
  ImportFile(filePath: string): Promise<{ type: string; content: string; filename?: string }>;
  ExportMarkdown(content: string): Promise<string>;
  ExportMarkdownWithFilename(content: string, defaultFilename: string): Promise<string>;
  ExportImage(src: string): Promise<string>;
  GetImageFileURL(src: string): Promise<string>;
  SendChat?(req: unknown): Promise<void>;
  CancelChat?(runId: string): Promise<void>;
  ResolveToolApplication?(result: unknown): Promise<void>;
  SearchWeb?(req: unknown): Promise<unknown>;
  OpenExternalURL?(url: string): Promise<void>;
  GetRuntimeEnvironment?(): Promise<{
    mode: RuntimeMode;
    seed?: string;
    epochMs?: number;
    faultPlan?: { failOnceAt?: string };
  }>;
  Greet?(name: string): Promise<string> | string;
}

export interface RuntimeEnvironment {
  mode: RuntimeMode;
  ids: { next(kind: string): string };
  clock: { now(): number; nowISO(): string };
  backend: AppBackendPort;
  faultPlan?: { failOnceAt?: string };
  faultState: { consumed: Record<string, boolean> };
}

const RuntimeContext = createContext<RuntimeEnvironment | null>(null);

export function createProductionIds(): RuntimeEnvironment["ids"] {
  return {
    next(kind: string) {
      if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return `${kind}-${crypto.randomUUID()}`;
      }
      return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    },
  };
}

export function createProductionClock(): RuntimeEnvironment["clock"] {
  return {
    now: () => Date.now(),
    nowISO: () => new Date().toISOString(),
  };
}

export function createSeededIds(seed = "e2e"): RuntimeEnvironment["ids"] {
  const counts: Record<string, number> = {};
  return {
    next(kind: string) {
      counts[kind] = (counts[kind] ?? 0) + 1;
      return `${seed}-${kind}-${counts[kind]}`;
    },
  };
}

export function createFixedClock(epochMs: number): RuntimeEnvironment["clock"] {
  return {
    now: () => epochMs,
    nowISO: () => new Date(epochMs).toISOString(),
  };
}

export async function bootstrapRuntime(
  backend: AppBackendPort,
): Promise<RuntimeEnvironment> {
  let mode: RuntimeMode = "production";
  let seed: string | undefined;
  let epochMs: number | undefined;
  let faultPlan: RuntimeEnvironment["faultPlan"];

  try {
    if (backend.GetRuntimeEnvironment) {
      const env = await backend.GetRuntimeEnvironment();
      if (env?.mode === "e2e") {
        mode = "e2e";
        seed = env.seed;
        epochMs = env.epochMs;
        faultPlan = env.faultPlan;
      }
    }
  } catch {
    // production bindings may not expose the method yet
  }

  if (mode === "e2e") {
    return {
      mode,
      ids: createSeededIds(seed || "e2e"),
      clock: createFixedClock(epochMs ?? Date.parse("2026-08-11T00:00:00.000Z")),
      backend,
      faultPlan,
      faultState: { consumed: {} },
    };
  }

  return {
    mode: "production",
    ids: createProductionIds(),
    clock: createProductionClock(),
    backend,
    faultState: { consumed: {} },
  };
}

export const RuntimeProvider: React.FC<{
  value: RuntimeEnvironment;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
);

export function useRuntime(): RuntimeEnvironment {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error("RuntimeProvider missing");
  return ctx;
}

export function domainServicesFromRuntime(env: RuntimeEnvironment) {
  return {
    ids: env.ids,
    clock: env.clock,
    faultPlan: env.faultPlan,
    faultState: env.faultState,
  };
}
