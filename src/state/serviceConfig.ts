import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { appConfig, type ServiceName } from "../config.js";

const DATA_DIR = resolve(process.cwd(), "data");
const CONFIG_FILE = resolve(DATA_DIR, "runtime-config.json");

export type ServiceCredentials = {
  youtubeApiKey: string;
  mapsApiKey: string;
  googleClientId: string;
  googleClientSecret: string;
  googleCalendarRefreshToken: string;
  googleGmailRefreshToken: string;
  googleContactsRefreshToken: string;
  mcpAccessToken: string;
};

// Load saved credentials from data/runtime-config.json, fall back to .env values
function loadFromDisk(): Partial<ServiceCredentials> {
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveToDisk(creds: ServiceCredentials) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(creds, null, 2), "utf-8");
  } catch (err) {
    console.error("[serviceConfig] Failed to persist config:", err);
  }
}

// Merge: runtime-config.json overrides .env
const saved = loadFromDisk();

export const serviceConfig: ServiceCredentials = {
  youtubeApiKey:                saved.youtubeApiKey                ?? appConfig.youtubeApiKey,
  mapsApiKey:                   saved.mapsApiKey                   ?? appConfig.mapsApiKey,
  googleClientId:               saved.googleClientId               ?? appConfig.googleClientId,
  googleClientSecret:           saved.googleClientSecret           ?? appConfig.googleClientSecret,
  googleCalendarRefreshToken:   saved.googleCalendarRefreshToken   ?? appConfig.googleCalendarRefreshToken,
  googleGmailRefreshToken:      saved.googleGmailRefreshToken      ?? appConfig.googleGmailRefreshToken,
  googleContactsRefreshToken:   saved.googleContactsRefreshToken   ?? appConfig.googleContactsRefreshToken,
  mcpAccessToken:               saved.mcpAccessToken               ?? appConfig.mcpAccessToken,
};

export function updateServiceConfig(patch: Partial<ServiceCredentials>) {
  for (const [k, v] of Object.entries(patch) as [keyof ServiceCredentials, string][]) {
    if (v !== undefined) serviceConfig[k] = v;
  }
  saveToDisk(serviceConfig);
}

export function isServiceConfigured(name: ServiceName): boolean {
  switch (name) {
    case "youtube":  return !!serviceConfig.youtubeApiKey;
    case "maps":     return !!serviceConfig.mapsApiKey;
    case "calendar": return !!(serviceConfig.googleClientId && serviceConfig.googleCalendarRefreshToken);
    case "gmail":    return !!(serviceConfig.googleClientId && serviceConfig.googleGmailRefreshToken);
    case "contacts": return !!(serviceConfig.googleClientId && serviceConfig.googleContactsRefreshToken);
  }
}

