import { FastMCP } from "fastmcp";
import { z } from "zod";
import { google } from "googleapis";
import { serviceConfig } from "../../state/serviceConfig.js";

function getAuth() {
  if (!serviceConfig.googleClientId || !serviceConfig.googleClientSecret)
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  if (!serviceConfig.googleContactsRefreshToken)
    throw new Error("GOOGLE_CONTACTS_REFRESH_TOKEN must be set. Configure via dashboard.");
  const auth = new google.auth.OAuth2(serviceConfig.googleClientId, serviceConfig.googleClientSecret);
  auth.setCredentials({ refresh_token: serviceConfig.googleContactsRefreshToken });
  return auth;
}

export function registerContactsTools(server: FastMCP) {
  server.addTool({
    name: "list_contacts",
    description: "List all contacts from Google Contacts.",
    parameters: z.object({
      maxResults: z.number().optional().default(20).describe("Max contacts to return"),
    }),
    execute: async ({ maxResults }) => {
      const people = google.people({ version: "v1", auth: getAuth() });
      const res = await people.people.connections.list({
        resourceName: "people/me",
        personFields: "names,emailAddresses,phoneNumbers",
        pageSize: maxResults,
      });
      return JSON.stringify(res.data.connections?.map(p => ({
        resourceName: p.resourceName,
        name: p.names?.[0]?.displayName,
        email: p.emailAddresses?.[0]?.value,
        phone: p.phoneNumbers?.[0]?.value,
      })) || [], null, 2);
    },
  });

  server.addTool({
    name: "search_contacts",
    description: "Search Google Contacts by name, email, or phone number.",
    parameters: z.object({
      query: z.string().describe("Search query (e.g. 'John', 'example@gmail.com')"),
      maxResults: z.number().optional().default(10).describe("Max contacts to return"),
    }),
    execute: async ({ query, maxResults }) => {
      const people = google.people({ version: "v1", auth: getAuth() });
      const res = await people.people.searchContacts({
        query,
        readMask: "names,emailAddresses,phoneNumbers",
        pageSize: maxResults,
      });
      return JSON.stringify(res.data.results?.map(r => ({
        resourceName: r.person?.resourceName,
        name: r.person?.names?.[0]?.displayName,
        email: r.person?.emailAddresses?.[0]?.value,
        phone: r.person?.phoneNumbers?.[0]?.value,
      })) || [], null, 2);
    },
  });

  server.addTool({
    name: "create_contact",
    description: "Create a new contact in Google Contacts.",
    parameters: z.object({
      givenName: z.string().describe("First name"),
      familyName: z.string().optional().describe("Last name"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
    }),
    execute: async ({ givenName, familyName, email, phone }) => {
      const people = google.people({ version: "v1", auth: getAuth() });
      const res = await people.people.createContact({
        requestBody: {
          names: [{ givenName, familyName }],
          emailAddresses: email ? [{ value: email }] : [],
          phoneNumbers: phone ? [{ value: phone }] : [],
        },
      });
      return JSON.stringify({
        resourceName: res.data.resourceName,
        name: res.data.names?.[0]?.displayName,
      }, null, 2);
    },
  });
}
