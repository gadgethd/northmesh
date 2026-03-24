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

      const observerKey = parts[2]
      const data = JSON.parse(payload.toString())
      
      const packetHash = data.hash || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const key = `${packetHash}-${observerKey}`
      const now = Date.now()

      if (this.seenPackets.has(key)) {
        const lastSeen = this.seenPackets.get(key)!
        if (now - lastSeen < 120000) {
          return null
        }
      }
      this.seenPackets.set(key, now)

      let lat: number | undefined
      let lon: number | undefined
      let advertPayload: AdvertPayload | null = null

      if (data.raw && parseInt(data.packet_type) === 4) {
        advertPayload = this.parseAdvertPayload(data.raw)
        if (advertPayload?.appData?.location) {
          lat = advertPayload.appData.location.latitude
          lon = advertPayload.appData.location.longitude
        }
      }

      const packet: MeshPacket = {
        id: `${observerKey}-${data.timestamp || now}-${Math.random().toString(36).slice(2, 8)}`,
        packetHash,
        rxNodeId: observerKey,
        srcNodeId: data.origin_id || advertPayload?.publicKey || '',
        topic,
        packetType: parseInt(data.packet_type) || 0,
        routeType: parseInt(data.route) || 0,
        hopCount: (data.path ? data.path.length : 0),
        rssi: parseFloat(data.rssi) || 0,
        snr: parseFloat(data.snr) || 0,
        direction: data.direction === 'rx' ? 'rx' : 'tx',
        summary: data.origin || '',
        payload: data,
        path: data.path,
        advertCount: data.advert_count ? parseInt(data.advert_count) : undefined,
        ts: data.timestamp ? parseInt(data.timestamp) * 1000 : now,
        lat,
        lon,
      }

      let nodeUpdate: NodeStatus | undefined
      if (advertPayload) {
        nodeUpdate = {
          node_id: advertPayload.publicKey,
          name: advertPayload.appData.name,
          role: advertPayload.appData.deviceRole,
          lat: advertPayload.appData.location.latitude,
          lon: advertPayload.appData.location.longitude,
        }
      } else if (data.origin && data.origin_id) {
        nodeUpdate = {
          node_id: data.origin_id,
          name: data.origin,
          lat: lat,
          lon: lon,
        }
      }

      return { packet, nodeUpdate }
    } catch {
      return null
    }
  }

  private parseStatus(topic: string, payload: Buffer): NodeStatus | null {
    try {
      const parts = topic.split('/')
      if (parts.length < 4) return null

      const data = JSON.parse(payload.toString())

      const key = `${data.origin_id}-${data.origin}`
      const now = Date.now()
      const lastSeen = this.seenAdverts.get(key)

      if (lastSeen && now - lastSeen < 60000) {
        return null
      }
      this.seenAdverts.set(key, now)

      const lat = data.lat ?? data.latitude ?? undefined
      const lon = data.lon ?? data.longitude ?? undefined

      return {
        node_id: data.origin_id,
        name: data.origin || 'Unknown',
        model: data.model || '',
        firmware_version: data.firmware_version || '',
        radio: data.radio || '',
        client_version: data.client_version || '',
        stats: data.stats,
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
      console.log(`[MQTT] ${topic}`, payload.toString().slice(0, 200))
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
