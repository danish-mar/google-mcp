import { google } from "googleapis";
import { YoutubeTranscript } from "youtube-transcript";
import { appConfig } from "../config.js";

const youtube = google.youtube({
  version: "v3",
  auth: appConfig.youtubeApiKey,
});

export async function searchVideos(query: string, maxResults: number = 5) {
  if (!appConfig.youtubeApiKey) {
    throw new Error("YOUTUBE_API_KEY is not set in environment variables");
  }

  const response = await youtube.search.list({
    part: ["snippet"],
    q: query,
    type: ["video"],
    maxResults,
  });

  return response.data.items?.map((item) => ({
    title: item.snippet?.title,
    videoId: item.id?.videoId,
    description: item.snippet?.description,
    channelTitle: item.snippet?.channelTitle,
    publishedAt: item.snippet?.publishedAt,
    thumbnail: item.snippet?.thumbnails?.high?.url,
  }));
}

export async function getVideoDetails(videoId: string) {
  if (!appConfig.youtubeApiKey) {
    throw new Error("YOUTUBE_API_KEY is not set in environment variables");
  }

  const response = await youtube.videos.list({
    part: ["snippet", "contentDetails", "statistics"],
    id: [videoId],
  });

  const video = response.data.items?.[0];
  if (!video) return null;

  return {
    title: video.snippet?.title,
    description: video.snippet?.description,
    channelTitle: video.snippet?.channelTitle,
    viewCount: video.statistics?.viewCount,
    likeCount: video.statistics?.likeCount,
    duration: video.contentDetails?.duration,
    tags: video.snippet?.tags,
  };
}

export async function getVideoTranscript(videoId: string) {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript.map((t) => t.text).join(" ");
  } catch (error) {
    console.error("Error fetching transcript:", error);
    return "Transcript not available for this video.";
  }
}

export async function searchChannels(query: string, maxResults: number = 5) {
  if (!appConfig.youtubeApiKey) {
    throw new Error("YOUTUBE_API_KEY is not set in environment variables");
  }

  const response = await youtube.search.list({
    part: ["snippet"],
    q: query,
    type: ["channel"],
    maxResults,
  });

  return response.data.items?.map((item) => ({
    title: item.snippet?.title,
    channelId: item.id?.channelId,
    description: item.snippet?.description,
    thumbnail: item.snippet?.thumbnails?.high?.url,
  }));
}
