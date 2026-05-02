import { Hono } from "hono";

import { appConfig, getPublicEnvSummary, services, type ServiceName } from "../config.js";
import {
  buildSessionCookie,
  clearSessionCookie,
  isAuthenticated,
  matchesPassword,
} from "../lib/auth.js";
import { formatDuration, formatTimestamp } from "../lib/format.js";
import { renderPage } from "../lib/render.js";
import { metrics, startTime } from "../state/metrics.js";
import { updateWebUiSettings, webUiSettings } from "../state/settings.js";
import { isServiceConfigured, serviceConfig, updateServiceConfig } from "../state/serviceConfig.js";
import { google } from "googleapis";

type RouteOptions = { app: Hono; sessionToken: string };

export function registerWebUiRoutes({ app, sessionToken }: RouteOptions) {
  app.use("*", async (c, next) => {
    metrics.requestCount += 1;
    metrics.lastRequestAt = new Date();
    await next();
  });

  // ── Auth ──────────────────────────────────────────────────────────────────────
  app.get("/login", async (c) => {
    if (isAuthenticated(c.req.header("cookie"), sessionToken)) return c.redirect("/dashboard");
    return c.html(await renderPage("login.ejs", {
      activePath: "/login",
      errorMessage: c.req.query("error") === "1" ? "Invalid password. Please try again." : "",
      pageTitle: "Login",
      serverName: appConfig.serverName,
      webUiTitle: webUiSettings.title,
    }));
  });

  app.post("/login", async (c) => {
    const form = await c.req.formData();
    if (!matchesPassword(String(form.get("password") ?? ""), sessionToken, appConfig.webUiSessionSecret)) {
      metrics.failedLogins += 1;
      return c.redirect("/login?error=1");
    }
    metrics.lastLoginAt = new Date();
    metrics.successfulLogins += 1;
    c.header("Set-Cookie", buildSessionCookie(sessionToken));
    return c.redirect("/dashboard");
  });

  app.post("/logout", (c) => {
    c.header("Set-Cookie", clearSessionCookie());
    return c.redirect("/login");
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  app.get("/dashboard", async (c) => {
    if (!isAuthenticated(c.req.header("cookie"), sessionToken)) return c.redirect("/login");

    const uptimeSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const base = `http://${appConfig.host}:${appConfig.port}`;

    // Build service cards for the dashboard
    const serviceCards = Object.entries(services).map(([id, svc]) => {
      const configured = isServiceConfigured(id as ServiceName);
      return {
        id,
        label: svc.label,
        emoji: svc.emoji,
        authType: svc.authType,
        configured,
        endpoint: `${base}/mcp/${id}`,
        internalPort: svc.port,
      };
    });

    return c.html(await renderPage("index.ejs", {
      activePath: "/dashboard",
      dashboardCards: [
        { icon: "fa-solid fa-bolt",              label: "HTTP Requests",     value: String(metrics.requestCount) },
        { icon: "fa-solid fa-shield-heart",      label: "Successful Logins", value: String(metrics.successfulLogins) },
        { icon: "fa-solid fa-triangle-exclamation", label: "Failed Logins",  value: String(metrics.failedLogins) },
        { icon: "fa-solid fa-clock",             label: "Uptime",            value: formatDuration(uptimeSeconds) },
      ],
      envSummary: getPublicEnvSummary(),
      healthUrl: `${base}/health`,
      lastLoginAt: formatTimestamp(metrics.lastLoginAt),
      lastRequestAt: formatTimestamp(metrics.lastRequestAt),
      mcpUrl: `${base}/mcp`,
      mcpProtected: !!serviceConfig.mcpAccessToken,
      pageTitle: "Dashboard",
      serverName: appConfig.serverName,
      serverVersion: appConfig.serverVersion,
      serviceCards,
      settingsSummary: [
        { key: "WebUI Title",   value: webUiSettings.title },
        { key: "Accent Tone",   value: webUiSettings.accentTone },
        { key: "Auto Refresh",  value: `${webUiSettings.autoRefreshSeconds}s` },
        { key: "Compact Cards", value: webUiSettings.compactCards ? "Enabled" : "Disabled" },
      ],
      startedAt: startTime.toISOString(),
      toolCount: serviceCards.filter((s) => s.configured).length,
      webUiSettings,
      webUiTitle: webUiSettings.title,
    }));
  });

  // ── Settings ──────────────────────────────────────────────────────────────────
  app.get("/settings", async (c) => {
    if (!isAuthenticated(c.req.header("cookie"), sessionToken)) return c.redirect("/login");
    return c.html(await renderPage("settings.ejs", {
      activePath: "/settings",
      pageTitle: "Settings",
      saveMessage: c.req.query("saved") === "1" ? "Settings saved for current session." : "",
      serverName: appConfig.serverName,
      webUiSettings,
      webUiTitle: webUiSettings.title,
    }));
  });

  app.post("/settings", async (c) => {
    if (!isAuthenticated(c.req.header("cookie"), sessionToken)) return c.redirect("/login");
    const form = await c.req.formData();
    updateWebUiSettings({
      accentTone: String(form.get("accentTone") ?? ""),
      autoRefreshSeconds: Number(form.get("autoRefreshSeconds") ?? "15"),
      compactCards: form.get("compactCards") === "on",
      title: String(form.get("title") ?? ""),
    });
    return c.redirect("/settings?saved=1");
  });

  // ── Configure API Keys ────────────────────────────────────────────────────────
  app.get("/configure", async (c) => {
    if (!isAuthenticated(c.req.header("cookie"), sessionToken)) return c.redirect("/login");
    return c.html(await renderPage("configure.ejs", {
      activePath: "/configure",
      pageTitle: "Configure Services",
      saveMessage: c.req.query("saved") === "1" ? "Configuration saved successfully." : "",
      serverName: appConfig.serverName,
      webUiTitle: webUiSettings.title,
      serviceConfig,
      appConfig,
    }));
  });

  app.post("/configure", async (c) => {
    if (!isAuthenticated(c.req.header("cookie"), sessionToken)) return c.redirect("/login");
    const form = await c.req.formData();
    updateServiceConfig({
      youtubeApiKey: String(form.get("youtubeApiKey") ?? ""),
      mapsApiKey: String(form.get("mapsApiKey") ?? ""),
      googleClientId: String(form.get("googleClientId") ?? ""),
      googleClientSecret: String(form.get("googleClientSecret") ?? ""),
      googleCalendarRefreshToken: String(form.get("googleCalendarRefreshToken") ?? ""),
      googleGmailRefreshToken: String(form.get("googleGmailRefreshToken") ?? ""),
      googleContactsRefreshToken: String(form.get("googleContactsRefreshToken") ?? ""),
      mcpAccessToken: String(form.get("mcpAccessToken") ?? ""),
    });
    return c.redirect("/configure?saved=1");
  });

  // ── Automatic OAuth Setup ──────────────────────────────────────────────────────
  app.get("/oauth/start", async (c) => {
    if (!isAuthenticated(c.req.header("cookie"), sessionToken)) return c.redirect("/login");
    if (!serviceConfig.googleClientId || !serviceConfig.googleClientSecret) {
      return c.redirect("/configure");
    }

    const oauth2Client = new google.auth.OAuth2(
      serviceConfig.googleClientId,
      serviceConfig.googleClientSecret,
      `http://127.0.0.1:${appConfig.port}/oauth/callback`
    );

    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/contacts",
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent", // Force to get refresh token
    });

    return c.redirect(url);
  });

  app.get("/oauth/callback", async (c) => {
    if (!isAuthenticated(c.req.header("cookie"), sessionToken)) return c.redirect("/login");
    const code = c.req.query("code");
    if (!code) return c.redirect("/configure");

    try {
      const oauth2Client = new google.auth.OAuth2(
        serviceConfig.googleClientId,
        serviceConfig.googleClientSecret,
        `http://127.0.0.1:${appConfig.port}/oauth/callback`
      );

      const { tokens } = await oauth2Client.getToken(code);
      if (tokens.refresh_token) {
        updateServiceConfig({
          googleCalendarRefreshToken: tokens.refresh_token,
          googleGmailRefreshToken: tokens.refresh_token,
          googleContactsRefreshToken: tokens.refresh_token,
        });
        return c.redirect("/configure?saved=1");
      } else {
        // We didn't get a refresh token, likely because the user didn't see the consent screen.
        // That's why we pass prompt="consent" in /oauth/start.
        return c.redirect("/configure");
      }
    } catch (err) {
      console.error("OAuth callback failed", err);
      return c.redirect("/configure");
    }
  });

  // ── API: metrics JSON ─────────────────────────────────────────────────────────
  app.get("/api/metrics", (c) => {
    if (!isAuthenticated(c.req.header("cookie"), sessionToken))
      return c.json({ error: "Unauthorized" }, 401);

    const base = `http://${appConfig.host}:${appConfig.port}`;
    return c.json({
      host: appConfig.host,
      port: appConfig.port,
      serverName: appConfig.serverName,
      serverVersion: appConfig.serverVersion,
      startTime: startTime.toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startTime.getTime()) / 1000),
      requestCount: metrics.requestCount,
      successfulLogins: metrics.successfulLogins,
      failedLogins: metrics.failedLogins,
      lastLoginAt: formatTimestamp(metrics.lastLoginAt),
      lastRequestAt: formatTimestamp(metrics.lastRequestAt),
      mcpProtected: !!appConfig.mcpAccessToken,
      services: Object.fromEntries(
        Object.entries(services).map(([id, svc]) => [
          id,
          { label: svc.label, configured: isServiceConfigured(id as ServiceName),
            endpoint: `${base}/mcp/${id}`, port: svc.port },
        ])
      ),
      settings: webUiSettings,
    });
  });

  // ── API: service status ───────────────────────────────────────────────────────
  app.get("/api/services", (c) => {
    if (!isAuthenticated(c.req.header("cookie"), sessionToken))
      return c.json({ error: "Unauthorized" }, 401);
    const base = `http://${appConfig.host}:${appConfig.port}`;
    return c.json(
      Object.fromEntries(
        Object.entries(services).map(([id, svc]) => [
          id,
          { label: svc.label, emoji: svc.emoji, authType: svc.authType,
            configured: isServiceConfigured(id as ServiceName),
            endpoint: `${base}/mcp/${id}` },
        ])
      )
    );
  });
}
