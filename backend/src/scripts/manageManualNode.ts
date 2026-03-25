import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { db } from '../db/client.js'

type ManagedNode = {
  node_id: string
  name: string | null
  lat: number | null
  lon: number | null
  role: number | null
  hardware_model: string | null
  firmware_version: string | null
  public_key: string | null
  elevation_m: number | null
  network: string
  is_online: boolean
}

const rl = createInterface({ input, output })

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function loadEnvIfNeeded(): void {
  if (process.env.DATABASE_URL) return

  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '..', '.env'),
  ]

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue

    const content = readFileSync(filePath, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed
      const separatorIndex = normalized.indexOf('=')
      if (separatorIndex <= 0) continue

      const key = normalized.slice(0, separatorIndex).trim()
      const value = stripQuotes(normalized.slice(separatorIndex + 1).trim())

      if (!process.env[key]) {
        process.env[key] = value
      }
    }

    if (process.env.DATABASE_URL) return
  }

  if (
    !process.env.DATABASE_URL &&
    process.env.POSTGRES_USER &&
    process.env.POSTGRES_PASSWORD &&
    process.env.POSTGRES_DB
  ) {
    const host = process.env.POSTGRES_HOST || 'localhost'
    const user = encodeURIComponent(process.env.POSTGRES_USER)
    const password = encodeURIComponent(process.env.POSTGRES_PASSWORD)
    const database = encodeURIComponent(process.env.POSTGRES_DB)
    process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:5432/${database}`
  }
}

async function ask(question: string): Promise<string> {
  return (await rl.question(question)).trim()
}

async function askRequired(question: string, validate?: (value: string) => string | null): Promise<string> {
  while (true) {
    const value = await ask(question)
    if (!value) {
      console.log('A value is required.')
      continue
    }

    const error = validate?.(value) ?? null
    if (error) {
      console.log(error)
      continue
    }

    return value
  }
}

async function askWithDefault(question: string, defaultValue: string): Promise<string> {
  const value = await ask(`${question} [${defaultValue}]: `)
  return value || defaultValue
}

async function askTextWithDefault(question: string, defaultValue: string | null): Promise<string | null> {
  if (defaultValue === null) return askOptional(question)
  return askWithDefault(question, defaultValue)
}

async function askOptional(question: string): Promise<string | null> {
  const value = await ask(question)
  return value || null
}

async function askOptionalNumber(
  question: string,
  validate?: (value: number) => string | null
): Promise<number | null> {
  while (true) {
    const value = await ask(question)
    if (!value) return null

    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      console.log('Enter a valid number or leave it blank.')
      continue
    }

    const error = validate?.(parsed) ?? null
    if (error) {
      console.log(error)
      continue
    }

    return parsed
  }
}

async function askRequiredNumber(
  question: string,
  validate?: (value: number) => string | null
): Promise<number> {
  while (true) {
    const value = await ask(question)
    if (!value) {
      console.log('A value is required.')
      continue
    }

    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      console.log('Enter a valid number.')
      continue
    }

    const error = validate?.(parsed) ?? null
    if (error) {
      console.log(error)
      continue
    }

    return parsed
  }
}

async function askNumberWithDefault(
  question: string,
  defaultValue: number,
  validate?: (value: number) => string | null
): Promise<number> {
  while (true) {
    const value = await ask(`${question} [${defaultValue}]: `)
    if (!value) return defaultValue

    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      console.log('Enter a valid number.')
      continue
    }

    const error = validate?.(parsed) ?? null
    if (error) {
      console.log(error)
      continue
    }

    return parsed
  }
}

async function askYesNo(question: string, defaultValue = true): Promise<boolean> {
  const suffix = defaultValue ? ' [Y/n]: ' : ' [y/N]: '

  while (true) {
    const value = (await ask(question + suffix)).toLowerCase()
    if (!value) return defaultValue
    if (value === 'y' || value === 'yes') return true
    if (value === 'n' || value === 'no') return false
    console.log('Enter y or n.')
  }
}

async function chooseAction(): Promise<'add' | 'remove' | 'cancel'> {
  while (true) {
    const value = await ask('Choose an action: [1] add repeater, [2] remove node, [3] cancel: ')
    if (value === '1' || value.toLowerCase() === 'add') return 'add'
    if (value === '2' || value.toLowerCase() === 'remove') return 'remove'
    if (value === '3' || value.toLowerCase() === 'cancel') return 'cancel'
    console.log('Choose 1, 2, or 3.')
  }
}

async function findNode(nodeId: string): Promise<ManagedNode | null> {
  const result = await db.query<ManagedNode>(
    `SELECT node_id, name, lat, lon, role, hardware_model, firmware_version, public_key, elevation_m, network, is_online
     FROM nodes
     WHERE node_id = $1`,
    [nodeId]
  )

  return result.rows[0] ?? null
}

async function upsertManualNode(node: ManagedNode): Promise<void> {
  await db.query(
    `INSERT INTO nodes (
      node_id, name, lat, lon, role, last_seen, is_online, hardware_model,
      firmware_version, public_key, elevation_m, network, created_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10, $11, NOW())
    ON CONFLICT (node_id) DO UPDATE SET
      name = EXCLUDED.name,
      lat = EXCLUDED.lat,
      lon = EXCLUDED.lon,
      role = EXCLUDED.role,
      is_online = EXCLUDED.is_online,
      hardware_model = EXCLUDED.hardware_model,
      firmware_version = EXCLUDED.firmware_version,
      public_key = EXCLUDED.public_key,
      elevation_m = EXCLUDED.elevation_m,
      network = EXCLUDED.network`,
    [
      node.node_id,
      node.name,
      node.lat,
      node.lon,
      node.role,
      node.is_online,
      node.hardware_model,
      node.firmware_version,
      node.public_key,
      node.elevation_m,
      node.network,
    ]
  )
}

async function removeNode(nodeId: string): Promise<boolean> {
  const result = await db.query('DELETE FROM nodes WHERE node_id = $1', [nodeId])
  return (result.rowCount ?? 0) > 0
}

function printNodeSummary(node: ManagedNode): void {
  console.log('')
  console.log('Node summary')
  console.log(`  node_id: ${node.node_id}`)
  console.log(`  name: ${node.name ?? ''}`)
  console.log(`  lat: ${node.lat ?? ''}`)
  console.log(`  lon: ${node.lon ?? ''}`)
  console.log(`  role: ${node.role ?? ''}`)
  console.log(`  hardware_model: ${node.hardware_model ?? ''}`)
  console.log(`  firmware_version: ${node.firmware_version ?? ''}`)
  console.log(`  public_key: ${node.public_key ?? ''}`)
  console.log(`  elevation_m: ${node.elevation_m ?? ''}`)
  console.log(`  network: ${node.network}`)
  console.log(`  is_online: ${node.is_online}`)
  console.log('')
}

async function handleAdd(): Promise<void> {
  console.log('')
  console.log('Add or update a repeater that is not publishing to MQTT.')
  console.log('')

  const nodeId = await askRequired('Node ID / public key: ', (value) =>
    /\s/.test(value) ? 'Whitespace is not allowed.' : null
  )
  const existing = await findNode(nodeId)

  if (existing) {
    console.log('')
    console.log(`Node ${nodeId} already exists and will be updated.`)
    printNodeSummary(existing)
  }

  const name = (await askTextWithDefault('Display name: ', existing?.name ?? null)) ?? nodeId
  const lat = existing?.lat === null || existing?.lat === undefined
    ? await askRequiredNumber('Latitude: ', (value) =>
        value < -90 || value > 90 ? 'Latitude must be between -90 and 90.' : null
      )
    : await askNumberWithDefault('Latitude', existing.lat, (value) =>
        value < -90 || value > 90 ? 'Latitude must be between -90 and 90.' : null
      )
  const lon = existing?.lon === null || existing?.lon === undefined
    ? await askRequiredNumber('Longitude: ', (value) =>
        value < -180 || value > 180 ? 'Longitude must be between -180 and 180.' : null
      )
    : await askNumberWithDefault('Longitude', existing.lon, (value) =>
        value < -180 || value > 180 ? 'Longitude must be between -180 and 180.' : null
      )
  const role = existing?.role === null || existing?.role === undefined
    ? await askNumberWithDefault('Role', 2, (value) =>
        Number.isInteger(value) ? null : 'Role must be an integer.'
      )
    : await askNumberWithDefault('Role', existing.role, (value) =>
        Number.isInteger(value) ? null : 'Role must be an integer.'
      )
  const hardwareModel = await askTextWithDefault('Hardware model (optional): ', existing?.hardware_model ?? null)
  const firmwareVersion = await askTextWithDefault('Firmware version (optional): ', existing?.firmware_version ?? null)
  const publicKey = await askWithDefault('Public key', existing?.public_key ?? nodeId)
  const elevation = existing?.elevation_m === null || existing?.elevation_m === undefined
    ? await askOptionalNumber('Elevation in meters (optional): ')
    : await askOptionalNumber(`Elevation in meters (optional) [current ${existing.elevation_m}, blank to clear]: `)
  const network = await askWithDefault('Network', existing?.network ?? 'uk/north')
  const isOnline = await askYesNo('Mark this node as currently online?', existing?.is_online ?? false)

  const node: ManagedNode = {
    node_id: nodeId,
    name,
    lat,
    lon,
    role,
    hardware_model: hardwareModel,
    firmware_version: firmwareVersion,
    public_key: publicKey,
    elevation_m: elevation,
    network,
    is_online: isOnline,
  }

  printNodeSummary(node)

  if (!(await askYesNo(existing ? 'Update this node?' : 'Create this node?'))) {
    console.log('Cancelled.')
    return
  }

  await upsertManualNode(node)
  console.log(existing ? 'Node updated.' : 'Node created.')
}

async function handleRemove(): Promise<void> {
  console.log('')
  console.log('Remove a node from the database.')
  console.log('')

  const nodeId = await askRequired('Node ID to remove: ')
  const existing = await findNode(nodeId)

  if (!existing) {
    console.log(`No node found for ${nodeId}.`)
    return
  }

  printNodeSummary(existing)

  if (!(await askYesNo('Delete this node?', false))) {
    console.log('Cancelled.')
    return
  }

  const removed = await removeNode(nodeId)
  console.log(removed ? 'Node removed.' : 'No node removed.')
}

async function main(): Promise<void> {
  loadEnvIfNeeded()

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.')
  }

  console.log('NorthMesh manual node manager')
  console.log('')

  const action = await chooseAction()
  if (action === 'cancel') {
    console.log('Cancelled.')
    return
  }

  if (action === 'add') {
    await handleAdd()
    return
  }

  await handleRemove()
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Failed: ${message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    rl.close()
    await db.end().catch(() => {})
  })
