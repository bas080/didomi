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
