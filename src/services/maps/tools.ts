import { FastMCP } from "fastmcp";
import { z } from "zod";
import { Client, PlacesNearbyRanking, TravelMode } from "@googlemaps/google-maps-services-js";
import { appConfig } from "../../config.js";

const mapsClient = new Client({});

function key() {
  if (!appConfig.mapsApiKey) throw new Error("MAPS_API_KEY is not set");
  return appConfig.mapsApiKey;
}

export function registerMapsTools(server: FastMCP) {
  server.addTool({
    name: "search_places",
    description: "Search for places by text query (restaurants, hotels, landmarks, etc.).",
    parameters: z.object({
      query: z.string().describe("Text search query, e.g. 'coffee shops in Tokyo'"),
      location: z.string().optional().describe("Bias results around this location, e.g. '35.6762,139.6503'"),
      radius: z.number().optional().default(5000).describe("Search radius in meters (default 5000)"),
    }),
    execute: async ({ query, location, radius }) => {
      const params: Parameters<typeof mapsClient.textSearch>[0]["params"] = {
        query,
        key: key(),
        ...(location ? { location } : {}),
        ...(location ? { radius } : {}),
      };
      const res = await mapsClient.textSearch({ params });
      return JSON.stringify(res.data.results?.slice(0, 10).map((p) => ({
        name: p.name,
        address: p.formatted_address,
        rating: p.rating,
        types: p.types?.slice(0, 3),
        location: p.geometry?.location,
        placeId: p.place_id,
        openNow: p.opening_hours?.open_now,
      })), null, 2);
    },
  });

  server.addTool({
    name: "get_place_details",
    description: "Get detailed info about a place including hours, phone, website, reviews.",
    parameters: z.object({
      placeId: z.string().describe("Google Maps place_id"),
    }),
    execute: async ({ placeId }) => {
      const res = await mapsClient.placeDetails({
        params: {
          place_id: placeId,
          key: key(),
          fields: ["name", "formatted_address", "formatted_phone_number", "website",
                   "opening_hours", "rating", "reviews", "types", "url"],
        },
      });
      const p = res.data.result;
      return JSON.stringify({
        name: p.name,
        address: p.formatted_address,
        phone: p.formatted_phone_number,
        website: p.website,
        rating: p.rating,
        openNow: p.opening_hours?.open_now,
        weekdayHours: p.opening_hours?.weekday_text,
        reviews: p.reviews?.slice(0, 3).map((r) => ({ author: r.author_name, rating: r.rating, text: r.text?.slice(0, 200) })),
        googleMapsUrl: p.url,
      }, null, 2);
    },
  });

  server.addTool({
    name: "get_directions",
    description: "Get directions and travel time between two locations.",
    parameters: z.object({
      origin: z.string().describe("Start address or lat,lng"),
      destination: z.string().describe("End address or lat,lng"),
      mode: z.enum(["driving", "walking", "bicycling", "transit"]).optional().default("driving"),
    }),
    execute: async ({ origin, destination, mode }) => {
      const res = await mapsClient.directions({
        params: { origin, destination, mode: mode as TravelMode, key: key() },
      });
      const route = res.data.routes?.[0];
      if (!route) return "No route found";
      const leg = route.legs?.[0];
      return JSON.stringify({
        summary: route.summary,
        distance: leg?.distance?.text,
        duration: leg?.duration?.text,
        startAddress: leg?.start_address,
        endAddress: leg?.end_address,
        steps: leg?.steps?.slice(0, 8).map((s) => s.html_instructions?.replace(/<[^>]*>/g, "")),
      }, null, 2);
    },
  });

  server.addTool({
    name: "geocode",
    description: "Convert an address to coordinates (lat/lng) or reverse geocode coordinates to an address.",
    parameters: z.object({
      address: z.string().optional().describe("Address to geocode"),
      latlng: z.string().optional().describe("Coordinates to reverse geocode, e.g. '48.8566,2.3522'"),
    }),
    execute: async ({ address, latlng }) => {
      const res = await mapsClient.geocode({
        params: { address: address ?? latlng ?? "", key: key() },
      });
      return JSON.stringify(res.data.results?.slice(0, 3).map((r) => ({
        formattedAddress: r.formatted_address,
        location: r.geometry.location,
        types: r.types,
        placeId: r.place_id,
      })), null, 2);
    },
  });
}
