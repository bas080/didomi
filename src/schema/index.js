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
