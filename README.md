# Didomi

A code challenge from Didomi for me.

<!-- toc -->

- [Setup](#setup)
  * [Environment Variables](#environment-variables)
  * [Postgres](#postgres)
  * [Node](#node)
- [Implementation](#implementation)
  * [Dependencies](#dependencies)
  * [Directory structure](#directory-structure)
  * [Schemas](#schemas)
  * [Database + Validation](#database--validation)
  * [Routes and middleware](#routes-and-middleware)
  * [Putting it together](#putting-it-together)
- [Tests](#tests)

<!-- tocstop -->

## Setup

### Environment Variables

For sake of ease we add a file with some sane defaults for environment
variables.

```bash
export DATABASE_URL='postgres://didomi:didomi@localhost:5432/didomi'
export PORT=8080
export API_BASE_URL="http://localhost:$PORT/api",
```

You can source this file when you want those environment variables.

`$ source .bash_env`

> This is just a suggestions and you can configure the environment variables in
> whatever manner you see fit.

### Postgres

When setting up a new dev database it is advised to create a database and
a user.

```sql sudo -u postgres psql
create user didomi with password 'didomi';
create database didomi;
grant all privileges on database didomi to didomi;
```
```
GRANT
```

Then we also have to perform the following when connected to the database.

```sql sudo -u postgres psql didomi
grant usage on schema public to didomi;
grant all privileges on all tables in schema public to didomi;
grant usage on all sequences in schema public to didomi;
```
```
GRANT
GRANT
GRANT
```

> This is just an example and one can choose to name the database differently
> or to grant a more restricted set of permissions to the didomi user.

For this project I won't setup a system for performing migrations. Instead
simply run this migration manually.

```sql sudo -u postgres psql didomi
-- user

create table "user" (
  id serial primary key, -- Could use a hashing functions.
  email text
);

create unique index user_email_idx on "user" (email) where (email is not null);

-- consent

create table consent (
  user_id integer references "user" (id) not null,
  id text not null,
  enabled boolean not null,
  created_at timestamp default now() not null
);

create view consent_latest as
  select distinct on (id, user_id) *
  from consent c
  order by
    user_id,
    id,
    created_at
    desc;
```

### Node

Running the server is easy once the database is setup.

First install dependencies:

```bash bash
npm ci
```
```

added 132 packages, and audited 133 packages in 1s

46 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

And then start the node process.

```bash
npm start
```

## Implementation

For this project I'll use the same npm dependencies I use in several of my
projects. But I will try out new (for me) ways of putting them together.

We'll also be committing changes as we go.

```bash bash
echo "node_modules" > .gitignore

# Already initiated package.json and installed the dependencies.
git add .gitignore package-lock.json package.json
git commit -m "Initiate didomi project"
```
```
[master (root-commit) 33c54fe] Initiate didomi project
 3 files changed, 2627 insertions(+)
 create mode 100644 .gitignore
 create mode 100644 package-lock.json
 create mode 100644 package.json
```

As this is a JS project we'll add the desired .gitignore file.


### Dependencies

```bash node -p
require("./package.json").dependencies
```
```
{
  ajv: '^8.8.2',
  'ajv-formats': '^2.1.1',
  express: '^4.17.1',
  postgres: '^1.0.2',
  ramda: '^0.27.1'
}
```

```bash node -p
require("./package.json").devDependencies
```
```
{ axios: '^0.24.0', patroon: '^1.2.0', tape: '^5.3.2' }
```

#### [Postgres][postgres]

A very simple and postgres friendly tool for working with a postgres database.

#### [Ajv][ajv]

Ajv is a javascript implementation of the json-schema specification. Ajv is
a declarative way of defining schemas which has gained popularity for good
reason. It allows you to:

1. Validate user input.
2. Validate server responses.
3. Generate detailed API documentation.

#### [Express][express]

I could use any HTTP routing and middleware library out there; but this one I have
the most experience with.

#### [Ramda][ramda]

We can use a few helper functions to make our life easier. Really no need but
I want to keep the code concise and as distraction free as possible. Not
writing my own utilities.

Now let's get started with the code. We'll use literate programming to document
both the code and the thought process.

### Directory structure

```bash bash
tree -d ./src/
```
```
./src/
├── database
├── router
└── schema

3 directories
```

### Schemas

The json schemas will be defined in the `./src/schema` directory.

JSON Pointer spec is also implemented in Ajv. This allows is to reuse schemas
and define relationships between data.

> Something I think would make sense is to use the schemas to validate the
> input and output to the database functions. This moves the validation all the
> way to the database helpers and as a result; anything that uses the database
> functions also gets validation with that. This should improve data
> integrity.

```js tee ./src/schema/index.js > /dev/null
export default {
  $id: 'didomi',
  title: 'Didomi',
  definitions: {
    user: {
      title: 'user',
      type: 'object',
      properties: {
        id: { type: 'integer' },
        email: { type: 'string', format: 'email' },
        consents: {
          type: 'array',
          items: { $ref: 'didomi#/definitions/consent' }
        }
      }
    },
    consent: {
      title: 'consent',
      type: 'object',
      properties: {
        id: {
          type: 'string',
          enum: [
            'email_notifications',
            'sms_notifications'
          ]
        },
        enabled: { type: 'boolean' }
      }
    }
  },

  database: {

    insert_event_req: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'integer' }
          },
          required: ['id']
        },
        consents: {
          type: 'array',
          items: { $ref: 'didomi#/definitions/consent' }
        }
      },
      required: ['user', 'consents']
    },

    insert_event_res: {
      type: 'null'
    },

    insert_user_req: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email'
        }
      }
    },

    insert_user_res: {
      $ref: 'didomi#/definitions/user'
    },

    select_user_req: {
      type: 'object',
      properties: {
        id: {
          type: 'integer'
        }
      },
      required: ['id']
    },

    select_user_res: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        email: { type: 'string', format: 'email' },
        consents: { type: 'array', items: { $ref: 'didomi#/definitions/consent' } }
      },
      required: ['id', 'email', 'consents']
    },

    delete_user_req: {
      type: 'object',
      properties: {
        id: { type: 'integer' }
      }
    },

    delete_user_res: { type: 'null' }
  }

}
```

> Although the spec is named JSON schema I have chosen to define the schema in
> Javascript. This makes it slightly easier to create helpers for defining
> schemas in a more concise manner.

So now that we have the schemas we'll create the sql queries that will respond
with the desired and valid JSON. We'll use `postgres.js` and plain sql for
this. But before we do that let's commit some of these changes.

```bash bash
git add ./src/schema
git commit -m "Add didomi schemas"
```
```
[master f7a906f] Add didomi schemas
 1 file changed, 101 insertions(+)
 create mode 100644 src/schema/index.js
```

### Database + Validation

Next we define the queries and also wrap the database functions with our
schemas.

```js tee ./src/database/index.js > /dev/null
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
```

Let's commit those database helpers already.

```bash bash
git add ./src/database/
git commit -m "Add database functions for didomi"
```
```
[master f5a725d] Add database functions for didomi
 1 file changed, 105 insertions(+)
 create mode 100644 src/database/index.js
```

We have now defined both the schemas and queries and combined the two to get
the best of json-schema and the database. Now we need to setup our routes and
middleware.

> Considering that we are only using these database functions for endpoints; it
> is ok to not test these helpers at the database level. Where we to use these
> functions in other places in the application, it would be sensible to write
> tests for them as they are core to the application and business logic.

### Routes and middleware

My preferred approach to defining modules is by passing in the dependencies as
arguments. This approach is little known but it is comparable to inversion of
control but without all the OOP jargon but with similar benefits. I have heard
people call this style "Isolation" which I think is a good term. The approach
allows you to use the code in different contexts easier. Contexts like unit
testing, documentation generation or anything really.

```js tee ./src/router/api.js > /dev/null
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
```

> Notice that I export a function instead of the router. Although I'm against
> mocking; it is really easy for me to do so. I could also pass in a fake
> router object which instead generates endpoint documentation. These are a few
> possibilities.

```bash bash
git add ./src/router/api.js
git commit -m "Add json api router module"
```
```
[master 11d2c8c] Add json api router module
 1 file changed, 58 insertions(+)
 create mode 100644 src/router/api.js
```

### Putting it together

Now for the `index.js` of the project. This is where everything comes together.

We'll import all the things and glue it all together.

```js tee ./index.js > /dev/null
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
```

Let's commit these changes.

```bash bash
git add index.js
git commit -m "Add main script"
```
```
[master 9b08643] Add main script
 1 file changed, 22 insertions(+)
 create mode 100755 index.js
```

Now that we think we have a working solution we can start testing it.

## Tests

Because we are building a HTTP server it makes sense to test it at that level.
For this testing use-case we could use any language and testing framework. But
I'm using [tape][tape], [patroon][patroon] and [axios][axios].

```js tee index.test.js > /dev/null
#!/usr/bin/env node

import { test } from 'tape'
import axios from 'axios'
import patroon from 'patroon'
import { isEmpty, is } from 'ramda'

const isNumber = is(Number)
const isString = is(String)
const isArray = is(Array)

const didomi = axios.create({
  baseURL: process.env.API_BASE_URL,
  timeout: 2000,
  validateStatus: status => status < 500
})

test('Happy path and some edge cases.', async function (t) {
  const ok = title => value => {
    t.pass(title)
    return value
  }

  const emailJSONString = `"${Date.now()}@didomi.com"`

  const { data: { id: userId } } = patroon({
    status: 200,
    data: {
      id: isNumber,
      email: isString,
      consents: isEmpty
    }
  }, ok('Creata an user.'))(await didomi.post('/users', emailJSONString))

  patroon({
    status: 422
  }, ok('Fails when creating another user with same email.'))(await didomi.post('/users', emailJSONString))

  patroon({
    status: 200,
    data: {
      id: isNumber,
      email: isString,
      consents: isArray
    }
  }, ok('Get an user.'))(await didomi.get(`/users/${userId}`))

  patroon({
    status: 201
  }, ok('Post an event'))(await didomi.post('/events', {
    user: {
      id: userId
    },
    consents: [
      {
        id: 'email_notifications',
        enabled: true
      }
    ]
  }))

  patroon({
    status: 201
  }, ok('Post an event'))(await didomi.post('/events', {
    user: {
      id: userId
    },
    consents: [
      {
        id: 'email_notifications',
        enabled: false
      },
      {
        id: 'sms_notifications',
        enabled: true
      }
    ]
  }))

  patroon({
    status: 200,
    data: {
      id: userId,
      email: isString,
      consents: [{
        id: 'email_notifications',
        enabled: false
      }, {
        id: 'sms_notifications',
        enabled: true
      }]
    }
  }, ok('Get a user.'))(await didomi.get(`/users/${userId}`))

  patroon({
    status: 404
  }, ok('Post an event with non existent user.'))(await didomi.post('/events', {
    user: {
      id: userId + 1
    },
    consents: [
      {
        id: 'email_notifications',
        enabled: true
      }
    ]
  }))

  patroon({
    status: 422,
    data: [{
      schemaPath: 'didomi#/definitions/consent/properties/id/enum'
    }]
  }, ok('Post an event with incorrect consent id.'))(await didomi.post('/events', {
    user: {
      id: userId
    },
    consents: [
      {
        id: 'incorrect_id',
        enabled: true
      }
    ]
  }))

  patroon({
    status: 201
  }, ok('Delete user.'))(await didomi.delete(`/users/${userId}`))

  patroon({
    status: 404
  }, ok('Delete non existent user.'))(await didomi.delete(`/users/${userId}`))

  patroon({
    status: 404
  }, ok('Get non existent user.'))(await didomi.get(`/users/${userId}`))

  patroon({
    status: 400
  }, ok('Fails when sending invalid JSON'))(await didomi.post('/events', '.'))

  t.end()
})
```

> There are many other negative cases but I won't test all of them. The API
> also might have certain properties which are true accross all endpoints.
> These could be tested using generative and property based testing. We won't
> be doing that either.

We have to start the server before we can start running the tests. We'll use
nodemon to make sure that the dev server process is using the latest code. We
won't add this to the dev dependencies as this will bog down the install
possibly on CI but also on dev machines. Instead we'll use `npx`.

`$ npx nodemon`

We then run the tests as follow:

```bash sleep 2; bash
npm test
```
```

> didomi@1.0.0 test
> tape index.test.js

TAP version 13
# Happy path and some edge cases.
ok 1 Creata an user.
ok 2 Fails when creating another user with same email.
ok 3 Get an user.
ok 4 Post an event
ok 5 Post an event
ok 6 Get a user.
ok 7 Post an event with non existent user.
ok 8 Post an event with incorrect consent id.
ok 9 Delete user.
ok 10 Delete non existent user.
ok 11 Get non existent user.
ok 12 Fails when sending invalid JSON

1..12
# tests 12
# pass  12

# ok

```

Notice that this is valid TAP output and allows for integration with TAP
compliant test harnesses like Perl's prove.

Let's commit our tests.

```bash bash
git add ./index.test.js
git commit -m "Add implementation tests "
```
```
[master 0c3e379] Add implementation tests
 1 file changed, 143 insertions(+)
 create mode 100644 index.test.js
```

We also want to test if we have correct formatting; check if we have possible
bugs and/or dead code.

```bash bash
npx standard && echo 'code is clean'
```
```
code is clean
```

We'll check if everything is committed and review the log.

```bash bash
git status
git log --oneline
```
```
On branch master
Untracked files:
  (use "git add <file>..." to include in what will be committed)

	.local.bash_history
	.local.bashrc
	BOOTSTRAP.mz
	README.md
	README.mz
	README.mz.bak

nothing added to commit but untracked files present (use "git add" to track)
0c3e379 Add implementation tests
9b08643 Add main script
11d2c8c Add json api router module
f5a725d Add database functions for didomi
f7a906f Add didomi schemas
33c54fe Initiate didomi project
```

[ajv]:https://www.npmjs.com/package/ajv
[postgres]:https://www.npmjs.com/package/postgres
[express]:https://www.npmjs.com/package/express
[ramda]:https://www.npmjs.com/package/ramda
[patroon]:https://www.npmjs.com/package/patroon
[axios]:https://www.npmjs.com/package/axios
[tape]:https://www.npmjs.com/package/tape
