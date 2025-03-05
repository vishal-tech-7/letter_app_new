const User = require('../models/User');
const { getGoogleUser } = require('../utils/googleOAuth');
const jwt = require('jsonwebtoken');

const googleLogin = async (req, res) => {
  const { code } = req.body;

  try {
    // Get Google user info
    const googleUser = await getGoogleUser(code);
    let user = await User.findOne({ googleId: googleUser.sub });

    if (!user) {
      user = new User({
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
        refreshToken: googleUser.tokens.refresh_token, // ✅ Store only the refresh token
      });
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    // ✅ Securely store JWT in an httpOnly cookie (Prevents XSS attacks)
    res.cookie('token', token, {
      httpOnly: true, // Prevents client-side JS from accessing it
      secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
      sameSite: 'Strict', // Prevents CSRF
      maxAge: 3600000, // 1 hour expiry
    });

    // ✅ Send only user info (excluding tokens)
    res.json({ user });
  } catch (err) {
    console.error('Google Login Error:', err.message);

    res.status(500).json({
      message: 'Failed to authenticate with Google. Please try again.',
    });
  }
};

module.exports = { googleLogin };
