/**
 * Authentication Middleware
 * Handles authentication for admin routes
 */

/**
 * Simple API key authentication middleware
 * Checks for API key in header or query parameter
 */
export function authenticateAdmin(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const expectedKey = process.env.ADMIN_API_KEY;

  // If no API key is set, allow access (development mode)
  if (!expectedKey) {
    console.warn('Warning: ADMIN_API_KEY not set. Allowing access without authentication.');
    return next();
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Unauthorized. Valid API key required.'
      }
    });
  }

  next();
}

/**
 * Optional authentication - doesn't fail if no key provided
 * Useful for endpoints that have different behavior for authenticated users
 */
export function optionalAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const expectedKey = process.env.ADMIN_API_KEY;

  if (expectedKey && apiKey === expectedKey) {
    req.authenticated = true;
  } else {
    req.authenticated = false;
  }

  next();
}
