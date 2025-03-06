const express = require("express");
const router = express.Router();
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
require("dotenv").config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Define OAuth scopes
const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.appdata"
];

// ✅ Generate Google OAuth URL
router.get("/google/url", (req, res) => {
  console.log("✅ Received request for Google OAuth URL...");
  try {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });
    console.log("✅ Generated Google OAuth URL:", url);
    res.json({ url });
  } catch (error) {
    console.error("❌ Error generating Google OAuth URL:", error);
    res.status(500).json({ message: "Error generating OAuth URL" });
  }
});

// ✅ Handle Google OAuth Callback
router.get("/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ message: "Missing authorization code" });

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
    const { data } = await oauth2.userinfo.get();

    console.log("✅ Google User Info:", data);
    console.log("✅ Received tokens:", tokens);

    let user = await User.findOne({ email: data.email });

    if (!user) {
      console.log("🆕 User not found, creating new user...");
      user = new User({
        googleId: data.id,
        name: data.name,
        email: data.email,
        picture: data.picture,
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expiry_date: tokens.expiry_date || Date.now() + 3600 * 1000,
        },
      });
    } else {
      console.log("✅ Updating existing user tokens...");
      user.tokens.access_token = tokens.access_token;
      if (tokens.refresh_token) {
        user.tokens.refresh_token = tokens.refresh_token;
      }
      user.tokens.expiry_date = tokens.expiry_date || Date.now() + 3600 * 1000;
    }

    await user.save();

    // ✅ Generate JWT Token
    const authToken = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

  // In your /google/callback route
  console.log("Full redirect URL:", `${process.env.CLIENT_URL}/auth-redirect?token=${authToken}`);
  console.log("CLIENT_URL value:", process.env.CLIENT_URL);
  console.log("Token value:", authToken);

res.redirect(`${process.env.CLIENT_URL}/auth-redirect?token=${authToken}`);
  } catch (error) {
    console.error("❌ OAuth Callback Error:", error);
    res.redirect(`${process.env.CLIENT_URL}/auth/error?message=${encodeURIComponent(error.message)}`);
  }
});

// ✅ Get user profile
router.get("/profile", async (req, res) => {
  console.log("✅ /auth/profile route was hit!");

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.log("❌ No token provided");
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Token verified:", decoded);

    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      console.log("❌ User not found in database");
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ Sending user profile:", user);
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      picture: user.picture,
    });
  } catch (error) {
    console.error("❌ Profile Fetch Error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

// ✅ Logout (Frontend should remove token)
router.post("/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

module.exports = router;
