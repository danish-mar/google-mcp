import { FastMCP } from "fastmcp";
import { appConfig } from "../../config.js";
import { registerYoutubeTools } from "./tools.js";

export function createYoutubeServer() {
  const server = new FastMCP({ name: "google-mcp/youtube", version: appConfig.serverVersion });
  registerYoutubeTools(server);
  return server;
}
