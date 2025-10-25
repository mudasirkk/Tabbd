# Rack Em Up Pool Cafe Management System

## Overview

Rack Em Up is a real-time pool cafe management system designed for tracking customer sessions across multiple station types (pool tables, gaming stations, and foosball tables). The application provides time-based billing, menu item management, and checkout functionality with a mobile-first design approach. Built as a full-stack TypeScript application using React for the frontend and Express for the backend, it emphasizes quick service operations and clear information display.

## Key Features

- **Multi-session Management**: Support for multiple concurrent active sessions across different stations
- **Session Switcher**: Dropdown selector in detail panel for quick switching between active sessions (appears when 2+ sessions are active)
- **Custom Start Time**: Ability to backdate session start time when staff forgets to start timer immediately (e.g., customer arrived at 7:00pm but timer started at 7:30pm)
- **Pause/Resume Sessions**: Ability to pause active sessions, freezing the timer and charge, with options to resume or complete payment
- **Menu Management**: Dedicated page for adding, editing, and deleting menu items organized by category (Food, Snacks, Dessert, etc.)
- **Square Terminal Integration**: Send checkout payments directly to paired Square Terminal readers for card processing
- **Persistent Sessions**: LocalStorage-based persistence ensures sessions survive page refreshes and browser switches, including paused state
- **Real-time Tracking**: Live timers and automatic charge calculation for all active stations
- **Mobile-optimized**: Touch-friendly interface designed for iPhone Safari and Chrome

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Tooling**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server for fast hot module replacement
- **Wouter** for lightweight client-side routing (single dashboard view with 404 fallback)
- **TanStack Query** for server state management and data fetching

**UI Component System**
- **shadcn/ui** components built on Radix UI primitives for accessible, customizable interface elements
- **Tailwind CSS** for utility-first styling with custom design tokens
- **Material Design** influence with modern productivity tool aesthetics (Linear, Notion-inspired)
- Dark mode primary with light mode support via CSS custom properties
- Mobile-first responsive design (breakpoint at 768px)

**Design System**
- Custom color palette with station-type color coding (cyan for pool, purple for gaming, green for foosball)
- Inter font family for UI text, JetBrains Mono for numeric displays (timers, prices)
- Consistent spacing scale using Tailwind units (2, 4, 6, 8, 12)
- Elevated interaction states using custom CSS variables (--elevate-1, --elevate-2)

**State Management Pattern**
- Local component state for UI interactions (dialogs, forms)
- Real-time timer logic handled client-side with useEffect hooks
- Session data maintained in component state (stations array with active/inactive status)
- **Hybrid persistence strategy**:
  - Sessions stored in browser localStorage (key: 'poolcafe_stations') for single-device use
  - Menu items stored in PostgreSQL database for cross-device persistence
  - TanStack Query for server state management with automatic cache invalidation
  - **NO fallback to hardcoded menu items** - loading/error states shown instead
  - Retry logic (3 attempts, 1s delay) for menu item queries
- Toast notifications for user feedback and error states

**Price Snapshot System (Critical Feature)**
- Session items store price snapshots at the time they were added
- Data structure: `StoredSessionItem[] = [{ itemId, name, quantity, price }]`
- Same item can appear multiple times with different prices in one session
- Example: Add 2 @ $9.99, update price to $12.50, add 1 more → subtotal: $32.48 (2×$9.99 + 1×$12.50)
- This ensures accurate billing even when menu prices change during active sessions
- **Migration System**: Automatically converts legacy session data from old format (`{[itemId]: quantity}`) to new format, preserving quantities and updating prices when menu loads

