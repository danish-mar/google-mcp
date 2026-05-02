import { FastMCP } from "fastmcp";
import { z } from "zod";
import { google } from "googleapis";
import { appConfig } from "../../config.js";

function getAuth() {
  if (!appConfig.googleClientId || !appConfig.googleClientSecret)
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  if (!appConfig.googleGmailRefreshToken)
    throw new Error("GOOGLE_GMAIL_REFRESH_TOKEN must be set. See README for OAuth2 setup.");
  const auth = new google.auth.OAuth2(appConfig.googleClientId, appConfig.googleClientSecret);
  auth.setCredentials({ refresh_token: appConfig.googleGmailRefreshToken });
  return auth;
}

function encodeEmail(to: string, subject: string, body: string, from?: string): string {
  const msg = [
    `From: ${from ?? "me"}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
  ].join("\r\n");
  return Buffer.from(msg).toString("base64url");
}

export function registerGmailTools(server: FastMCP) {
  server.addTool({
    name: "list_emails",
    description: "List emails from Gmail inbox with optional filters.",
    parameters: z.object({
      query: z.string().optional().describe("Gmail search query, e.g. 'from:boss@company.com is:unread'"),
      maxResults: z.number().optional().default(10).describe("Max emails to return"),
      labelIds: z.array(z.string()).optional().default(["INBOX"]).describe("Labels to filter by"),
    }),
    execute: async ({ query, maxResults, labelIds }) => {
      const gmail = google.gmail({ version: "v1", auth: getAuth() });
      const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults, labelIds });
      const messages = await Promise.all(
        (list.data.messages ?? []).slice(0, maxResults).map(async (m) => {
          const msg = await gmail.users.messages.get({ userId: "me", id: m.id!, format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Date"] });
          const headers = Object.fromEntries(
            (msg.data.payload?.headers ?? []).map((h) => [h.name, h.value])
          );
          return {
            id: m.id,
            from: headers["From"],
            subject: headers["Subject"],
            date: headers["Date"],
            snippet: msg.data.snippet,
            labelIds: msg.data.labelIds,
          };
        })
      );
      return JSON.stringify(messages, null, 2);
    },
  });

  server.addTool({
    name: "get_email",
    description: "Get the full content of an email by message ID.",
    parameters: z.object({ messageId: z.string().describe("Gmail message ID") }),
    execute: async ({ messageId }) => {
      const gmail = google.gmail({ version: "v1", auth: getAuth() });
      const msg = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
      const headers = Object.fromEntries((msg.data.payload?.headers ?? []).map((h) => [h.name, h.value]));
      const body = msg.data.payload?.body?.data
        ? Buffer.from(msg.data.payload.body.data, "base64url").toString("utf-8")
        : "(multipart or no body)";
      return JSON.stringify({ from: headers["From"], to: headers["To"], subject: headers["Subject"],
        date: headers["Date"], body: body.slice(0, 2000) }, null, 2);
    },
  });

  server.addTool({
    name: "send_email",
    description: "Send an email via Gmail.",
    parameters: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject"),
      body: z.string().describe("Email body (plain text)"),
    }),
    execute: async ({ to, subject, body }) => {
      const gmail = google.gmail({ version: "v1", auth: getAuth() });
      const res = await gmail.users.messages.send({ userId: "me",
        requestBody: { raw: encodeEmail(to, subject, body) } });
      return JSON.stringify({ messageId: res.data.id, threadId: res.data.threadId, status: "sent" }, null, 2);
    },
  });

  server.addTool({
    name: "search_emails",
    description: "Search emails using Gmail's search syntax.",
    parameters: z.object({
      query: z.string().describe("Gmail search query, e.g. 'subject:invoice after:2024/01/01'"),
      maxResults: z.number().optional().default(10),
    }),
    execute: async ({ query, maxResults }) => {
      const gmail = google.gmail({ version: "v1", auth: getAuth() });
      const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
      if (!list.data.messages?.length) return "No emails found matching your query.";
      const messages = await Promise.all(
        list.data.messages.slice(0, maxResults).map(async (m) => {
          const msg = await gmail.users.messages.get({ userId: "me", id: m.id!, format: "metadata",
            metadataHeaders: ["From", "Subject", "Date"] });
          const h = Object.fromEntries((msg.data.payload?.headers ?? []).map((h) => [h.name, h.value]));
          return { id: m.id, from: h["From"], subject: h["Subject"], date: h["Date"], snippet: msg.data.snippet };
        })
      );
      return JSON.stringify(messages, null, 2);
    },
  });
}
