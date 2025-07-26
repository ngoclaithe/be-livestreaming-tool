const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const config = require('.');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Livestream Tool API',
      version: '1.0.0',
      description: 'API documentation for Livestream Tool',
      contact: {
        name: 'API Support',
        email: 'support@livestreamtool.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api/v1`,
        description: 'Development server',
      },
      {
        url: 'https://api.livestreamtool.com/v1',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
        },
        BadRequest: {
          description: 'Invalid request data',
        },
        NotFound: {
          description: 'Resource not found',
        },
      },
      schemas: {
        Logo: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            code_logo: { type: 'string', example: 'L12345' },
            type_logo: { 
              type: 'string', 
              enum: ['logo', 'banner'],
              example: 'logo' 
            },
            url_logo: { type: 'string', format: 'uri' },
            file_path: { type: 'string' },
            userId: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../controllers/*.js'),
    path.join(__dirname, '../models/*.js')
  ]
};

const specs = swaggerJsdoc(options);

module.exports = { specs, options };
