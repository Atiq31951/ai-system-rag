/**
 * Base Application Error class representing operational, expected errors.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {number} [statusCode=500] - HTTP status code
   * @param {string} [code='INTERNAL_ERROR'] - Machine-readable error code
   * @param {Record<string, unknown>|null} [details=null] - Additional validation or contextual data
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  /**
   * @param {string} [message='Resource not found']
   * @param {Record<string, unknown>|null} [details=null]
   */
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class BadRequestError extends AppError {
  /**
   * @param {string} [message='Bad request']
   * @param {Record<string, unknown>|null} [details=null]
   */
  constructor(message = 'Bad request', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  /**
   * @param {string} [message='Unauthorized']
   * @param {Record<string, unknown>|null} [details=null]
   */
  constructor(message = 'Unauthorized', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  /**
   * @param {string} [message='Forbidden']
   * @param {Record<string, unknown>|null} [details=null]
   */
  constructor(message = 'Forbidden', details = null) {
    super(message, 403, 'FORBIDDEN', details);
  }
}
