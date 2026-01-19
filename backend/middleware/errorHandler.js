/**
 * Error Handler Middleware
 * Handles errors and sends appropriate responses
 */

export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Default error
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Validation errors
  if (err.name === 'ValidationError' || err.type === 'validation') {
    status = 400;
  }

  // Database errors
  if (err.code === 'SQLITE_CONSTRAINT') {
    status = 400;
    if (err.message.includes('UNIQUE')) {
      message = 'Duplicate entry. This record already exists.';
    } else {
      message = 'Database constraint violation.';
    }
  }

  // Not found errors
  if (err.status === 404 || err.statusCode === 404) {
    status = 404;
  }

  res.status(status).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler
 */
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`
    }
  });
}
