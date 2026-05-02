# Google MCP

A single MCP gateway that exposes Google services as separate endpoints — connect your AI client to only the services you need.

```
http://localhost:8080/mcp/youtube    ← YouTube (search, transcripts, details)
http://localhost:8080/mcp/maps       ← Google Maps (places, directions, geocoding)
http://localhost:8080/mcp/calendar   ← Google Calendar (events, create/delete)
http://localhost:8080/mcp/gmail      ← Gmail (read, search, send)
http://localhost:8080/mcp/contacts   ← Google Contacts (list, search, create)

http://localhost:8080/dashboard      ← WebUI control center
http://localhost:8080/configure      ← Dynamic configuration manager
```

## Architecture

```
                ┌─────────────────────────────────────────┐
  AI Client ──▶ │  Gateway  :8080                          │
                │  /mcp/youtube ──proxy──▶ :8081 (FastMCP) │
                │  /mcp/maps    ──proxy──▶ :8082 (FastMCP) │
                │  /mcp/calendar──proxy──▶ :8083 (FastMCP) │
                │  /mcp/gmail   ──proxy──▶ :8084 (FastMCP) │
                │  /mcp/contacts──proxy──▶ :8085 (FastMCP) │
                │  /dashboard   ──────────  WebUI          │
                └─────────────────────────────────────────┘
```

Each service runs as an independent FastMCP process on an internal port. Only port 8080 is exposed.

## Quick Start

```bash
git clone <repo>
cd google-mcp
npm install
cp .env.example .env
# Fill in your API keys (see Setup below)
npm run dev
```

## Setup

### YouTube & Maps (API Key)
1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. Create an **API Key**
3. Enable **YouTube Data API v3** and/or **Maps JavaScript API**
4. Set `YOUTUBE_API_KEY` and/or `MAPS_API_KEY` in `.env`

### Calendar & Gmail (OAuth2)
1. In Cloud Console → Credentials → **Create OAuth 2.0 Client ID** (Desktop app)
2. Enable **Google Calendar API** and **Gmail API**
3. Get your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
4. Exchange an auth code for refresh tokens:

```bash
# Step 1 — Open this URL in your browser, authorize the app
https://accounts.google.com/o/oauth2/v2/auth?client_id=<YOUR_CLIENT_ID>&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/calendar%20https://www.googleapis.com/auth/gmail.modify%20https://www.googleapis.com/auth/contacts&access_type=offline&prompt=consent

# Step 2 — Exchange the code for tokens
curl -X POST https://oauth2.googleapis.com/token \
  -d client_id=<YOUR_CLIENT_ID> \
  -d client_secret=<YOUR_CLIENT_SECRET> \
  -d code=<CODE_FROM_BROWSER> \
  -d grant_type=authorization_code \
  -d redirect_uri=urn:ietf:wg:oauth:2.0:oob
```
Copy `refresh_token` from the response into `GOOGLE_CALENDAR_REFRESH_TOKEN`, `GOOGLE_GMAIL_REFRESH_TOKEN`, and `GOOGLE_CONTACTS_REFRESH_TOKEN`.

## MCP Endpoint Auth (optional)

Set `MCP_ACCESS_TOKEN` in `.env` to protect all `/mcp/*` endpoints.  
Clients must then send: `Authorization: Bearer <your-token>`

**Claude Desktop config example:**
```json
{
  "mcpServers": {
    "google-youtube": {
      "url": "http://localhost:8080/mcp/youtube",
      "headers": { "Authorization": "Bearer <your-token>" }
    },
    "google-maps": {
      "url": "http://localhost:8080/mcp/maps",
      "headers": { "Authorization": "Bearer <your-token>" }
    }
  }
}
```

## Available Tools

### 📺 YouTube (`/mcp/youtube`)
| Tool | Description |
|------|-------------|
| `search_videos` | Search YouTube videos by query |
| `get_video_details` | Get stats, duration, tags for a video |
| `get_video_transcript` | Fetch full captions/transcript |
| `search_channels` | Search for channels |

### 🗺️ Maps (`/mcp/maps`)
| Tool | Description |
|------|-------------|
| `search_places` | Text search for places |
| `get_place_details` | Hours, phone, reviews for a place |
| `get_directions` | Directions + travel time between two points |
| `geocode` | Address ↔ coordinates conversion |

### 📅 Calendar (`/mcp/calendar`)
| Tool | Description |
|------|-------------|
| `list_events` | List upcoming events with filters |
| `create_event` | Create an event with attendees |
| `delete_event` | Delete an event by ID |
| `list_calendars` | List all calendars |

### 📧 Gmail (`/mcp/gmail`)
| Tool | Description |
|------|-------------|
| `list_emails` | List emails from inbox |
| `get_email` | Read full email content |
| `send_email` | Send an email |
| `search_emails` | Search with Gmail query syntax |

### 👤 Contacts (`/mcp/contacts`)
| Tool | Description |
|------|-------------|
| `list_contacts` | List all contacts |
| `search_contacts` | Search contacts by name/email/phone |
| `create_contact` | Create a new contact |

### Docker
Build locally:
```bash
docker build -t google-mcp .
docker run -p 8080:8080 --env-file .env google-mcp
```

### Docker Compose (GHCR)
Use the pre-built image from GitHub Container Registry:
```yaml
services:
  google-mcp:
    image: ghcr.io/danish-mar/google-mcp:latest
    ports:
      - "8080:8080"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

## WebUI

Dashboard at `http://localhost:8080/dashboard` — shows service status, endpoints, and live metrics. Log in with `WEBUI_PASSWORD`.
