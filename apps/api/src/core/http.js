// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0

export const idSchema = { type: 'string', pattern: '^[0-9a-f]{24}$' };
export const idParams = { type: 'object', required: ['id'], additionalProperties: false, properties: { id: idSchema } };
export const pageQuery = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    skip: { type: 'integer', minimum: 0, maximum: 100000, default: 0 },
  },
};

/** An error with an HTTP status and a message that is safe to show. */
export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.expose = true;
  }
}
export const notFound = (what = 'Not found') => new HttpError(404, what);

/** The id and a few fields of a document as plain JSON (never password hashes). */
export const withId = (doc, fields) => ({
  id: String(doc._id),
  ...Object.fromEntries(
    fields.map((f) => [f, doc[f] instanceof Object && doc[f]?._bsontype ? String(doc[f]) : doc[f]]),
  ),
});
