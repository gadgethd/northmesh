import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'

interface WSClient {
  ws: WebSocket
  id: string
  network?: string
  observer?: string
}

export class WebSocketManager {
  private wss: WebSocketServer
  private clients = new Map<string, WSClient>()
  private clientIdCounter = 0

  constructor(wss: WebSocketServer) {
    this.wss = wss
    this.setup()
  }

  private setup() {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = `client-${++this.clientIdCounter}`
      const url = new URL(req.url || '/', `http://${req.headers.host}`)
      const network = url.searchParams.get('network') || undefined
      const observer = url.searchParams.get('observer') || undefined

      const client: WSClient = { id: clientId, ws, network, observer }
      this.clients.set(clientId, client)

      console.log(`[WS] Client connected: ${clientId} (network: ${network || 'all'}, observer: ${observer || 'all'})`)

      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString())
          this.handleMessage(clientId, msg)
        } catch (e) {
          console.error(`[WS] Invalid message from ${clientId}:`, e)
        }
      })

      ws.on('close', () => {
        this.clients.delete(clientId)
        console.log(`[WS] Client disconnected: ${clientId}`)
      })

      ws.on('error', (err) => {
        console.error(`[WS] Error from ${clientId}:`, err.message)
      })

      this.send(clientId, {
        type: 'welcome',
        data: { clientId, networks: ['uk/north'] },
      })
    })
  }

  private handleMessage(clientId: string, msg: { type: string; data?: unknown }) {
    const client = this.clients.get(clientId)
    if (!client) return

    switch (msg.type) {
      case 'ping':
        this.send(clientId, { type: 'pong', data: Date.now() })
        break
      case 'subscribe':
        if (typeof msg.data === 'string') {
          client.network = msg.data
        }
        break
      default:
        console.log(`[WS] Unknown message type from ${clientId}:`, msg.type)
    }
  }

  send(clientId: string, message: { type: string; data?: unknown }) {
    const client = this.clients.get(clientId)
    if (!client || client.ws.readyState !== WebSocket.OPEN) return

    try {
      client.ws.send(JSON.stringify(message))
    } catch (e) {
      console.error(`[WS] Failed to send to ${clientId}:`, e)
    }
  }

  broadcast(message: { type: string; data?: unknown }, filter?: (client: WSClient) => boolean) {
    const payload = JSON.stringify(message)

    this.clients.forEach((client) => {
      if (client.ws.readyState !== WebSocket.OPEN) return
      if (filter && !filter(client)) return

      try {
        client.ws.send(payload)
      } catch (e) {
        console.error(`[WS] Broadcast error to ${client.id}:`, e)
      }
    })
  }

  broadcastExcept(clientId: string, message: { type: string; data?: unknown }) {
    const payload = JSON.stringify(message)

    this.clients.forEach((client) => {
      if (client.id === clientId) return
      if (client.ws.readyState !== WebSocket.OPEN) return

      try {
        client.ws.send(payload)
      } catch (e) {
        console.error(`[WS] Broadcast error to ${client.id}:`, e)
      }
    })
  }

  close() {
    this.clients.forEach((client) => {
      client.ws.close()
    })
    this.clients.clear()
    this.wss.close()
  }

  getClientCount(): number {
    return this.clients.size
  }
}
