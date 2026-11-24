// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0

/** The initial OpenAPI 3 document. Routes add themselves here as they appear; the same JSON Schemas validate the requests. */
export function buildOpenApiDocument(version) {
  const status = {
    type: 'object',
    required: ['status'],
    properties: { status: { type: 'string', enum: ['ok', 'unavailable'] } },
  };
  return {
    openapi: '3.0.3',
    info: {
      title: 'Skrifari API',
      version,
      license: { name: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Liveness: the process answers',
          responses: { 200: { description: 'Alive', content: { 'application/json': { schema: status } } } },
        },
      },
      '/ready': {
        get: {
          summary: 'Readiness: MongoDB and Redis answer',
          responses: {
            200: { description: 'Ready', content: { 'application/json': { schema: status } } },
            503: { description: 'A dependency is down', content: { 'application/json': { schema: status } } },
          },
        },
      },
    },
  };
}
