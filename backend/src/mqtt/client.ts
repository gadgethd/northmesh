import mqtt, { MqttClient, IClientOptions } from 'mqtt'
import { MeshCoreDecoder } from 'meshcore-decoder'
import type { AdvertPayload } from 'meshcore-decoder'

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

  private decodeAdvertPayloadOnly(rawHex: string): AdvertPayload | null {
    try {
      const payload = Buffer.from(rawHex, 'hex')
      if (payload.length < 101) return null

      const publicKey = payload.subarray(0, 32).toString('hex').toUpperCase()
      const flags = payload[100]
      const hasLocation = Boolean(flags & 0x10)
      const hasName = Boolean(flags & 0x80)
      let offset = 101

      const advert: AdvertPayload = {
        type: 4,
        version: 0,
        isValid: true,
        publicKey,
        timestamp: payload.readUInt32LE(32),
        signature: payload.subarray(36, 100).toString('hex').toUpperCase(),
        appData: {
          flags,
          deviceRole: flags & 0x0f,
          hasLocation,
          hasName,
        },
      }

      if (hasLocation && payload.length >= offset + 8) {
        advert.appData.location = {
          latitude: payload.readInt32LE(offset) / 1000000,
          longitude: payload.readInt32LE(offset + 4) / 1000000,
        }
        offset += 8
      }

      if (flags & 0x20) offset += 2
      if (flags & 0x40) offset += 2

      if (hasName && payload.length > offset) {
        advert.appData.name = payload.subarray(offset).toString('utf8').replace(/\0.*$/, '').trim() || undefined
      }

      return advert
    } catch {
      return null
    }
  }

  private decodeAdvert(rawHex: string): AdvertPayload | null {
    try {
      const result = MeshCoreDecoder.decode(rawHex)
      const decoded = result?.payload?.decoded as AdvertPayload | undefined
      if (decoded?.publicKey && decoded?.appData) return decoded
    } catch {
      // Fall through to payload-only decoding
    }

    return this.decodeAdvertPayloadOnly(rawHex)
  }

  private parsePacket(topic: string, payload: Buffer): { packet: MeshPacket } | null {
    try {
      const parts = topic.split('/')
      if (parts.length < 4) return null

      const data = JSON.parse(payload.toString())
      const inner = data.payload || data

      const rxNodeId: string = data.rx_node_id || parts[2]
      const srcNodeId: string = data.src_node_id || inner.origin_id || data.origin_id || ''
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

      const rawHex: string | undefined = inner.raw || data.raw_hex || data.raw
      if (rawHex) {
        advertPayload = this.decodeAdvert(rawHex)
        // Only use location if the advert belongs to the MQTT-publishing node (pubkey matches topic)
        if (
          advertPayload?.appData?.hasLocation &&
          advertPayload.appData.location &&
          advertPayload.publicKey.toUpperCase() === rxNodeId.toUpperCase()
        ) {
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

      return { packet }
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
