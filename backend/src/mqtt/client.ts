import mqtt, { MqttClient, IClientOptions } from 'mqtt'

export interface MeshPacket {
  id: string
  packetHash: string
  rxNodeId: string
  srcNodeId: string
  topic: string
  packetType: number
  routeType: number
  hopCount: number
  rssi: number
  snr: number
  direction: 'rx' | 'tx'
  summary: string
  payload?: Record<string, unknown>
  path?: string[]
  advertCount?: number
  ts: number
  lat?: number
  lon?: number
}

export interface NodeStatus {
  node_id: string
  name: string
  model?: string
  firmware_version?: string
  radio?: string
  client_version?: string
  stats?: {
    battery_mv?: number
    uptime_secs?: number
    uptime_ms?: number
    tx_air_secs?: number
    rx_air_secs?: number
    channel_utilization?: number
    channel_utilization_pct?: number
    air_util_tx?: number
    air_util_tx_pct?: number
  }
  lat?: number
  lon?: number
  role?: number
}

export interface AdvertPayload {
  type: number
  publicKey: string
  appData: {
    name: string
    deviceRole: number
    location: {
      latitude: number
      longitude: number
    }
    flags: number
  }
}

interface MQTTClientOptions {
  broker: string
  topics: string[]
}

export class MQTTClient {
  private client: MqttClient | null = null
  private broker: string
  private topics: string[]
  private seenPackets = new Map<string, number>()
  private seenAdverts = new Map<string, number>()

  constructor(options: MQTTClientOptions) {
    this.broker = options.broker
    this.topics = options.topics
  }

  private parseAdvertPayload(raw: string): AdvertPayload | null {
    try {
      const decoded = Buffer.from(raw, 'hex').toString('utf8')
      return JSON.parse(decoded)
    } catch {
      return null
    }
  }

  private parsePacket(topic: string, payload: Buffer): { packet: MeshPacket; nodeUpdate?: NodeStatus } | null {
    try {
      const parts = topic.split('/')
      if (parts.length < 4) return null

      const data = JSON.parse(payload.toString())
      const inner = data.payload || {}

      const rxNodeId: string = data.rx_node_id || parts[2]
      const srcNodeId: string = data.src_node_id || inner.origin_id || ''
      const packetHash: string = data.packet_hash || data.hash || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const packetType: number = parseInt(data.packet_type) || 0
      const now = Date.now()

      const key = `${packetHash}-${rxNodeId}`
      if (this.seenPackets.has(key)) {
        if (now - this.seenPackets.get(key)! < 120000) return null
      }
      this.seenPackets.set(key, now)

      // Timestamp: inner payload has ISO string, fall back to now
      const ts = inner.timestamp ? new Date(inner.timestamp).getTime() : now

      // Parse advert binary for location — raw bytes are in inner.raw or data.raw_hex
      let lat: number | undefined
      let lon: number | undefined
      let advertPayload: AdvertPayload | null = null

      const rawHex: string | undefined = inner.raw || data.raw_hex
      if (rawHex) {
        advertPayload = this.parseAdvertPayload(rawHex)
        if (advertPayload?.appData?.location) {
          lat = advertPayload.appData.location.latitude
          lon = advertPayload.appData.location.longitude
        }
      }

      const packet: MeshPacket = {
        id: `${rxNodeId}-${ts}-${Math.random().toString(36).slice(2, 8)}`,
        packetHash,
        rxNodeId,
        srcNodeId,
        topic,
        packetType,
        routeType: data.route_type ?? 0,
        hopCount: data.hop_count ?? 0,
        rssi: data.rssi ?? 0,
        snr: data.snr ?? 0,
        direction: inner.direction === 'rx' ? 'rx' : 'tx',
        summary: inner.origin || srcNodeId.slice(0, 8),
        payload: data,
        path: data.path_hashes ?? [],
        advertCount: data.advert_count ?? undefined,
        ts,
        lat,
        lon,
      }

      // Build node update: self-advert is when src === rx (the repeater is advertising itself)
      let nodeUpdate: NodeStatus | undefined
      if (advertPayload) {
        nodeUpdate = {
          node_id: advertPayload.publicKey,
          name: advertPayload.appData.name,
          role: advertPayload.appData.deviceRole,
          lat,
          lon,
        }
      } else if (rxNodeId && rxNodeId === srcNodeId) {
        // Self-advert: the observer IS the source — this is the repeater's own beacon
        nodeUpdate = {
          node_id: rxNodeId,
          name: inner.origin || rxNodeId.slice(0, 8),
          role: 2,
          lat,
          lon,
        }
        console.log(`[MQTT] Self-advert from ${inner.origin || rxNodeId} raw: ${rawHex?.slice(0, 60)}`)
      } else if (inner.origin_id) {
        nodeUpdate = {
          node_id: inner.origin_id,
          name: inner.origin || inner.origin_id.slice(0, 8),
          lat,
          lon,
        }
      }

      return { packet, nodeUpdate }
    } catch (e) {
      console.error('[MQTT] parsePacket error:', e)
      return null
    }
  }

