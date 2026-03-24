# NorthMesh - Specification

## Concept & Vision

NorthMesh is a real-time mesh network visualization platform for the northern UK region, inspired by the aurora borealis. The interface evokes the cold, vast darkness of the northern sky punctuated by signals of connectivity—like nodes of light forming a digital aurora across the landscape. It feels technical and alive, with subtle animations suggesting data flowing through the network like solar winds through the magnetosphere.

## Design Language

### Aesthetic Direction
**"Arctic Signal"** — Deep polar night blues with aurora-inspired accent colors (teals, cyans, soft greens). The map is the hero: dark, immersive, with nodes glowing like stars or aurora curtains. UI panels float like ice shelves against the night.

### Color Palette
```css
--bg-void:        #060a12;      /* Deepest background - the night sky */
--bg-panel:       #0c1220;      /* Panel backgrounds - slightly lighter */
--bg-elevated:    #121a2e;      /* Elevated surfaces */
--accent-aurora:  #00e5cc;      /* Primary aurora teal */
--accent-cyan:    #00d4ff;      /* Secondary cyan signal */
--accent-green:   #34f5a0;      /* Aurora green for online/success */
--accent-purple:  #a78bfa;      /* Aurora purple for paths/history */
--warning:        #fbbf24;      /* Amber warning signals */
--danger:         #f43f5e;      /* Red alert */
--text-primary:   #e2e8f0;      /* Primary text */
--text-muted:     #64748b;      /* Secondary/muted text */
--border:         #1e293b;      /* Subtle borders */
```

### Typography
- **Headings**: `'Outfit', sans-serif` — Modern geometric sans with personality
- **Body**: `'Inter', system-ui, sans-serif` — Clean and readable
- **Monospace/Data**: `'JetBrains Mono', 'Fira Code', monospace` — For keys, IDs, technical data

### Spatial System
- Base unit: 4px
- Panel padding: 24px
- Section spacing: 64px (desktop), 40px (mobile)
- Border radius: 12px (panels), 8px (buttons), 4px (inputs)

### Motion Philosophy
- **Node pulses**: Subtle 3s infinite pulse animation on online nodes (like breathing)
- **Data flow**: Arc animations suggest packet movement (1.5s ease-out)
- **Panel transitions**: 200ms ease-out for hovers, 300ms for state changes
- **Map interactions**: Smooth 300ms zoom/pan transitions
- **Aurora shimmer**: Subtle CSS gradient animation on accent elements (8s cycle)

### Visual Assets
- **Icons**: Lucide React (consistent stroke weight)
- **Map tiles**: CARTO Dark Matter (`carto-dark`) — deep dark basemap
- **Decorative**: Subtle grid patterns, aurora gradient overlays, star-field subtle backgrounds

## Layout & Structure

### Pages

#### 1. Homepage (`/`)
- **Hero Section**: Full-viewport with animated aurora gradient background, NorthMesh logo, tagline "Connecting the North, One Node at a Time"
- **Stats Bar**: Live counters — Total Nodes, Active Links, Packets Today, Network Coverage
- **About Section**: What is MeshCore, how the network works
- **Live Preview**: Small embedded map showing current network state
- **Footer**: Links, Cloudflare tunnel info, attribution

#### 2. Live Map (`/map`)
- **Full-screen map** with floating overlay panels:
  - **Top-left**: Network selector, search
  - **Bottom-left**: Legend (node types, link states)
  - **Top-right**: Live stats (nodes online, packets/min)
  - **Bottom-right**: Node info panel (on selection)
- Map controls: zoom, fullscreen, layer toggles

#### 3. Network Info (`/network`)
- Detailed breakdown of network statistics
- Node list with filtering/sorting
- Link quality analysis

### Responsive Strategy
- Mobile: Stacked panels, bottom sheet for node details
- Tablet: Collapsible side panels
- Desktop: Floating panels with glass-morphism effect

## Features & Interactions

### Homepage
- **Live stats**: Animated counters that tick up/down with real data
- **Hero animation**: Subtle aurora gradient that shifts colors slowly
- **CTA buttons**: "View Live Map" with hover glow effect

### Live Map
- **Node rendering**: GPU-accelerated dots via MapLibre GeoJSON layer
- **Node states**:
  - Online: Pulsing glow animation
  - Offline/Stale (7+ days): Grayed out, no pulse
  - Role-colored: Repeater (cyan), ChatNode (amber), RoomServer (purple), Sensor (green)
- **Packet arcs**: deck.gl arc layer showing live packet flow (5s TTL)
- **Path history**: Purple line segments showing packet routes
- **Click interaction**: Click node → show info panel with details
- **Hover**: Tooltip with node name/role

### Node Info Panel
- Public key (truncated with copy button)
- Name, role, hardware model
- Last seen, uptime
- Advert count, packet statistics
- Link to detailed view

### Error States
- **WebSocket disconnect**: Yellow banner "Reconnecting to live data..."
- **MQTT offline**: Status indicator turns amber
- **No data**: Empty state with illustration "No nodes in network yet"

## Component Inventory

### Navigation
- Fixed top navbar with logo, nav links, live status indicator
- States: default, scrolled (adds backdrop blur), mobile (hamburger menu)

### StatCard
- Icon + value + label
- States: default, loading (skeleton pulse), error (muted with icon)

### NodeCard
- Compact node display for lists
- Shows: name, role badge, status dot, last seen
- States: default, hover (lift + glow), selected (accent border)

### Map Controls
- Floating button group
- States: default, hover, active (toggled)

### Panel
- Glass-morphism effect (`backdrop-filter: blur(12px)`)
- States: default, collapsed, loading

### Button
- Primary: Aurora gradient background
- Secondary: Transparent with border
- States: default, hover (glow), active (pressed), disabled (muted)

### StatusBadge
- Small pill with status color
- States: online (green pulse), offline (gray), error (red)

## Technical Approach

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Routing**: React Router v6
- **Map**: MapLibre GL JS + deck.gl overlays
- **State**: Zustand for global state
- **Styling**: CSS Modules + CSS custom properties
- **Icons**: Lucide React
- **Build**: Vite with optimized chunking

### Backend
- **Runtime**: Node.js + TypeScript
- **MQTT**: Eclipse Mosquitto client (`mqtt.js`)
- **WebSocket**: `ws` library with Redis pub/sub fan-out
- **API**: Express REST API
- **Database**: TimescaleDB (schema from ukmesh)

### MQTT Integration
- Subscribe to `meshcore/uk/north/#` for North region
- Compatible with existing ukmesh broker at `mqtt.meshcore.uk:8883`
- Support port 443 for Cloudflare Tunnel compatibility
- TLS required

### Infrastructure
- **Docker Compose**: Full stack orchestration
- **Cloudflare Tunnel**: `cloudflared` for public exposure on port 443
- **Nginx**: Reverse proxy for WebSocket and API
- **Environment**: `.env` for configuration

### API Endpoints
```
GET  /api/status          — Server status
GET  /api/nodes           — All nodes with last seen
GET  /api/nodes/:id       — Single node details
GET  /api/links           — Active links
GET  /api/stats           — Network statistics
WS   /ws                  — WebSocket for live updates
```

### Data Model
Nodes stored with: `public_key`, `name`, `role`, `lat`, `lon`, `elevation_m`, `hardware_model`, `last_seen`, `advert_count`

Packets stored with: `id`, `from_node`, `to_node`, `timestamp`, `lat`, `lon`, `channel`, `delay_ms`
