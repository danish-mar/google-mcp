import { appConfig, services, type ServiceName, isServiceConfiguredFromEnv } from "./config.js";
import { isServiceConfigured } from "./state/serviceConfig.js";
import { createMasterServer } from "./server.js";
import { createYoutubeServer } from "./services/youtube/server.js";
import { createMapsServer } from "./services/maps/server.js";
import { createCalendarServer } from "./services/calendar/server.js";
import { createGmailServer } from "./services/gmail/server.js";
import { createContactsServer } from "./services/contacts/server.js";

const serviceCreators: Record<ServiceName, () => InstanceType<typeof import("fastmcp").FastMCP>> = {
  youtube: createYoutubeServer,
  maps:    createMapsServer,
  calendar: createCalendarServer,
  gmail:   createGmailServer,
  contacts: createContactsServer,
};

console.log("🚀 Starting Google MCP Gateway...\n");

// ── Start each service on its internal port ────────────────────────────────────
for (const [id, svc] of Object.entries(services) as [ServiceName, typeof services[ServiceName]][]) {
  if (isServiceConfigured(id)) {
    try {
      const server = serviceCreators[id]();
      await server.start({
        transportType: "httpStream",
        httpStream: { host: "127.0.0.1", port: svc.port, endpoint: "/mcp" },
      });
      console.log(`  ${svc.emoji}  ${svc.label.padEnd(18)} → http://127.0.0.1:${svc.port}/mcp  [internal]`);
    } catch (err) {
      console.error(`  ✗  ${svc.label} failed to start: ${err}`);
    }
  } else {
    console.log(`  ○  ${svc.label.padEnd(18)} → not configured (${svc.authType} missing)`);
  }
}

// ── Start master gateway (public-facing) ──────────────────────────────────────
if (appConfig.webUiPassword === "change-me") {
  console.warn("\n⚠️  WEBUI_PASSWORD is using the default value — set it in .env before exposing this server.\n");
}

const master = createMasterServer();

// The master FastMCP's own /mcp endpoint is exposed at /mcp/all
// (proxy routes /mcp/youtube|maps|calendar|gmail are handled by the gateway)
await master.start({
  transportType: "httpStream",
  httpStream: { host: appConfig.host, port: appConfig.port, endpoint: "/mcp/all" },
});

const base = `http://${appConfig.host}:${appConfig.port}`;
console.log(`\n──────────────────────────────────────────────────`);
console.log(`  Gateway:    ${base}`);
console.log(`  Dashboard:  ${base}/dashboard`);
console.log(`  Health:     ${base}/health`);
console.log(`\n  MCP Endpoints (connect your AI client to these):`);
for (const [id, svc] of Object.entries(services) as [ServiceName, typeof services[ServiceName]][]) {
  const status = isServiceConfigured(id) ? "✓" : "✗";
  console.log(`  ${status}  ${svc.emoji}  ${svc.label.padEnd(18)} → ${base}/mcp/${id}`);
}
if (appConfig.mcpAccessToken) {
  console.log(`\n  🔒 MCP endpoints require:  Authorization: Bearer <MCP_ACCESS_TOKEN>`);
} else {
  console.log(`\n  🔓 MCP endpoints are open (set MCP_ACCESS_TOKEN to protect them)`);
}
console.log(`──────────────────────────────────────────────────\n`);