**Station Configuration**
- **Pool Tables** (6 total): Left 1, Left 2, Left 3, Right 1, Right 2, Right 3 (IDs: P1-P6)
- **Gaming Stations** (3 total): Gaming Station 1, Gaming Station 2, Gaming Station 3 (IDs: G1-G3)
- **Foosball Tables** (1 total): Foosball Table (ID: F1)
- **Station Display Order**: Enforced via migration logic to always follow the canonical order from initialStations array (P1-P6, G1-G3, F1)
- **Pricing Tiers**:
  - Pool & Foosball tables: Dual pricing options in checkout (Group: $16/hr, Solo: $10/hr)
  - Gaming stations: Fixed $16/hr rate
  - Default selection: Group pricing for applicable stations

### Backend Architecture

**Server Framework**
- **Express.js** with TypeScript for RESTful API endpoints
- Middleware pipeline for JSON parsing, URL encoding, and request logging
- Custom logging system with timestamp formatting for development visibility
- Error handling middleware for consistent error responses

**Development Setup**
- **Vite middleware mode** integration for seamless HMR in development
- Separate development and production build processes
- esbuild for server-side bundling in production

**Data Layer Design**
- PostgreSQL database with Drizzle ORM for type-safe queries
- RESTful API endpoints for menu item CRUD operations
- IStorage interface pattern for abstraction between storage implementations
- Zod validation on all API inputs with proper error handling

### Database Schema

**Current Implementation**
- **Users table**: UUID primary keys, username/password authentication
- **Menu items table** (implemented): 
  - id: varchar (UUID primary key)
  - name: text (not null)
  - price: numeric(10,2) (not null, stored as string in JavaScript)
  - category: text (not null)
- Schema defined with Drizzle ORM and Zod validation
- API routes with validation: GET, POST, PATCH, DELETE for menu items

**Price Handling**
- Database stores prices as numeric(10,2) which returns as strings in JavaScript
- Frontend converts to numbers for calculations using defensive parsing
- Display uses parseFloat() with toFixed(2) for consistent formatting

**Square Integration Features**
- OAuth authentication with PAYMENTS_WRITE scope for Terminal API access
- Import menu items from Square catalog with category grouping
- List and select paired Square Terminal devices
- Send checkout payments to physical Square readers via Terminal API
- Device selection in checkout dialog when Square is connected
- Automatic payment requests with station name, pricing tier, and duration notes

**Square Terminal Checkout Flow**
1. Connect Square account via OAuth (PAYMENTS_WRITE permission required)
2. Pair Square Terminal device using Square Dashboard
3. Start session and add items as normal in the app
4. Click checkout - device selector appears if Square is connected
5. Select paired Terminal device from dropdown
6. Click "Send to Terminal" - payment request sent to physical reader
7. Customer completes payment on Terminal device
8. Session ends after successful terminal API request

**Future Extensions**
- Database tables for stations, sessions, session items, and transactions
- Webhook integration for real-time Terminal payment status updates (COMPLETED/CANCELED)
- Historical session records and reporting
- Multi-location support with location-based pricing

### External Dependencies

**UI & Styling**
- Radix UI component primitives (@radix-ui/* packages) for accessible headless components
- Tailwind CSS with PostCSS for styling pipeline
- class-variance-authority and clsx for conditional class composition
- Embla Carousel for potential slideshow functionality
- Lucide React for consistent icon system

**Data & Validation**
- Drizzle ORM for type-safe database queries
- Drizzle Zod for schema-to-validation integration
- Zod for runtime type validation
- React Hook Form with resolvers for form state management

**Database & Session**
- @neondatabase/serverless for PostgreSQL connectivity
- connect-pg-simple for PostgreSQL session storage (prepared for authentication)

**Development Tools**
- tsx for TypeScript execution in development
- Vite plugins for Replit integration (cartographer, dev banner, runtime error overlay)
- date-fns for date/time manipulation

**State Management**
- @tanstack/react-query for server state caching and synchronization
- cmdk for command palette functionality (prepared for keyboard shortcuts)

**Type Safety**
- Shared schema types between client and server via @shared/* path alias
- Strict TypeScript configuration with path mapping for imports
- Zod schemas for runtime validation matching database types