  private parseStatus(topic: string, payload: Buffer): NodeStatus | null {
    try {
      const parts = topic.split('/')
      if (parts.length < 4) return null

      const data = JSON.parse(payload.toString())
      // Status may have data at top level or nested under payload
      const inner = data.payload || data

      console.log(`[MQTT] Status keys: ${Object.keys(data).join(', ')} | inner keys: ${Object.keys(inner).join(', ')}`)

      const nodeId = inner.origin_id || data.rx_node_id || parts[2]
      const name = inner.origin || inner.name || 'Unknown'

      const key = `${nodeId}-${name}`
      const now = Date.now()
      if (this.seenAdverts.has(key) && now - this.seenAdverts.get(key)! < 60000) return null
      this.seenAdverts.set(key, now)

      const lat = inner.lat ?? inner.latitude ?? inner.location?.lat ?? inner.location?.latitude ?? undefined
      const lon = inner.lon ?? inner.longitude ?? inner.location?.lon ?? inner.location?.longitude ?? undefined

      return {
        node_id: nodeId,
        name,
        model: inner.model || '',
        firmware_version: inner.firmware_version || '',
        radio: inner.radio || '',
        client_version: inner.client_version || '',
        stats: inner.stats,
        role: 2,
        lat: typeof lat === 'number' ? lat : undefined,
        lon: typeof lon === 'number' ? lon : undefined,
      }
    } catch {
      return null
    }
  }

  connect() {
    const options: IClientOptions = {
      clientId: `northmesh-${Math.random().toString(36).slice(2, 10)}`,
      keepalive: 60,
      reconnectPeriod: 5000,
      username: process.env.MQTT_USERNAME || 'backend',
      password: process.env.MQTT_PASSWORD,
    }

    this.client = mqtt.connect(this.broker, options)

    this.client.on('connect', () => {
      console.log('[MQTT] Connected')
      this.emit('connect')
      this.topics.forEach((topic) => {
        this.client?.subscribe(topic, { qos: 0 }, (err) => {
          if (err) {
            console.error(`[MQTT] Subscribe error to ${topic}:`, err.message)
          } else {
            console.log(`[MQTT] Subscribed to ${topic}`)
          }
        })
      })
    })

    this.client.on('message', (topic, payload) => {
      try {
        const parsed = JSON.parse(payload.toString())
        console.log(`[MQTT] ${topic}`, JSON.stringify(parsed).slice(0, 300))
      } catch {
        console.log(`[MQTT] ${topic} (raw)`, payload.toString().slice(0, 200))
      }
      if (topic.endsWith('/packets')) {
        const result = this.parsePacket(topic, payload)
        if (result) {
          this.emit('packet', result.packet)
          if (result.nodeUpdate) {
            this.emit('status', result.nodeUpdate)
          }
        }
      } else if (topic.endsWith('/status')) {
        const status = this.parseStatus(topic, payload)
        if (status) {
          this.emit('status', status)
        }
      }
    })

    this.client.on('error', (err) => {
      console.error('[MQTT] Error:', err.message)
      this.emit('error', err)
    })

    this.client.on('close', () => {
      console.log('[MQTT] Connection closed')
      this.emit('close')
    })

    this.client.on('reconnect', () => {
      console.log('[MQTT] Reconnecting...')
    })
  }

  disconnect() {
    this.client?.end()
  }

  private listeners: Map<string, Set<(data: unknown) => void>> = new Map()

  on(event: string, callback: (data: unknown) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  emit(event: string, data?: unknown) {
    this.listeners.get(event)?.forEach((cb) => cb(data))
  }
}
