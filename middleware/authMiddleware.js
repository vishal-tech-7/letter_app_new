const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  let token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.token; // ✅ Supports both headers & cookies

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ message: 'Token has expired. Please log in again.' });
        } else {
          return res.status(401).json({ message: 'Invalid token. Authentication failed.' });
        }
      }
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

module.exports = authMiddleware;
