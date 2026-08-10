import { ArtifactNodeData } from "../types";

/**
 * Artifact の表示・永続化で共通利用する本文統計。
 * charCount は JavaScript の文字列長、wordCount は空白区切りの語数とする。
 * 日本語本文は空白がない限り 1 語として扱う。
 */
export const getContentStats = (content: string) => ({
  charCount: content.length,
  wordCount: content.trim() ? content.trim().split(/\s+/u).length : 0,
});

export const createArtifactData = (
  content = "# 新しいチャプター",
  filename = "chapter.md",
): ArtifactNodeData => {
  const stats = getContentStats(content);
  return {
    filename,
    language: "markdown",
    content,
    summary: "新しいチャプター",
    revision: 0,
    ...stats,
    lastEditedAt: Date.now(),
  };
};

export const normalizeArtifactData = (
  data: Partial<ArtifactNodeData> & { content?: string },
): ArtifactNodeData => {
  const content = data.content ?? "";
  const stats = getContentStats(content);
  return {
    filename: data.filename || "chapter.md",
    language: data.language === "text" ? "text" : "markdown",
    content,
    summary: data.summary || content.split("\n")[0] || "Untitled Artifact",
    revision: typeof data.revision === "number" ? data.revision : 0,
    charCount: stats.charCount,
    wordCount: stats.wordCount,
    lastEditSummary: data.lastEditSummary,
    lastEditedAt: data.lastEditedAt,
  };
};
