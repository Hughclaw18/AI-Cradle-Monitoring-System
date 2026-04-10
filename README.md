# Smart Cradle Monitor

An AI-powered infant safety system that uses real-time computer vision (YOLOv11, YOLOe, YAMNet), environmental sensors, and automated responses to monitor baby sleep posture, detect hazards, detect infant cry and soothe the infant — all accessible from a modern web dashboard.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Running Locally](#running-locally)
- [Deploying to Railway](#deploying-to-railway)
- [Environment Variables](#environment-variables)
- [Simulator Setup](#simulator-setup)
- [Spotify Integration](#spotify-integration)
- [SMS Notifications (Twilio)](#sms-notifications-twilio)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Real-time AI Detection** — YOLOe and YOLOv11s-seg for hazard detection + custom posture model for SIDS risk classification (Back / Side / Stomach)
- **Live Video Feed** — Simulator streams MJPEG frames to the dashboard via a dedicated endpoint
- **WebSocket Telemetry** — Sub-100ms sensor data broadcast to all connected clients
- **Spotify Integration** — Auto-plays lullabies when crying is detected; full playback controls from the dashboard
- **SMS Alerts** — Twilio-powered notifications for critical events (high temp, crying, hazardous objects)
- **Sensor Simulator** — Streamlit app to inject sensor data, run AI inference on images/video/audio, and stream live webcam feed
- **PostgreSQL Persistence** — Full history of sensor readings, sleep positions, and detection events via Drizzle ORM

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Node.js, Express, WebSocket (ws), Passport.js |
| Database | PostgreSQL, Drizzle ORM |
| AI / Simulator | Python, Streamlit, YOLOv11 (Ultralytics), PyTorch, TensorFlow (YAMNet) |
| Integrations | Spotify Web API, Twilio SMS |
| Deployment | Railway (backend + DB), local Python (simulator) |

---

## Project Structure

```
SmartCradleMonitor/
├── client/               # React/Vite frontend
│   └── src/
│       ├── components/   # UI components (dashboard, video feed, music player, etc.)
│       ├── hooks/        # Custom React hooks (WebSocket, auth, notifications)
│       └── pages/        # Dashboard, auth, 404
├── server/               # Express backend
│   ├── index.ts          # Entry point
│   ├── routes.ts         # REST API + WebSocket handlers
│   ├── auth.ts           # Passport.js session auth
│   ├── db.ts             # Drizzle DB connection
│   ├── storage.ts        # Data access layer
│   ├── spotify.ts        # Spotify API integration
│   └── notifications.ts  # Twilio SMS
├── shared/
│   └── schema.ts         # Drizzle schema + shared TypeScript types
├── simulator/            # Python Streamlit simulator
│   ├── app.py            # Entry point
│   ├── config.py         # Simulator configuration
│   ├── components/       # Sidebar, session, WebSocket manager, tabs
│   ├── utils/            # Model loaders, inference helpers
│   └── models/           # best.pt (posture model)
├── models/
│   └── yoloe-11s-seg.pt  # Hazard detection model
│   └── yolov-11s-seg.pt  # Posture detection model
│   └── yamnet.pt  # Cry detection model
└── scripts/              # DB seeding and utility scripts
```

---

## Prerequisites

- **Node.js** v20+
- **Python** 3.10+
- **PostgreSQL** database (local — PGAdmin or cloud — Railway provides one)
- **Spotify Developer Account** (for music features, only acessible to premium account holders)
- **Twilio Account** (optional, for SMS alerts)

---

## Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/your-username/SmartCradleMonitor.git
cd SmartCradleMonitor
```

### 2. Install Node.js dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE

# Spotify
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:5000/api/spotify/callback

# Twilio (optional)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
TWILIO_MESSAGING_SERVICE_SID=your_messaging_service_sid

# Simulator auth token (must match simulator config)
SIMULATOR_TOKEN=your_secret_token

# Session secret
SESSION_SECRET=a_long_random_string
```

### 4. Push the database schema

```bash
npm run db:push
```

### 5. (Optional) Seed demo data

```bash
node scripts/seed-demo-data.mjs
```

### 6. Start the development server

```bash
npm run dev
```

The app will be available at **http://localhost:5000**

> The backend serves both the API and the React frontend in development mode via Vite middleware.

---

## Deploying to Railway

### 1. Create a Railway project

Go to [railway.app](https://railway.app), create a new project, and add a **PostgreSQL** service.

### 2. Add a new service from GitHub

- Connect your GitHub repo
- Railway will auto-detect the Node.js project

### 3. Set environment variables

In your Railway service settings, add all variables from the [Environment Variables](#environment-variables) section below.

Key values to update for Railway:

```env
DATABASE_URL=<Railway PostgreSQL connection string>
SPOTIFY_REDIRECT_URI=https://your-app.up.railway.app/api/spotify/callback
SESSION_SECRET=a_long_random_string_change_this
NODE_ENV=production
```

### 4. Configure build and start commands

Railway should auto-detect these from `package.json`, but verify:

- **Build command:** `npm run build`
- **Start command:** `npm run start`

The build script compiles the React frontend with Vite and bundles the Express server with esbuild into `dist/`.

### 5. Run database migrations

After the first deploy, open a Railway shell or run via the CLI:

```bash
npm run db:push
```

### 6. Update Spotify redirect URI

In your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), add your Railway URL as a Redirect URI:

```
https://your-app.up.railway.app/api/spotify/callback
```

### 7. Deploy

Push to your connected branch — Railway will build and deploy automatically.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Secret for session cookie signing |
| `SPOTIFY_CLIENT_ID` | Yes* | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Yes* | Spotify app client secret |
| `SPOTIFY_REDIRECT_URI` | Yes* | OAuth callback URL (must match Spotify dashboard) |
| `SIMULATOR_TOKEN` | Yes | Shared secret between simulator and backend |
| `TWILIO_ACCOUNT_SID` | No(Option) | Twilio account SID for SMS |
| `TWILIO_AUTH_TOKEN` | No(Option) | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | No(Option) | Twilio sender phone number |
| `TWILIO_MESSAGING_SERVICE_SID` | No(Option) | Twilio messaging service SID |
| `PORT` | No(Option) | Server port (Railway sets this automatically) |
| `NODE_ENV` | No(Option) | Set to `production` for Railway |

*Required only if using Spotify integration.

---

## Simulator Setup

The simulator is a standalone Python/Streamlit app that connects to the backend via WebSocket and REST. It runs locally even when the backend is deployed to Railway.

### 1. Install Python dependencies

```bash
cd simulator
pip install -r requirements.txt
```

> PyTorch with CUDA is recommended for real-time inference. If you don't have a GPU, CPU inference will work but will be slower.

### 2. Download AI models

Place the model files in the correct locations:

| Model | Path | Purpose |
|---|---|---|
| `yoloe-11s-seg.pt` | `models/yoloe-11s-seg.pt` | Hazard/object detection |
| `best.pt` | `simulator/models/best.pt` | Infant posture classification |

### 3. Configure the simulator

Edit `simulator/config.py` to match your environment:

```python
# Path to ffmpeg binary (used for video processing)
FFMPEG_PATH = r"path/to/ffmpeg.exe"   # Windows
# FFMPEG_PATH = "/usr/bin/ffmpeg"     # Linux/Mac

# Database URL (optional, for direct DB writes)
DB_URL = "postgresql://..."
```

### 4. Set backend URL

The simulator reads the backend URL from environment variables or defaults to localhost. To point it at Railway:

```bash
# Windows
set BACKEND_BASE_URL=https://your-app.up.railway.app
set WEBSOCKET_URL=wss://your-app.up.railway.app/socket
set SIMULATOR_TOKEN=your_secret_token

# Linux/Mac
export BACKEND_BASE_URL=https://your-app.up.railway.app
export WEBSOCKET_URL=wss://your-app.up.railway.app/socket
export SIMULATOR_TOKEN=your_secret_token
```

### 5. Run the simulator

```bash
cd simulator
streamlit run app.py
```

The simulator opens at **http://localhost:8501**

### Simulator Tabs

| Tab | Description |
|---|---|
| Sensor Simulator | Manually send temperature, humidity, crying, and object detection data |
| Image Analysis | Upload an image and run posture + hazard detection |
| Video Analysis | Upload a video file for frame-by-frame AI analysis |
| Audio / Cry Detection | Upload an audio file to test YAMNet cry detection |
| Live Mic | Real-time microphone input for live cry detection |

---

## Spotify Integration

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create an app
2. Add your redirect URI (local: `http://localhost:5000/api/spotify/callback`, Railway: `https://your-app.up.railway.app/api/spotify/callback`)
3. Copy the Client ID and Client Secret into your `.env`
4. From the dashboard, click **Connect Spotify** and authorize
5. Select a playlist — it will auto-play when crying is detected

> Spotify requires a **Premium account** for playback control via the Web API.

---

## SMS Notifications (Twilio)

1. Create a [Twilio account](https://www.twilio.com) and get a phone number
2. Add your Twilio credentials to `.env`
3. In the dashboard Settings panel, add your phone number to your profile
4. Enable push notifications in settings
5. Test via the API: `POST /api/notifications/test-sms`

Alerts are sent for:
- Crying detected (with cooldown to avoid spam)
- High temperature threshold exceeded
- Hazardous object detected in crib

---

## Troubleshooting

**WebSocket not connecting**
- Ensure the backend is running and `SIMULATOR_TOKEN` matches on both sides
- For Railway, confirm the WebSocket URL uses `wss://` not `ws://`

**Spotify auth failing**
- Double-check the redirect URI in both `.env` and the Spotify Developer Dashboard — they must match exactly
- Spotify Premium is required for playback control

**Database connection errors**
- Verify `DATABASE_URL` is correct and the database is accessible
- Run `npm run db:push` to ensure the schema is up to date

**Simulator models not loading**
- Confirm `models/yoloe-11s-seg.pt` and `simulator/models/best.pt` exist
- Check that PyTorch is installed correctly: `python -c "import torch; print(torch.__version__)"`

**SMS not sending**
- Run `GET /api/notifications/status` to check Twilio config status
- Ensure the user profile has a phone number set

---

## License

MIT License — see [LICENSE](LICENSE) for details.

## Contact

For questions or issues: [ravichandranprajeet18@gmail.com]
