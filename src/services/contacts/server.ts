import { FastMCP } from "fastmcp";
import { appConfig } from "../../config.js";
import { registerContactsTools } from "./tools.js";

export function createContactsServer() {
  const server = new FastMCP({ name: "google-mcp/contacts", version: appConfig.serverVersion });
  registerContactsTools(server);
  return server;
}
