import { FastMCP } from "fastmcp";
import { z } from "zod";
import { google } from "googleapis";
import { YoutubeTranscript } from "youtube-transcript";
import { appConfig } from "../../config.js";

function youtubeClient() {
  if (!appConfig.youtubeApiKey) throw new Error("YOUTUBE_API_KEY is not set");
  return google.youtube({ version: "v3", auth: appConfig.youtubeApiKey });
}

export function registerYoutubeTools(server: FastMCP) {
  server.addTool({
    name: "search_videos",
    description: "Search for YouTube videos by query.",
    parameters: z.object({
      query: z.string().describe("Search query"),
      maxResults: z.number().optional().default(5).describe("Max results (1-25)"),
    }),
    execute: async ({ query, maxResults }) => {
      const yt = youtubeClient();
      const res = await yt.search.list({ part: ["snippet"], q: query, type: ["video"], maxResults });
      const items = res.data.items?.map((item) => ({
        videoId: item.id?.videoId,
        title: item.snippet?.title,
        channel: item.snippet?.channelTitle,
        publishedAt: item.snippet?.publishedAt,
        description: item.snippet?.description?.slice(0, 200),
        thumbnail: item.snippet?.thumbnails?.high?.url,
        url: `https://youtube.com/watch?v=${item.id?.videoId}`,
      }));
      return JSON.stringify(items, null, 2);
    },
  });

  server.addTool({
    name: "get_video_details",
    description: "Get detailed info (stats, duration, tags) for a YouTube video.",
    parameters: z.object({ videoId: z.string().describe("YouTube video ID") }),
    execute: async ({ videoId }) => {
      const yt = youtubeClient();
      const res = await yt.videos.list({ part: ["snippet", "contentDetails", "statistics"], id: [videoId] });
      const v = res.data.items?.[0];
      if (!v) return "Video not found";
      return JSON.stringify({
        title: v.snippet?.title,
        channel: v.snippet?.channelTitle,
        viewCount: v.statistics?.viewCount,
        likeCount: v.statistics?.likeCount,
        duration: v.contentDetails?.duration,
        tags: v.snippet?.tags?.slice(0, 10),
        description: v.snippet?.description?.slice(0, 500),
        url: `https://youtube.com/watch?v=${videoId}`,
      }, null, 2);
    },
  });

  server.addTool({
    name: "get_video_transcript",
    description: "Get the full transcript/captions for a YouTube video.",
    parameters: z.object({ videoId: z.string().describe("YouTube video ID") }),
    execute: async ({ videoId }) => {
      try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        return transcript.map((t) => t.text).join(" ");
      } catch {
        return "Transcript not available for this video.";
      }
    },
  });

  server.addTool({
    name: "search_channels",
    description: "Search for YouTube channels by query.",
    parameters: z.object({
      query: z.string().describe("Search query"),
      maxResults: z.number().optional().default(5).describe("Max results"),
    }),
    execute: async ({ query, maxResults }) => {
      const yt = youtubeClient();
      const res = await yt.search.list({ part: ["snippet"], q: query, type: ["channel"], maxResults });
      return JSON.stringify(res.data.items?.map((item) => ({
        channelId: item.id?.channelId,
        title: item.snippet?.title,
        description: item.snippet?.description?.slice(0, 200),
        thumbnail: item.snippet?.thumbnails?.high?.url,
        url: `https://youtube.com/channel/${item.id?.channelId}`,
      })), null, 2);
    },
  });
}
