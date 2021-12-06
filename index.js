#!/usr/bin/env node

import api from './src/router/api.js'
import express from 'express'
import database from './src/database/index.js'

const app = express()

app.use('/api', api({
  router: express.Router().use(express.json({
    // Should always be a JSON request.
    type: () => true,
    // We disable strict because we want to support an email json string as body
    strict: false
  })),
  database
}))

const server = app.listen(
  process.env.PORT,
  '127.0.0.1',
  () => process.stdout.write(`Express server listening on port ${server.address().port}\n`))
