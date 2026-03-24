# NorthMesh Documentation

## Overview

NorthMesh is a real-time visualization platform for the MeshCore mesh network in northern UK.

## Architecture

```
                    ┌──────────────┐
                    │    MQTT      │
                    │   Broker     │
                    └──────┬───────┘
                           │ MQTT (TLS :8883)
                           ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │◀───│   Backend    │───▶│    Redis     │
│  (React)     │◀───│ (Node.js)    │     │   (Future)   │
└──────────────┘    └──────────────┘     └──────────────┘
      │                   │
      │ WebSocket         │ WebSocket
      ▼                   ▼
┌──────────────────────────────────────┐
│           Nginx / Cloudflare         │
│         (Reverse Proxy + TLS)         │
└──────────────────────────────────────┘
```

## Components

### Frontend

- **React 18** - UI framework
- **MapLibre GL** - Map rendering
- **deck.gl** - Data visualization (arcs, paths)
- **Zustand** - State management
- **React Router** - Client-side routing

### Backend

- **Node.js** - Runtime
- **Express** - HTTP API
- **ws** - WebSocket server
- **mqtt.js** - MQTT client

## MQTT Message Format

### Packet Message (topic: `meshcore/uk/north/<node>/packets`)

```json
{
  "raw": "<hex string>",
  "hash": "<packet hash>",
  "packet_type": 4,
  "SNR": "-8.5",
  "RSSI": "-72",
  "direction": "rx",
  "origin": "NodeName",
  "origin_id": "<public key>",
  "timestamp": "1234567890"
}
```

### Status Message (topic: `meshcore/uk/north/<node>/status`)

```json
{
  "origin": "NodeName",
  "origin_id": "<public key>",
  "model": "T-Beam",
  "firmware_version": "1.0.0",
  "radio": "LoRa",
  "client_version": "1.0.0",
  "stats": {
    "battery_mv": 4200,
    "uptime_secs": 86400
  }
}
```

## Database Schema

See [schema.sql](../backend/src/db/schema.sql) for the TimescaleDB schema.

### Key Tables

- `nodes` - Device registry
- `packets` - Time-series packet data (hypertable)
- `node_status_samples` - Telemetry data
- `node_links` - RF links between nodes

## API Endpoints

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Server status |
| GET | `/api/nodes` | List all nodes |
| GET | `/api/stats` | Network statistics |

### WebSocket

Connect to `/ws` for real-time updates.

#### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `init` | Server→Client | Initial state on connect |
| `node_update` | Server→Client | Node status changed |
| `packet` | Server→Client | New packet received |
| `links` | Server→Client | Link update |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MQTT_BROKER` | mqtt.meshcore.uk | MQTT broker host |
| `MQTT_PORT` | 8883 | MQTT broker port |
| `MQTT_TLS` | true | Use TLS for MQTT |
| `PORT` | 3001 | Backend HTTP port |

## Deployment

See [README.md](../README.md) for deployment instructions.

## Development

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup.
