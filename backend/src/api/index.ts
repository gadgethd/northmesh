import { Router } from 'express'

export const apiRouter = Router()

apiRouter.get('/status', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'NorthMesh Backend',
    version: '1.0.0',
    timestamp: Date.now(),
  })
})

apiRouter.get('/nodes', (_req, res) => {
  res.json({
    type: 'nodes',
    data: [],
    message: 'Node data is delivered via WebSocket',
  })
})

apiRouter.get('/stats', (_req, res) => {
  res.json({
    type: 'stats',
    data: {
      totalNodes: 0,
      onlineNodes: 0,
      packetsToday: 0,
      activeLinks: 0,
    },
  })
})
