# n8n Spotify Integration Setup

This directory is intended to house documentation and configuration related to integrating n8n with the SmartCradleMonitor application for Spotify control.

## 1. Set up your n8n Instance

If you haven't already, set up your n8n instance. You can run n8n locally, use a cloud provider, or a self-hosted solution. Refer to the official n8n documentation for installation and setup instructions:

- [n8n Documentation](https://docs.n8n.io/)

## 2. Configure Spotify Credentials in n8n

Within your n8n instance, you will need to create Spotify credentials. This typically involves:

1.  **Creating a Spotify Developer Application**: Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/) and create a new application. Note down your Client ID and Client Secret.
2.  **Setting Redirect URIs**: In your Spotify Developer Application settings, add a Redirect URI for your n8n instance. This will usually be `http://localhost:5678/rest/oauth2-credential/callback` if running n8n locally, or your n8n instance URL followed by `/rest/oauth2-credential/callback`.
3.  **Creating Credentials in n8n**: In n8n, go to "Credentials" and add a new "Spotify OAuth2 API" credential. Enter your Client ID, Client Secret, and the Redirect URI you configured.

## 3. Create n8n Workflows for Spotify Actions

You will need to create separate n8n workflows for each Spotify action that the SmartCradleMonitor application will trigger. Each workflow should:

-   **Start with a "Webhook" trigger node**: This will be the entry point for your application to communicate with n8n.
-   **Accept necessary parameters**: For player actions, this might include `action` (e.g., "play", "pause"), `deviceId`, and `playlistId`.
-   **Use the "Spotify" node**: Configure this node to perform the desired Spotify API call (e.g., "Play Playback", "Pause Playback", "Skip to Next", "Skip to Previous").
-   **Return a response**: Use a "Respond to Webhook" node to send a success or error message back to the SmartCradleMonitor application.

Here's a breakdown of the workflows you need to create:

### a. Playback Control Workflows

-   **Play Playback**: Triggered by `/api/spotify/player` with `action: 'play'`. This workflow should take `deviceId` and `playlistId` as input and use the Spotify node to start playback.
-   **Pause Playback**: Triggered by `/api/spotify/player` with `action: 'pause'` or `/api/spotify/player/stop`. This workflow should take `deviceId` as input and use the Spotify node to pause playback.
-   **Skip to Next Track**: Triggered by `/api/spotify/player` with `action: 'next'`. This workflow should take `deviceId` as input and use the Spotify node to skip to the next track.
-   **Skip to Previous Track**: Triggered by `/api/spotify/player` with `action: 'previous'`. This workflow should take `deviceId` as input and use the Spotify node to skip to the previous track.

### b. Information Retrieval Workflows

-   **Get Currently Playing Track**: Triggered by `getCurrentlyPlayingTrack()`. This workflow should use the Spotify node to get the currently playing track and return relevant details (name, artist, album, image URL).
-   **Get Available Devices**: Triggered by `getSpotifyDevices()`. This workflow should use the Spotify node to list available devices and return their IDs and names.
-   **Get User Playlists**: Triggered by `getSpotifyPlaylists()`. This workflow should use the Spotify node to list the user's playlists and return their IDs and names.
-   **Is Spotify Connected**: Triggered by `isSpotifyConnected()`. This workflow should check the validity of the Spotify token and return a boolean indicating connection status.

## 4. Testing

Once your n8n workflows are set up, you can test them using the SmartCradleMonitor application. Ensure that all Spotify player functionalities, as well as status and playlist retrieval, work as expected.