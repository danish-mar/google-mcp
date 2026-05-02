import { FastMCP } from "fastmcp";
import { appConfig } from "../../config.js";
import { registerGmailTools } from "./tools.js";

export function createGmailServer() {
  const server = new FastMCP({ name: "google-mcp/gmail", version: appConfig.serverVersion });
  registerGmailTools(server);
  return server;
}
