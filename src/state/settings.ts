import { appConfig } from "../config.js";

export type WebUiSettings = {
  accentTone: "amber" | "emerald" | "slate";
  autoRefreshSeconds: number;
  compactCards: boolean;
  title: string;
};

export const webUiSettings: WebUiSettings = {
  accentTone: "emerald",
  autoRefreshSeconds: 15,
  compactCards: false,
  title: appConfig.webUiTitle,
};

export function updateWebUiSettings(input: {
  accentTone: string;
  autoRefreshSeconds: number;
  compactCards: boolean;
  title: string;
}) {
  webUiSettings.title = input.title || appConfig.webUiTitle;
  webUiSettings.accentTone = isAccentTone(input.accentTone)
    ? input.accentTone
    : webUiSettings.accentTone;
  webUiSettings.autoRefreshSeconds = clampRefresh(input.autoRefreshSeconds);
  webUiSettings.compactCards = input.compactCards;
}

function isAccentTone(value: string): value is WebUiSettings["accentTone"] {
  return value === "amber" || value === "emerald" || value === "slate";
}

function clampRefresh(value: number): number {
  if (Number.isNaN(value)) {
    return webUiSettings.autoRefreshSeconds;
  }

  return Math.min(120, Math.max(5, value));
}
