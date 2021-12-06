import { isNil } from 'ramda'

// Simple noop helper for express.
const halt = (req, res, next) => {}

// A helper to make it more concise to define the database middleware.
function json (dbFn) {
  return async function json (req, res, next) {
    try {
      const data = await dbFn({
        ...req.params,
        ...req.body
      })
      res.status(isNil(data) ? 201 : 200).json(data)
      next()
    } catch (e) {
      next(e)
    }
  }
}

export default function api ({ database, router }) {
  return router
    .get('/users/:id', json(database.selectUser))
    .delete('/users/:id', json(database.deleteUser))
    .post('/users', (req, res, next) => {
      req.body = { email: req.body }
      next()
    }, json(database.insertUser))

    .post('/events', json(database.insertEvent))

    .use(halt)
    .use((err, req, res, next) => {
      // Default error handler for this router.

      console.error(err) // Could disable when in production.

      if (err.constraint_name === 'user_email_idx' || Array.isArray(err)) {
        res.status(422)

        if (Array.isArray(err)) {
          res.json(err)
        } else {
          res.end()
        }

        return
      }

      if (err.constraint_name === 'consent_user_id_fkey') { return res.sendStatus(404) }

      if (err instanceof database.CountError) { return res.sendStatus(404) }

      // Sometimes errors have a status defined. If not, respond with 500.
      res.sendStatus(err.status || err.statusCode || 500)
    })
}
