import { Pool } from 'pg'

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function loadNodes(): Promise<Array<{
  node_id: string
  name: string
  lat?: number
  lon?: number
  role?: number
  firmware_version?: string
  hardware_model?: string
}>> {
  try {
    const result = await db.query(
      'SELECT node_id, name, lat, lon, role, firmware_version, hardware_model FROM nodes'
    )
    return result.rows
  } catch {
    return []
  }
}

export async function getNodeLocation(nodeId: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const result = await db.query<{ lat: number; lon: number }>(
      'SELECT lat, lon FROM nodes WHERE node_id = $1 AND lat IS NOT NULL AND lon IS NOT NULL',
      [nodeId]
    )
    return result.rows[0] ?? null
  } catch {
    return null
  }
}

export async function upsertNode(node: {
  node_id: string
  name: string
  role?: number
  lat?: number
  lon?: number
  firmware_version?: string
  hardware_model?: string
}): Promise<void> {
  try {
    await db.query(
      `INSERT INTO nodes (node_id, name, role, lat, lon, firmware_version, hardware_model, last_seen, is_online)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), TRUE)
       ON CONFLICT (node_id) DO UPDATE SET
         name = EXCLUDED.name,
         role = COALESCE(EXCLUDED.role, nodes.role),
         lat = CASE WHEN nodes.location_locked THEN nodes.lat ELSE COALESCE(EXCLUDED.lat, nodes.lat) END,
         lon = CASE WHEN nodes.location_locked THEN nodes.lon ELSE COALESCE(EXCLUDED.lon, nodes.lon) END,
         firmware_version = COALESCE(EXCLUDED.firmware_version, nodes.firmware_version),
         hardware_model = COALESCE(EXCLUDED.hardware_model, nodes.hardware_model),
         last_seen = NOW(),
         is_online = TRUE`,
      [node.node_id, node.name, node.role, node.lat ?? null, node.lon ?? null, node.firmware_version ?? null, node.hardware_model ?? null]
    )
  } catch {
    // non-fatal
  }
}
