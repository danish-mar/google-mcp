import { FastMCP } from "fastmcp";
import { appConfig } from "../../config.js";
import { registerMapsTools } from "./tools.js";

export function createMapsServer() {
  const server = new FastMCP({ name: "google-mcp/maps", version: appConfig.serverVersion });
  registerMapsTools(server);
  return server;
}
