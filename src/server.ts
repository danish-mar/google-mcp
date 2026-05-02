import { FastMCP } from "fastmcp";
import { appConfig } from "./config.js";
import { createSessionToken } from "./lib/auth.js";
import { createGateway } from "./gateway.js";
import { registerWebUiRoutes } from "./webui/routes.js";

export function createMasterServer() {
  // Master FastMCP — endpoint /mcp/all gives access to *all* services combined.
  // Sub-service endpoints (/mcp/youtube etc.) are handled by the gateway proxy.
  const server = new FastMCP({
    name: appConfig.serverName,
    version: appConfig.serverVersion,
    health: { enabled: true, message: "ok", path: "/health" },
  });

  const app = server.getApp();
  const sessionToken = createSessionToken(appConfig.webUiPassword, appConfig.webUiSessionSecret);

  // Mount gateway routes BEFORE FastMCP registers /mcp (Hono matches in order)
  const gateway = createGateway(sessionToken);
  app.route("/", gateway);

  // WebUI dashboard
  registerWebUiRoutes({ app, sessionToken });

  return server;
}
