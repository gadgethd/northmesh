import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { MQTTClient, MeshPacket, NodeStatus } from './mqtt/client.js'
import { WebSocketManager } from './ws/server.js'
import { apiRouter } from './api/index.js'

const PORT = parseInt(process.env.PORT || '3001', 10)

const app = express()
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : []
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }))
app.use(express.json())

app.use('/api', apiRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

const server = createServer(app)

const wss = new WebSocketServer({ server, path: '/ws' })
const wsManager = new WebSocketManager(wss, (send) => {
  send({
    type: 'init',
    data: {
      nodes: Array.from(nodes.values()),
      packets: packets.slice(-100),
      packets_24h: packets24h(),
    },
  })
})

const nodes = new Map<string, NodeStatus & { last_seen: number; is_online: boolean }>()
let packets: MeshPacket[] = []

const WINDOW_24H = 24 * 60 * 60 * 1000
let packetTimestamps: number[] = []

function packets24h(): number {
  const cutoff = Date.now() - WINDOW_24H
  const i = packetTimestamps.findIndex((ts) => ts > cutoff)
  if (i > 0) packetTimestamps = packetTimestamps.slice(i)
  else if (i === -1) packetTimestamps = []
  return packetTimestamps.length
}

const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'wss://mqtt.meshcore.uk:9001'

const mqtt = new MQTTClient({
  broker: mqttBrokerUrl,
  topics: ['meshcore/+/+/packets', 'meshcore/+/+/status', 'ukmesh/+/+/packets', 'ukmesh/+/+/status'],
})

mqtt.on('packet', (data) => {
  const packet = data as MeshPacket
  packets.push(packet)
  if (packets.length > 1000) packets = packets.slice(-500)
  packetTimestamps.push(packet.ts)
  wsManager.broadcast({ type: 'packet', data: packet })

  const existingNode = nodes.get(packet.rxNodeId)
  if (existingNode) {
    existingNode.last_seen = packet.ts
    existingNode.is_online = true
    wsManager.broadcast({ type: 'node_update', data: existingNode })
  }
})

mqtt.on('status', (data) => {
  const status = data as NodeStatus
  const now = Date.now()
  
  const existing = nodes.get(status.node_id)
  const isFirstSeen = !existing

  const node: NodeStatus & { last_seen: number; is_online: boolean } = {
    ...status,
    last_seen: now,
    is_online: true,
    lat: status.lat ?? existing?.lat,
    lon: status.lon ?? existing?.lon,
    role: status.role ?? existing?.role,
  }

  nodes.set(status.node_id, node)
  wsManager.broadcast({ type: 'node_update', data: node })

  if (isFirstSeen) {
    wsManager.broadcast({
      type: 'init',
      data: {
        nodes: Array.from(nodes.values()),
        packets: packets.slice(-100),
        packets_24h: packets24h(),
      },
    })
  }
})

mqtt.on('connect', () => {
  console.log('[MQTT] Connected to broker')
  wsManager.broadcast({
    type: 'init',
    data: {
      nodes: Array.from(nodes.values()),
      packets: packets.slice(-100),
      packets_24h: packets24h(),
    },
  })
})

mqtt.on('error', (err) => {
  console.error('[MQTT] Error:', (err as Error).message)
})

mqtt.connect()

setInterval(() => {
  const now = Date.now()
  nodes.forEach((node) => {
    if (now - node.last_seen > 300000) {
      if (node.is_online) {
        node.is_online = false
        wsManager.broadcast({ type: 'node_update', data: node })
      }
    }
  })
  wsManager.broadcast({ type: 'stats', data: { packets_today: packets24h() } })
}, 60000)

server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`)
  console.log(`[MQTT] Connecting to ${mqttBrokerUrl}`)
})

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...')
  mqtt.disconnect()
  wsManager.close()
  server.close()
})
