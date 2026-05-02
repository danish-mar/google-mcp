// Tools are now registered per-service in src/services/<name>/tools.ts
// This file is kept for compatibility with the webui template.
import { FastMCP } from "fastmcp";

export const registeredToolInfo: readonly { name: string; description: string }[] = [];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerTools(_server: FastMCP) {
  // No-op — services register their own tools independently
}
