import { useEffect, useRef, useCallback } from 'react'
import { useNodeStore, Node, Packet } from './useNodes'

const WS_URL = import.meta.env.PROD
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
  : 'ws://localhost:3001/ws'

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000]

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimeoutRef = useRef<number | null>(null)

  const { setNodes, setPackets, updateNode, addPacket, setConnected } = useNodeStore()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      console.log('[WS] Connected')
      reconnectAttemptRef.current = 0
      setConnected(true)
    }

    ws.onclose = () => {
      console.log('[WS] Disconnected')
      setConnected(false)
      wsRef.current = null

      const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)]
      reconnectAttemptRef.current++
      console.log(`[WS] Reconnecting in ${delay}ms...`)
      reconnectTimeoutRef.current = window.setTimeout(connect, delay)
    }

    ws.onerror = (error) => {
      console.error('[WS] Error:', error)
    }

    ws.onmessage = (event) => {
      try {
        const messages = event.data.split('\n').filter(Boolean)
        for (const raw of messages) {
          const msg = JSON.parse(raw)
          handleMessage(msg)
        }
      } catch (e) {
        console.error('[WS] Failed to parse message:', e)
      }
    }

    wsRef.current = ws
  }, [setConnected])

  const handleMessage = useCallback((msg: { type: string; data: unknown }) => {
    switch (msg.type) {
      case 'init': {
        const data = msg.data as { nodes: Node[]; packets: Packet[]; packets_24h?: number }
        setNodes(data.nodes)
        setPackets(data.packets)
        if (data.packets_24h !== undefined) {
          useNodeStore.getState().updateStats({ packetsToday: data.packets_24h })
        }
        break
      }
      case 'node_update': {
        const node = msg.data as Node
        updateNode(node)
        break
      }
      case 'packet': {
        const packet = msg.data as Packet
        addPacket(packet)
        break
      }
      case 'stats': {
        const stats = msg.data as { packets_today: number }
        useNodeStore.getState().updateStats({ packetsToday: stats.packets_today })
        break
      }
    }
  }, [setNodes, setPackets, updateNode, addPacket])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      wsRef.current?.close()
    }
  }, [connect])

  return { isConnected: useNodeStore((s) => s.isConnected) }
}
