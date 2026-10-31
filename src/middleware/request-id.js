import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Assigns or propagates an incoming X-Request-Id header.
 * Uses Node.js 24 crypto.randomUUID().
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requestId(req, res, next) {
  const incomingId = req.header(REQUEST_ID_HEADER);
  const id = incomingId && incomingId.trim().length > 0 ? incomingId : randomUUID();

  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
