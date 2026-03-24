# NorthMesh

Real-time mesh network visualization platform for northern UK, powered by [MeshCore](https://meshcore.uk).

![NorthMesh](https://img.shields.io/badge/Status-Beta-blue)
![License](https://img.shields.io/badge/License-MIT-green)

An arctic-themed, real-time visualization of the MeshCore mesh network. Watch nodes appear on the map, track packet flow, and monitor network health.

## Features

- **Live Map** - Real-time node positions on an interactive map using MapLibre GL
- **Packet Visualization** - deck.gl powered arc visualization for live packet flow
- **Node Status** - Online/offline monitoring with role-based coloring
- **Network Dashboard** - Detailed statistics and node management
- **MQTT Integration** - Subscribes to MeshCore MQTT topics
- **Cloudflare Tunnel** - Production-ready with port 443 support

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for production)
- MQTT broker (or use the default `mqtt.meshcore.uk`)

### Local Development

```bash
# Clone the repository
git clone https://github.com/gadgethd/northmesh.git
cd northmesh

# Install frontend dependencies
cd frontend && npm install

# Install backend dependencies
cd ../backend && npm install

# Start frontend
cd ../frontend && npm run dev

# Start backend (in a new terminal)
cd ../backend && npm run dev
```

Visit http://localhost:3000

### Docker Deployment

```bash
# Clone the repository
git clone https://github.com/gadgethd/northmesh.git
cd northmesh

# Run setup script
./setup.sh
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MQTT_BROKER` | MQTT broker hostname | `mqtt.meshcore.uk` |
| `MQTT_PORT` | MQTT broker port | `8883` |
| `MQTT_TLS` | Use TLS for MQTT | `true` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel token | (none) |
| `HOST` | Hostname for WebSocket URL | `northmesh.co.uk` |

### MQTT Topics

```
meshcore/uk/north/<node-id>/packets
meshcore/uk/north/<node-id>/status
ukmesh/uk/north/<node-id>/packets
ukmesh/uk/north/<node-id>/status
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   MQTT Broker   │────▶│    Backend      │────▶│   Frontend      │
│ (mqtt.meshcore) │     │  (Node.js/WS)  │     │  (React/Vite)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Cloudflare    │
                        │  Tunnel :443   │
                        └─────────────────┘
```

### Frontend Stack

- React 18 + TypeScript
- Vite (build tool)
- MapLibre GL (maps)
- deck.gl (data visualization)
- Zustand (state management)
- React Router

### Backend Stack

- Node.js + TypeScript
- Express (HTTP API)
- ws (WebSocket server)
- mqtt.js (MQTT client)

### Infrastructure

- Docker + Docker Compose
- Nginx (reverse proxy)
- Cloudflare Tunnel (public exposure)

## Development

### Project Structure

```
northmesh/
├── frontend/           # React frontend
│   ├── src/
│   │   ├── pages/     # Route pages
│   │   ├── components/# Reusable components
│   │   ├── hooks/     # Custom hooks
│   │   └── styles/    # Global styles
│   └── public/        # Static assets
├── backend/            # Node.js backend
│   └── src/
│       ├── mqtt/      # MQTT client
│       ├── ws/        # WebSocket server
│       └── api/       # REST endpoints
├── docs/               # Documentation
├── docker-compose.yml  # Docker orchestration
├── nginx.conf          # Nginx configuration
└── setup.sh           # Setup script
```

### Building

```bash
# Frontend
cd frontend && npm run build

# Backend
cd backend && npm run build
```

### Testing

```bash
# Frontend lint
cd frontend && npm run lint

# Backend lint
cd backend && npm run lint
```

## Cloudflare Tunnel Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain > Networks > Tunnels
3. Create a new tunnel (Cloudflared)
4. Name it `northmesh`
5. Add hostname: `northmesh.co.uk` → `https://nginx:443`
6. Copy the tunnel token
7. Add to `.env`: `CLOUDFLARE_TUNNEL_TOKEN=your-token`
8. Run `docker compose up -d`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [ukmesh](https://github.com/gadgethd/ukmesh) - Inspiration and MQTT/DB schema reference
- [MeshCore](https://meshcore.uk) - The mesh networking protocol
- [Cloudflare](https://cloudflare.com) - Tunnel infrastructure

## Links

- [Website](https://northmesh.co.uk)
- [Documentation](docs/)
- [Issue Tracker](https://github.com/gadgethd/northmesh/issues)
