import { Hono } from "hono";
import { appConfig, ServiceName, services } from "./config.js";
import { isAuthenticated } from "./lib/auth.js";

// ── MCP auth middleware ────────────────────────────────────────────────────────
// If MCP_ACCESS_TOKEN is set, clients must send: Authorization: Bearer <token>
function mcpAuthMiddleware(token: string) {
  return async (c: any, next: () => Promise<void>) => {
    if (!token) return next(); // open — no auth required
    const auth = c.req.header("authorization") ?? "";
    if (auth === `Bearer ${token}`) return next();
    return c.json({ error: "Unauthorized: invalid or missing MCP access token" }, 401);
  };
}

import * as http from "node:http";

// ── Streaming proxy ────────────────────────────────────────────────────────────
// Forwards all methods (POST/GET/DELETE) to the internal service port.
// Uses node:http directly to avoid Node's built-in fetch (undici) 5-minute timeout on long-lived streams.
async function proxyRequest(c: any, targetPort: number, targetPath: string): Promise<Response> {
  const original = new URL(c.req.url);
  
  return new Promise((resolve, reject) => {
    const headers = { ...c.req.header() };
    delete headers.host;

    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: targetPort,
      path: targetPath + original.search,
      method: c.req.method,
      headers,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      const stream = new ReadableStream({
        start(controller) {
          proxyRes.on("data", (chunk) => controller.enqueue(chunk));
          proxyRes.on("end", () => controller.close());
          proxyRes.on("error", (err) => controller.error(err));
        },
        cancel() {
          proxyRes.destroy();
        },
      });

      const responseHeaders = { ...proxyRes.headers };
      // Prevent double chunking, as new Response(ReadableStream) handles this automatically
      delete responseHeaders["transfer-encoding"];
      
      resolve(
        new Response(stream, {
          status: proxyRes.statusCode,
          headers: responseHeaders as Record<string, string>,
        })
      );
    });

    proxyReq.on("error", (err: any) => {
      if (err.code === "ECONNREFUSED") {
        resolve(c.json({ error: `Service on port ${targetPort} is not running` }, 503));
      } else {
        reject(err);
      }
    });

    // Pipe the original request body to the proxy request if applicable
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      // Access the raw Node.js request object from Hono's environment
      const incoming = c.env?.incoming;
      if (incoming) {
        incoming.pipe(proxyReq);
      } else {
        proxyReq.end();
      }
    } else {
      proxyReq.end();
    }
  });
}

// ── Gateway factory ────────────────────────────────────────────────────────────
export function createGateway(sessionToken: string): Hono {
  const app = new Hono();
  const mcpToken = appConfig.mcpAccessToken;

  // Redirect root → dashboard
  app.get("/", (c) => {
    const isAuth = isAuthenticated(c.req.header("cookie"), sessionToken);
    return c.redirect(isAuth ? "/dashboard" : "/login");
  });

  // Health check (public)
  app.get("/health", (c) => c.json({ status: "ok", server: appConfig.serverName, version: appConfig.serverVersion }));

  // ── Service-info endpoint (public) ─────────────────────────────────────────
  app.get("/mcp", (c) =>
    c.json({
      server: appConfig.serverName,
      version: appConfig.serverVersion,
      services: Object.entries(services).map(([id, s]) => ({
        id,
        label: s.label,
        endpoint: `http://${appConfig.host}:${appConfig.port}/mcp/${id}`,
        authRequired: !!mcpToken,
      })),
    })
  );

  // ── Per-service proxy routes ────────────────────────────────────────────────
  for (const [id, svc] of Object.entries(services) as [ServiceName, typeof services[ServiceName]][]) {
    const { port } = svc;

    // MCP HTTP streaming endpoint  →  POST/GET /mcp/<service>
    app.use(`/mcp/${id}`, mcpAuthMiddleware(mcpToken));
    app.all(`/mcp/${id}`, (c) => proxyRequest(c, port, "/mcp"));

    // SSE endpoint (legacy clients)  →  GET /mcp/<service>/sse
    app.use(`/mcp/${id}/sse`, mcpAuthMiddleware(mcpToken));
    app.get(`/mcp/${id}/sse`, (c) => proxyRequest(c, port, "/sse"));

    // Service health  →  GET /mcp/<service>/health
    app.get(`/mcp/${id}/health`, (c) => proxyRequest(c, port, "/health"));
  }

  return app;
}
