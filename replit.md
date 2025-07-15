# Smart Baby Monitor System

## Overview

This is a smart baby monitor system built with React, TypeScript, Express, and Drizzle ORM. The application provides real-time monitoring of baby conditions including temperature, motion detection, and crying detection, with automated responses like music playback and cradle rocking via servo control.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: WebSocket connection for live updates

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket server for live sensor data streaming
- **Session Management**: PostgreSQL session store
- **Development**: Hot reload with Vite middleware integration

### Database Schema
The system uses PostgreSQL with five main tables:
- `sensor_data`: Temperature, motion, and crying detection readings
- `servo_status`: Cradle position and movement status
- `music_status`: Current playback state and track information
- `system_settings`: User preferences and thresholds
- `tracks`: Music library with metadata

## Key Components

### Sensor Monitoring
- Temperature monitoring with configurable thresholds
- Motion detection with adjustable sensitivity levels
- Crying detection with machine learning integration
- Real-time data streaming via WebSocket

### Servo Control System
- 180-degree servo motor control for cradle rocking
- Manual positioning and automated rocking modes
- Safety features including emergency stop functionality
- Position feedback and movement status tracking

### Music Player
- Built-in music library with track management
- Volume control and playback progress tracking
- Automatic music triggering based on sensor inputs
- Support for various audio formats

### Settings Management
- Configurable sensor thresholds and sensitivity
- Alert preferences for notifications
- Auto-response settings for hands-free operation
- Night mode and other operational preferences

## Data Flow

1. **Sensor Input**: Hardware sensors collect temperature, motion, and audio data
2. **Data Processing**: Server processes sensor readings and stores in database
3. **Real-time Updates**: WebSocket broadcasts updates to connected clients
4. **Automated Responses**: System triggers music playback or servo movement based on settings
5. **User Interface**: React components display real-time data and provide controls
6. **User Actions**: Manual controls send commands through REST API endpoints

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database driver optimized for serverless
- **drizzle-orm**: Type-safe database ORM with PostgreSQL support
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/react-***: Accessible UI component primitives
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Lightweight routing library

### Development Tools
- **vite**: Fast build tool with hot module replacement
- **tsx**: TypeScript execution for Node.js
- **@replit/vite-plugin-***: Replit-specific development enhancements

## Deployment Strategy

### Development Environment
- Uses Vite dev server with Express middleware integration
- Hot module replacement for rapid development
- TypeScript compilation with strict mode enabled
- Replit-specific tooling for cloud development

### Production Build
- Vite builds optimized React bundle to `dist/public`
- ESBuild compiles Express server to `dist/index.js`
- Single deployment artifact with static assets
- Environment-based configuration for database connections

### Database Migration
- Drizzle Kit handles schema migrations
- Push-based deployment for schema changes
- Environment variable configuration for database URL
- Automatic migration execution on deployment

The system is designed as a monorepo with shared TypeScript types between client and server, ensuring type safety across the entire application stack.