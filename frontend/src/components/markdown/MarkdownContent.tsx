import React from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";
import { handleMarkdownLinkClick } from "./markdownLinks";

export interface MarkdownContentProps {
  children: string;
}

const components: Components = {
  a: ({ href, children, ...props }) => (
    <a
      {...props}
      href={href}
      onClick={(event) =>
        handleMarkdownLinkClick(event, href, BrowserOpenURL)
      }
    >
      {children}
    </a>
  ),
};

/**
 * Shared Markdown renderer for content shown inside the Wails WebView.
 *
 * GFM behavior remains consistent across the editor preview and canvas
 * artifact preview, while links are delegated to the OS browser through the
 * Wails runtime instead of navigating the embedded WebView.
 */
const MarkdownContent: React.FC<MarkdownContentProps> = ({ children }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
    {children}
  </ReactMarkdown>
);

export default MarkdownContent;
