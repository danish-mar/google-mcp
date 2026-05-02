import { FastMCP } from "fastmcp";
import { z } from "zod";
import { google } from "googleapis";
import { appConfig } from "../../config.js";

function getAuth() {
  if (!appConfig.googleClientId || !appConfig.googleClientSecret)
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  if (!appConfig.googleCalendarRefreshToken)
    throw new Error("GOOGLE_CALENDAR_REFRESH_TOKEN must be set. See README for OAuth2 setup.");
  const auth = new google.auth.OAuth2(appConfig.googleClientId, appConfig.googleClientSecret);
  auth.setCredentials({ refresh_token: appConfig.googleCalendarRefreshToken });
  return auth;
}

export function registerCalendarTools(server: FastMCP) {
  server.addTool({
    name: "list_events",
    description: "List upcoming Google Calendar events.",
    parameters: z.object({
      calendarId: z.string().optional().default("primary").describe("Calendar ID (default: primary)"),
      maxResults: z.number().optional().default(10).describe("Max events to return"),
      timeMin: z.string().optional().describe("Start time ISO string (default: now)"),
      timeMax: z.string().optional().describe("End time ISO string"),
      query: z.string().optional().describe("Full-text search query"),
    }),
    execute: async ({ calendarId, maxResults, timeMin, timeMax, query }) => {
      const cal = google.calendar({ version: "v3", auth: getAuth() });
      const res = await cal.events.list({
        calendarId,
        maxResults,
        timeMin: timeMin ?? new Date().toISOString(),
        timeMax,
        q: query,
        singleEvents: true,
        orderBy: "startTime",
      });
      return JSON.stringify(res.data.items?.map((e) => ({
        id: e.id,
        title: e.summary,
        start: e.start?.dateTime ?? e.start?.date,
        end: e.end?.dateTime ?? e.end?.date,
        location: e.location,
        description: e.description?.slice(0, 200),
        attendees: e.attendees?.map((a) => a.email),
        htmlLink: e.htmlLink,
      })), null, 2);
    },
  });

  server.addTool({
    name: "create_event",
    description: "Create a new Google Calendar event.",
    parameters: z.object({
      title: z.string().describe("Event title"),
      startDateTime: z.string().describe("Start datetime in ISO format, e.g. '2024-12-25T10:00:00'"),
      endDateTime: z.string().describe("End datetime in ISO format"),
      timeZone: z.string().optional().default("UTC").describe("Timezone, e.g. 'America/New_York'"),
      description: z.string().optional().describe("Event description"),
      location: z.string().optional().describe("Event location"),
      attendees: z.array(z.string()).optional().describe("List of attendee email addresses"),
      calendarId: z.string().optional().default("primary"),
    }),
    execute: async ({ title, startDateTime, endDateTime, timeZone, description, location, attendees, calendarId }) => {
      const cal = google.calendar({ version: "v3", auth: getAuth() });
      const res = await cal.events.insert({
        calendarId,
        requestBody: {
          summary: title,
          start: { dateTime: startDateTime, timeZone },
          end: { dateTime: endDateTime, timeZone },
          description,
          location,
          attendees: attendees?.map((email) => ({ email })),
        },
      });
      return JSON.stringify({ id: res.data.id, htmlLink: res.data.htmlLink, status: res.data.status }, null, 2);
    },
  });

  server.addTool({
    name: "delete_event",
    description: "Delete a Google Calendar event by ID.",
    parameters: z.object({
      eventId: z.string().describe("Event ID"),
      calendarId: z.string().optional().default("primary"),
    }),
    execute: async ({ eventId, calendarId }) => {
      const cal = google.calendar({ version: "v3", auth: getAuth() });
      await cal.events.delete({ calendarId, eventId });
      return `Event ${eventId} deleted successfully.`;
    },
  });

  server.addTool({
    name: "list_calendars",
    description: "List all calendars in the user's Google account.",
    parameters: z.object({}),
    execute: async () => {
      const cal = google.calendar({ version: "v3", auth: getAuth() });
      const res = await cal.calendarList.list();
      return JSON.stringify(res.data.items?.map((c) => ({
        id: c.id,
        name: c.summary,
        description: c.description,
        primary: c.primary,
        timeZone: c.timeZone,
      })), null, 2);
    },
  });
}
