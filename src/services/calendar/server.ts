import { FastMCP } from "fastmcp";
import { appConfig } from "../../config.js";
import { registerCalendarTools } from "./tools.js";

export function createCalendarServer() {
  const server = new FastMCP({ name: "google-mcp/calendar", version: appConfig.serverVersion });
  registerCalendarTools(server);
  return server;
}
