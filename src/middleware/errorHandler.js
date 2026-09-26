import multer from 'multer';
import { logger } from '../utils/logger.js';

export function notFound(_req, res) {
  res.status(404).json({ error: 'not_found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'upload_error', message: err.message });
  }
  const status = err.status || 500;
  if (status >= 500) {
    logger.error('unhandled_error', { message: err.message, stack: err.stack });
  } else {
    logger.warn('request_error', { status, message: err.message });
  }
  res.status(status).json({
    error: err.code || 'internal_error',
    message: status >= 500 && process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
  });
}

// Wrap async route handlers so rejected promises hit the error handler.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
