import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import schema from '../schema/index.js'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, {
  debug: console.log.bind(console), // Could disable when in production.
  ssl: { rejectUnauthorized: false },
  timeout: 2
})

const ajv = new Ajv({
  schemas: [schema],
  allErrors: true,
  removeAdditional: true,
  coerceTypes: true
})

addFormats(ajv)

ajv.addKeyword('database')

// A helper for defining database module functions.
function method (reqSchemaRef, resSchemaRef, queryFn) {
  return async function query (req, ...options) {
    // Check if user input is valid.
    if (!ajv.validate(reqSchemaRef, req)) {
      throw ajv.errors
    }

    // Perform database request.
    const res = await queryFn(req, ...options)

    // Check if database response is valid.
    if (!ajv.validate(resSchemaRef, res)) {
      throw ajv.errors
    }

    return res
  }
}

class CountError extends Error {};

function count (queryFn, n) {
  const onTransaction = async function (trx) {
    const res = await queryFn(trx)

    if (res.count === n) { return res }

    throw new CountError()
  }

  return sql.begin(onTransaction)
}

async function one (queryFn) {
  const res = await count(queryFn, 1)

  return res[0]
}

export default {

  // Errors
  CountError,

  // User

  // post
  insertUser: method(
    'didomi#/database/insert_user_req',
    'didomi#/database/insert_user_res',
    ({ email }) => sql`insert into "user" (email) values (${email}) returning id`
      .then(([{ id }]) => ({ id, email, consents: [] }))),

  // get
  selectUser: method(
    'didomi#/database/select_user_req',
    'didomi#/database/select_user_res',
    ({ id }) => one(sql => sql`select
      u.id,
      u.email,
      coalesce(json_agg(c) filter (where c.user_id is not null), '[]') as consents
    from "user" u
    left join consent_latest c on (c.user_id = u.id)
    where u.id = ${id} and u.email is not null
    group by u.id`)),

  // delete
  deleteUser: method(
    'didomi#/database/delete_user_req',
    'didomi#/database/delete_user_res',
    ({ id }) => one(sql => sql`update "user" set email = null
    where id = ${id} and email is not null`).then(() => null)),

  // Event

  // post
  insertEvent: method(
    'didomi#/database/insert_event_req',
    'didomi#/database/insert_event_res',
    ({ user: { id }, consents }) => count(sql => sql`insert into consent
      ${sql(consents.map(c => ({ ...c, user_id: id })))}`, consents.length).then(() => null))
}
