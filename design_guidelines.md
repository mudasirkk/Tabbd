# Design Guidelines: Rack Em Up Pool Cafe Management System

## Design Approach
**System:** Material Design with modern productivity tool influence (Linear, Notion)
**Rationale:** Utility-focused business management application requiring clear information hierarchy, real-time data display, and mobile-first operation for quick customer service.

## Core Design Elements

### Color Palette

**Dark Mode (Primary):**
- Background: 220 15% 12% (deep blue-gray base)
- Surface: 220 14% 16% (elevated cards/panels)
- Primary Brand: 198 85% 52% (vibrant cyan for active timers, CTAs)
- Success: 142 76% 45% (available stations, completed actions)
- Warning: 38 92% 50% (long-running sessions)
- Error: 0 84% 60% (stop/cancel actions)
- Text Primary: 0 0% 98%
- Text Secondary: 220 9% 65%

**Light Mode:**
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Primary Brand: 198 85% 45%
- Text Primary: 220 20% 20%
- Text Secondary: 220 9% 46%

**Accent Colors:**
- Pool Tables: 198 85% 52% (cyan)
- Gaming Stations: 271 81% 56% (purple)
- Foosball: 142 76% 45% (green)

### Typography
- **Primary Font:** Inter (400, 500, 600, 700) via Google Fonts
- **Monospace:** JetBrains Mono (for prices, timers) via Google Fonts
- **Hierarchy:**
  - H1: text-3xl/text-4xl font-bold (Dashboard title)
  - H2: text-xl/text-2xl font-semibold (Section headers)
  - H3: text-lg font-semibold (Station names)
  - Body: text-base (Standard content)
  - Caption: text-sm text-secondary (Helper text)
  - Timer Display: text-3xl font-mono font-bold
  - Price Display: text-2xl font-mono font-semibold

### Layout System
**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12
- Card padding: p-4 to p-6
- Section spacing: gap-6 to gap-8
- Button padding: px-6 py-3
- Grid gaps: gap-4

**Grid Structure:**
- Desktop: 3-column grid for stations (grid-cols-3)
- Tablet: 2-column grid (md:grid-cols-2)
- Mobile: Single column (grid-cols-1)
- Max container width: max-w-7xl

### Component Library

**Navigation:**
- Top bar with business name, current time/date
- Tab navigation: Dashboard | Active Sessions | Menu Items | History
- Quick action button (floating): "+ New Session"

**Station Cards:**
- Large, tappable cards (min-h-48) with station icon and number
- Status indicator (Available/Active) with color-coded border-l-4
- Real-time timer display (HH:MM:SS format, font-mono)
- Running total prominently displayed
- Primary action button: "Start" (success) / "Stop" (error)

**Active Session Panel:**
- Station identification header
- Large timer with running charge display
- "Add Items" button (outline variant)
- Scrollable items list with individual prices
- Subtotal breakdown: Time Charge + Items = Total
- Action buttons: "Add Item" | "End Session & Checkout"

**Menu Item Selector:**
- Grid of item cards (2-3 columns on mobile, 4-6 on desktop)
- Each card: Item name, price, tap to add
- Quick increment/decrement for quantities
- Instant feedback on addition (subtle success animation)

**Checkout Screen:**
- Receipt-style layout with clear line items
- Time duration and rate breakdown
- Itemized purchases list
- Bold total amount (text-4xl font-mono)
- Payment confirmation button (large, high-contrast)

**Forms & Inputs:**
- Consistent dark mode styling with visible borders
- Focus states with primary color ring
- Clear labels and helper text
- Numeric inputs for prices with currency formatting

### Data Display
- Use cards for information grouping (rounded-lg shadow-lg)
- Color-coded status indicators (not just text)
- Real-time updates without page refresh
- Clear visual separation between stations (border, shadow)
- Monospace fonts for all numerical data (consistency)

### Animations
**Minimal, Purposeful Only:**
- Timer counting: smooth number transitions
- Status changes: 200ms color fade
- Card interactions: subtle scale on tap (scale-[0.98])
- Avoid decorative animations - prioritize performance

### Icons
**Library:** Heroicons (via CDN)
- Clock icon for timers
- Play/Stop icons for session controls
- Shopping bag for menu items
- Check circle for confirmations
- Table/gamepad icons for station types

### Mobile Optimization
- Touch-friendly targets (min 44px height)
- Bottom-sheet modals for actions
- Sticky checkout button when scrolling items
- Swipe gestures for quick actions (optional)
- Large, easily tappable station cards

### Professional Polish
- Consistent 8px border radius on all cards/buttons
- Subtle shadows for depth (shadow-md to shadow-lg)
- High contrast text on all backgrounds
- Loading states for all async operations
- Error handling with clear user messaging
- Confirmation dialogs for destructive actions (End Session)