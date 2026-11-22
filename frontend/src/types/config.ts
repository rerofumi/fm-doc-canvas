export type ImageGenProviderId = "openrouter" | "openai" | "google" | "xai";

export interface LLMConfig {
  baseURL: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
}

export interface GenerationConfig {
  summaryMaxChars: number;
}

export interface OpenRouterImageConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

export interface OpenAIImageConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

export interface GoogleImageConfig {
  model: string;
  apiKey: string;
}

export interface XAIImageConfig {
  model: string;
  apiKey: string;
}

export interface ImageGenConfig {
  provider: ImageGenProviderId;
  downloadPath: string;
  openrouter: OpenRouterImageConfig;
  openai: OpenAIImageConfig;
  google: GoogleImageConfig;
  xai: XAIImageConfig;
}

export interface AppConfig {
  llm: LLMConfig;
  generation: GenerationConfig;
  imageGen: ImageGenConfig;
}
