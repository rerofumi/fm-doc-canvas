import { TextNodeData } from "../types";
import { getContentStats } from "./artifact";

export const normalizeTextData = (
  data: Partial<TextNodeData> & { content?: string },
): TextNodeData => {
  const content = data.content ?? "";
  return {
    ...data,
    content,
    summary: data.summary || content.split(/\r?\n/, 1)[0] || "Untitled Text",
    revision: typeof data.revision === "number" ? data.revision : 0,
    ...getContentStats(content),
  };
};
