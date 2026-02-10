# QR Master

## Overview

QR Master is a full-stack web application for creating, managing, and tracking QR codes with detailed analytics. Users can generate dynamic QR codes that link to destination URLs, then monitor scan statistics including device types, locations, and timestamps. The application uses Replit Auth for authentication and provides a modern, responsive dashboard interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled with Vite
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Animations**: Framer Motion for page transitions and UI effects
- **Charts**: Recharts for visualizing scan analytics

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with tsx for development
- **API Design**: RESTful endpoints defined in shared route contracts
- **Session Management**: express-session with PostgreSQL session store (connect-pg-simple)

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Managed via `drizzle-kit push`

### Authentication
- **Provider**: Replit Auth (OpenID Connect)
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple
- **User Model**: UUID-based user IDs stored in `users` table
- **Auth Files**: Located in `server/replit_integrations/auth/`

### Key Design Patterns
- **Shared Types**: Schema and route definitions in `shared/` directory are used by both client and server
- **Type-safe API Contracts**: `shared/routes.ts` defines API endpoints with Zod schemas for request/response validation
- **Component Architecture**: Reusable UI components in `client/src/components/ui/` following shadcn/ui patterns

### Build System
- **Development**: Vite dev server with HMR, Express backend via tsx
- **Production**: Vite builds client to `dist/public`, esbuild bundles server to `dist/index.cjs`
- **Build Script**: Custom `script/build.ts` handles both client and server builds

## External Dependencies

### Database
- **PostgreSQL**: Primary database for all application data
- **Connection**: Via `DATABASE_URL` environment variable
- **Tables**: users, sessions, qr_codes, scans

### Authentication
- **Replit Auth**: OpenID Connect provider for user authentication
- **Required Environment Variables**: 
  - `ISSUER_URL` (defaults to https://replit.com/oidc)
  - `REPL_ID`
  - `SESSION_SECRET`

### Client Libraries
- **qrcode.react**: QR code generation and rendering
- **html-to-image**: Exporting QR codes as downloadable images
- **date-fns**: Date formatting utilities

### Development Tools
- **@replit/vite-plugin-runtime-error-modal**: Error overlay for development
- **@replit/vite-plugin-cartographer**: Replit-specific development tooling