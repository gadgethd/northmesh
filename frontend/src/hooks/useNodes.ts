import { create } from 'zustand'

export interface Node {
  node_id: string
  name: string
  model?: string
  firmware_version?: string
  radio?: string
  client_version?: string
  role?: number
  lat?: number
  lon?: number
  last_seen: number
  is_online: boolean
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
}

export interface Packet {
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

interface NodeStore {
  nodes: Map<string, Node>
  packets: Packet[]
  stats: {
    totalNodes: number
    onlineNodes: number
    packetsToday: number
    activeLinks: number
  }
  isConnected: boolean
  setNodes: (nodes: Node[]) => void
  updateNode: (node: Node) => void
  addPacket: (packet: Packet) => void
  setPackets: (packets: Packet[]) => void
  updateStats: (stats: Partial<NodeStore['stats']>) => void
  setConnected: (connected: boolean) => void
}

export const useNodeStore = create<NodeStore>((set) => ({
  nodes: new Map(),
  packets: [],
  stats: {
    totalNodes: 0,
    onlineNodes: 0,
    packetsToday: 0,
    activeLinks: 0,
  },
  isConnected: false,

  setNodes: (nodes) =>
    set({
      nodes: new Map(nodes.map((n) => [n.node_id, n])),
      stats: {
        ...useNodeStore.getState().stats,
        totalNodes: nodes.length,
        onlineNodes: nodes.filter((n) => n.is_online).length,
      },
    }),

  updateNode: (node) =>
    set((state) => {
      const newNodes = new Map(state.nodes)
      newNodes.set(node.node_id, node)
      return {
        nodes: newNodes,
        stats: {
          ...state.stats,
          totalNodes: newNodes.size,
          onlineNodes: Array.from(newNodes.values()).filter((n) => n.is_online).length,
        },
      }
    }),

  addPacket: (packet) =>
    set((state) => ({
      packets: [...state.packets.slice(-499), packet],
      stats: {
        ...state.stats,
        packetsToday: state.stats.packetsToday + 1,
      },
    })),

  setPackets: (packets) => set({ packets: packets.slice(-500) }),

  updateStats: (newStats) =>
    set((state) => ({
      stats: { ...state.stats, ...newStats },
    })),

  setConnected: (connected) => set({ isConnected: connected }),
}))
