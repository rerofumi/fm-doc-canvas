import {
  ExportImage,
  ExportMarkdown,
  GenerateImage,
  GenerateImageWithProvider,
  GenerateSummary,
  GenerateText,
  GenerateTextWithImages,
  GetConfig,
  GetImageDataURL,
  GetImageFileURL,
  HealthCheck,
  ImportFile,
  LoadCanvasFromFile,
  SaveCanvasToFile,
  SaveConfig,
} from "../../wailsjs/go/main/App";
import { backend } from "../../wailsjs/go/models";
import type { AppConfig, ImageGenProviderId } from "../types/config";

export interface ImportFileResult {
  kind: string;
  content?: string;
  src?: string;
  name: string;
}

const VALID_PROVIDERS: ReadonlySet<ImageGenProviderId> = new Set([
  "openrouter",
  "openai",
  "google",
  "xai",
]);

function normalizeProvider(provider: string | undefined): ImageGenProviderId {
  if (provider && VALID_PROVIDERS.has(provider as ImageGenProviderId)) {
    return provider as ImageGenProviderId;
  }
  return "openrouter";
}

function toAppConfig(raw: backend.Config): AppConfig {
  return {
    llm: {
      baseURL: raw.llm?.baseURL ?? "",
      model: raw.llm?.model ?? "",
      apiKey: raw.llm?.apiKey ?? "",
      systemPrompt: raw.llm?.systemPrompt ?? "",
    },
    generation: {
      summaryMaxChars: raw.generation?.summaryMaxChars ?? 100,
    },
    imageGen: {
      provider: normalizeProvider(raw.imageGen?.provider),
      downloadPath: raw.imageGen?.downloadPath ?? "Image",
      openrouter: {
        baseURL: raw.imageGen?.openrouter?.baseURL ?? "",
        model: raw.imageGen?.openrouter?.model ?? "",
        apiKey: raw.imageGen?.openrouter?.apiKey ?? "",
      },
      openai: {
        baseURL: raw.imageGen?.openai?.baseURL ?? "",
        model: raw.imageGen?.openai?.model ?? "",
        apiKey: raw.imageGen?.openai?.apiKey ?? "",
      },
      google: {
        model: raw.imageGen?.google?.model ?? "",
        apiKey: raw.imageGen?.google?.apiKey ?? "",
      },
      xai: {
        model: raw.imageGen?.xai?.model ?? "",
        apiKey: raw.imageGen?.xai?.apiKey ?? "",
      },
    },
  };
}

export function hasWailsRuntime(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const win = window as unknown as {
    go?: { main?: { App?: Record<string, unknown> } };
  };
  return Boolean(win.go?.main?.App);
}

export const wailsBridge = {
  healthCheck(): Promise<string> {
    return HealthCheck();
  },

  async getConfig(): Promise<AppConfig> {
    const cfg = await GetConfig();
    return toAppConfig(cfg);
  },

  saveConfig(config: AppConfig): Promise<void> {
    const payload = backend.Config.createFrom(config);
    return SaveConfig(payload);
  },

  generateText(prompt: string, contextData: string): Promise<string> {
    return GenerateText(prompt, contextData);
  },

  generateTextWithImages(
    prompt: string,
    contextData: string,
    imageDataURLs: string[],
  ): Promise<string> {
    return GenerateTextWithImages(prompt, contextData, imageDataURLs);
  },

  generateSummary(text: string): Promise<string> {
    return GenerateSummary(text);
  },

  generateImage(
    prompt: string,
    contextData: string,
    imageDataURLs: string[],
  ): Promise<string> {
    return GenerateImage(prompt, contextData, imageDataURLs);
  },

  generateImageWithProvider(
    prompt: string,
    contextData: string,
    imageDataURLs: string[],
    provider: ImageGenProviderId | string,
  ): Promise<string> {
    return GenerateImageWithProvider(prompt, contextData, imageDataURLs, provider);
  },

  getImageDataURL(relPath: string): Promise<string> {
    return GetImageDataURL(relPath);
  },

  getImageFileURL(relPath: string): Promise<string> {
    return GetImageFileURL(relPath);
  },

  saveCanvasToFile(jsonData: string): Promise<string> {
    return SaveCanvasToFile(jsonData);
  },

  loadCanvasFromFile(): Promise<string> {
    return LoadCanvasFromFile();
  },

  async importFile(filePath: string): Promise<ImportFileResult> {
    const res = await ImportFile(filePath);
    return {
      kind: res.kind,
      content: res.content,
      src: res.src,
      name: res.name,
    };
  },

  exportMarkdown(content: string): Promise<string> {
    return ExportMarkdown(content);
  },

  exportImage(relPath: string): Promise<string> {
    return ExportImage(relPath);
  },
};
