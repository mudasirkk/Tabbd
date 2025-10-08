# Rack Em Up Pool Cafe Management System

## Overview

Rack Em Up is a real-time pool cafe management system designed for tracking customer sessions across multiple station types (pool tables, gaming stations, and foosball tables). The application provides time-based billing, menu item management, and checkout functionality with a mobile-first design approach. Built as a full-stack TypeScript application using React for the frontend and Express for the backend, it emphasizes quick service operations and clear information display.

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
- Toast notifications for user feedback

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
- In-memory storage implementation (MemStorage class) with interface-based pattern
- Designed for easy migration to persistent database (PostgreSQL via Drizzle ORM)
- CRUD interface pattern (IStorage) for abstraction between storage implementations

### Database Schema

**Current Implementation**
- Simple users table with UUID primary keys
- Username/password authentication structure
- Schema defined with Drizzle ORM and Zod validation

**Design for Extension**
- PostgreSQL configured via Drizzle Kit (migrations ready)
- Neon serverless Postgres driver included for cloud deployment
- Schema extensible for stations, sessions, menu items, and transactions

**Expected Data Models** (not yet implemented)
- Stations: ID, name, type (pool/gaming/foosball), hourly rate
- Sessions: ID, station ID, start time, end time, customer name
- Menu items: ID, name, price, category
- Session items: Session ID, menu item ID, quantity
- Transactions: Session ID, total amount, payment method, timestamp

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