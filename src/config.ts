import dotenv from "dotenv";

dotenv.config();

export const appConfig = {
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? "8080"),

  // Internal service ports (not exposed directly)
  youtubeMcpPort:  Number(process.env.YOUTUBE_MCP_PORT  ?? "8081"),
  mapsMcpPort:     Number(process.env.MAPS_MCP_PORT     ?? "8082"),
  calendarMcpPort: Number(process.env.CALENDAR_MCP_PORT ?? "8083"),
  gmailMcpPort:    Number(process.env.GMAIL_MCP_PORT    ?? "8084"),
  contactsMcpPort: Number(process.env.CONTACTS_MCP_PORT ?? "8085"),

  serverName: "google-mcp",
  serverVersion: "1.0.0" as const,

  // Google API credentials (initial values from .env; serviceConfig overrides at runtime)
  youtubeApiKey:                process.env.YOUTUBE_API_KEY                ?? "",
  mapsApiKey:                   process.env.MAPS_API_KEY                   ?? "",
  googleClientId:               process.env.GOOGLE_CLIENT_ID               ?? "",
  googleClientSecret:           process.env.GOOGLE_CLIENT_SECRET           ?? "",
  googleCalendarRefreshToken:   process.env.GOOGLE_CALENDAR_REFRESH_TOKEN  ?? "",
  googleGmailRefreshToken:      process.env.GOOGLE_GMAIL_REFRESH_TOKEN     ?? "",
  googleContactsRefreshToken:   process.env.GOOGLE_CONTACTS_REFRESH_TOKEN  ?? "",

  // MCP access token (optional — protect /mcp/* endpoints)
  mcpAccessToken: process.env.MCP_ACCESS_TOKEN ?? "",

  // WebUI auth
  webUiPassword:      process.env.WEBUI_PASSWORD       ?? "change-me",
  webUiSessionSecret: process.env.WEBUI_SESSION_SECRET ?? "replace-this-session-secret",
  webUiTitle:         process.env.WEBUI_TITLE          ?? "Google MCP Control Center",
};

export type ServiceName = "youtube" | "maps" | "calendar" | "gmail" | "contacts";

export const services: Record<ServiceName, { port: number; label: string; emoji: string; authType: string }> = {
  youtube:  { port: appConfig.youtubeMcpPort,   label: "YouTube",         emoji: "📺", authType: "API Key" },
  maps:     { port: appConfig.mapsMcpPort,       label: "Google Maps",     emoji: "🗺️",  authType: "API Key" },
  calendar: { port: appConfig.calendarMcpPort,   label: "Google Calendar", emoji: "📅", authType: "OAuth2"  },
  gmail:    { port: appConfig.gmailMcpPort,       label: "Gmail",           emoji: "📧", authType: "OAuth2"  },
  contacts: { port: appConfig.contactsMcpPort,   label: "Google Contacts", emoji: "👤", authType: "OAuth2"  },
};

// NOTE: isServiceConfigured reads from serviceConfig (runtime), not appConfig (.env only)
// Import serviceConfig lazily to avoid circular deps — callers do the import themselves.
export function isServiceConfiguredFromEnv(name: ServiceName): boolean {
  switch (name) {
    case "youtube":  return !!appConfig.youtubeApiKey;
    case "maps":     return !!appConfig.mapsApiKey;
    case "calendar": return !!(appConfig.googleClientId && appConfig.googleCalendarRefreshToken);
    case "gmail":    return !!(appConfig.googleClientId && appConfig.googleGmailRefreshToken);
    case "contacts": return !!(appConfig.googleClientId && appConfig.googleContactsRefreshToken);
  }
}

export function getPublicEnvSummary() {
  return [
    { key: "HOST",  value: appConfig.host },
    { key: "PORT",  value: String(appConfig.port) },
    { key: "YouTube API Key",    value: appConfig.youtubeApiKey  ? "✓ Set" : "✗ Not set" },
    { key: "Maps API Key",       value: appConfig.mapsApiKey     ? "✓ Set" : "✗ Not set" },
    { key: "Google Client ID",   value: appConfig.googleClientId ? "✓ Set" : "✗ Not set" },
    { key: "Calendar OAuth",     value: appConfig.googleCalendarRefreshToken ? "✓ Set" : "✗ Not set" },
    { key: "Gmail OAuth",        value: appConfig.googleGmailRefreshToken    ? "✓ Set" : "✗ Not set" },
    { key: "Contacts OAuth",     value: appConfig.googleContactsRefreshToken ? "✓ Set" : "✗ Not set" },
    { key: "MCP Access Token",   value: appConfig.mcpAccessToken ? "✓ Set (protected)" : "Not set (open)" },
  ];
}
