/**
 * Authentication Middleware
 * Handles authentication for admin routes
 */

/**
 * Simple API key authentication middleware
 * Checks for API key in header or query parameter
 * Also accepts login tokens (base64 encoded username:timestamp)
 */
export function authenticateAdmin(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const expectedKey = process.env.ADMIN_API_KEY;
  const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin';

  // If no API key is set, allow access (development mode)
  if (!expectedKey) {
    // Check if it's a valid login token
    if (apiKey) {
      try {
        const decoded = Buffer.from(apiKey, 'base64').toString('utf-8');
        const [username] = decoded.split(':');
        if (username === expectedUsername) {
          return next();
        }
      } catch (e) {
        // Not a valid token, continue to check
      }
    }
    console.warn('Warning: ADMIN_API_KEY not set. Allowing access without authentication.');
    return next();
  }

  // Check against expected API key
  if (apiKey && apiKey === expectedKey) {
    return next();
  }

  // Check if it's a valid login token
  if (apiKey) {
    try {
      const decoded = Buffer.from(apiKey, 'base64').toString('utf-8');
      const [username] = decoded.split(':');
      if (username === expectedUsername) {
        return next();
      }
    } catch (e) {
      // Not a valid token
    }
  }

  return res.status(401).json({
    success: false,
    error: {
      message: 'Unauthorized. Valid API key or login token required.'
    }
  });
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
