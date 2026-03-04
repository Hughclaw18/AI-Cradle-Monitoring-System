# Smart Cradle Monitor

## Overview
A comprehensive baby monitoring system designed to provide real-time insights and automated responses for enhanced infant care. This system integrates sensor data, intelligent alerts, and seamless Spotify music control, all accessible through a mobile-friendly interface.

## Key Features

*   **Real-time Sensor Monitoring**: Continuously tracks crucial environmental factors such as temperature, detects crying, and identifies objects within the crib area.

*   **Automated Alerts & Notifications**: Delivers instant WebSocket-based notifications to the client application for critical events like high temperature, prolonged crying, or detected objects, ensuring timely intervention.

*   **Smart Spotify Integration**: Automatically plays soothing lullabies via Spotify when crying is detected. Provides comprehensive playback controls (play, pause, next, previous) directly from the client UI.

*   **Streamlit Sensor Simulator**: A flexible tool for testing and development, allowing for both manual input of sensor data and automated generation of random sensor readings at regular intervals.

*   **Responsive Client User Interface**: A modern, intuitive, and mobile-friendly dashboard built with React and Vite, providing a clear overview of sensor data and control over system functionalities.

## Project Structure

```
SmartCradleMonitor/
├── client/          # Frontend UI (React/Vite) for real-time monitoring and control
├── server/          # Backend (Express/WebSocket/Spotify API) handling data, alerts, and integrations
│   ├── routes.ts    # Defines API endpoints and WebSocket message handlers
│   ├── storage.ts   # Manages in-memory data storage for sensor readings and settings
│   └── spotify.ts   # Contains logic for Spotify API authentication and interaction
├── simulator/       # Streamlit application for simulating sensor data input
└── shared/          # Shared TypeScript type definitions and interfaces
```

## Setup Instructions

### Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js**: Version 18 or higher (for backend and frontend development).
*   **Python**: Version 3.8 or higher (for the Streamlit simulator).
*   **Spotify Developer Account**: Required to obtain API credentials for Spotify integration.

### Installation

Follow these steps to set up the project dependencies:

1.  **Install Backend and Frontend Dependencies**

    Navigate to the project root and install Node.js packages:

    ```bash
    npm install
    ```

2.  **Install Simulator Dependencies**

    Install Python packages required for the Streamlit simulator:

    ```bash
    pip install -r simulator/requirements.txt
    ```

### Configuration

1.  **Spotify API Setup**

    To enable Spotify integration, you need to configure your Spotify API credentials:

    *   **Create an Application**: Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/) and create a new application.
    *   **Set Redirect URI**: In your Spotify application settings, add `http://localhost:5000/api/spotify/callback` as a Redirect URI.
    *   **Environment Variables**: Create a `.env` file in the project root directory (`SmartCradleMonitor/`) and add your Spotify Client ID and Client Secret:

        ```env
        SPOTIFY_CLIENT_ID=your_spotify_client_id_here
        SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
        ```

## Running the System

To get the Smart Cradle Monitor up and running, follow these steps:

1.  **Start the Backend Server**

    From the project root directory, run:

    ```bash
    npm run dev
    ```

    *   The server will be accessible at `http://localhost:5000`.
    *   The WebSocket endpoint for real-time communication is `ws://localhost:5000/ws`.

2.  **Start the Streamlit Simulator**

    Navigate into the `simulator` directory and run the Streamlit application:

    ```bash
    cd simulator
    streamlit run streamlit_sensor_simulator.py
    ```

    *   The simulator will typically run on `http://localhost:8501`.

3.  **Access the Client UI**

    Open your web browser or mobile device and navigate to:

    ```
    http://localhost:3000
    ```

    This will load the client application, allowing you to monitor sensor data and control Spotify.

## Usage Guide

### Sensor Data Input

*   **Manual Mode**: Use the sliders and checkboxes provided in the Streamlit simulator to manually adjust and send sensor data (temperature, crying detection, object detection).
*   **Auto Mode**: Enable the 'Auto-send' checkbox in the simulator to automatically generate and send random sensor data every 5 seconds, useful for continuous testing.

### Alerts & Notifications

*   **High Temperature**: A warning notification is triggered if the temperature exceeds 78°F (25.5°C) for more than 1 minute.
*   **Crying Detection**: An alert is sent, and Spotify automatically begins playing a pre-selected lullaby when crying is detected.
*   **Object Detection**: An informational alert is broadcast if an object is detected in the crib area for 30 seconds.

### Spotify Control

*   **Connect Account**: Authorize your Spotify account through the client UI to enable music playback.
*   **Select Playlist**: Choose a desired playlist from your Spotify library to be used for auto-play when crying is detected.
*   **Manual Controls**: Directly control Spotify playback (Play, Pause, Next Track, Previous Track) from the client dashboard.

## Development

To contribute or extend the project:

*   **Frontend**: Develop React components in the `client/` directory.
*   **Backend**: Modify API routes and WebSocket logic in `server/routes.ts` and related files.
*   **Simulator**: Adjust sensor simulation logic in `simulator/streamlit_sensor_simulator.py`.

## Troubleshooting

*   **WebSocket Connection Issues**: Ensure the backend server is running (`npm run dev`) and that port `3000` is not blocked by a firewall or another application.
*   **Spotify Authentication Errors**: Double-check that your Redirect URI is correctly configured in your Spotify Developer Dashboard and that `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are accurately set in your `.env` file.
*   **Streamlit Auto-send Stopping**: Verify the WebSocket connection status displayed in the Streamlit simulator UI. If disconnected, restart the backend server.

## License

This project is licensed under the MIT License.

## Contact

For any questions, issues, or contributions, please contact [ravichandranprajeet18@gmail.com].