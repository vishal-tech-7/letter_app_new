const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const User = require('../models/User');
const Letter = require('../models/letterModel');
const jwt = require('jsonwebtoken');

// Auth middleware
const authMiddleware = async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
  
      if (!token) {
        console.log("❌ No token provided in request.");
        return res.status(401).json({ message: "No token provided" });
      }
  
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("✅ Token Decoded:", decoded);
  
      const user = await User.findById(decoded.id).select("-tokens"); // Exclude tokens from response
  
      if (!user) {
        console.log("❌ User not found in database.");
        return res.status(404).json({ message: "User not found" });
      }
  
      console.log("✅ User Verified:", user.email);
      req.user = user;
      next();
    } catch (error) {
      console.error("❌ Auth error:", error);
      res.status(401).json({ message: "Not authorized" });
    }
  };
  

// Get OAuth2 client with refreshed token handling
const getOAuth2Client = async (userId) => {
    const user = await User.findById(userId);
    if (!user || !user.tokens || !user.tokens.access_token) {
      console.error("❌ No stored tokens found for user:", userId);
      throw new Error("No stored OAuth tokens");
    }
  
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  
    oauth2Client.setCredentials({
      access_token: user.tokens.access_token,
      refresh_token: user.tokens.refresh_token,
      expiry_date: user.tokens.expiry_date,
    });
  
    // ✅ Automatically refresh tokens if expired
    oauth2Client.on("tokens", async (tokens) => {
      if (tokens.access_token) {
        console.log("🔄 Updating access token...");
        user.tokens.access_token = tokens.access_token;
      }
      if (tokens.refresh_token) {
        console.log("🔄 Updating refresh token...");
        user.tokens.refresh_token = tokens.refresh_token;
      }
      user.tokens.expiry_date = tokens.expiry_date;
      await user.save();
    });
  
    return oauth2Client;
  };
  
  

// Ensure "Letters" folder exists in Google Drive
router.get('/ensure-folder', authMiddleware, async (req, res) => {
  try {
    const oauth2Client = await getOAuth2Client(req.user._id);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const folderQuery = "name='Letters' and mimeType='application/vnd.google-apps.folder' and trashed=false";
    const folderResponse = await drive.files.list({
      q: folderQuery,
      fields: 'files(id)',
    });

    let folderId = folderResponse.data.files.length
      ? folderResponse.data.files[0].id
      : (await drive.files.create({
          resource: { name: 'Letters', mimeType: 'application/vnd.google-apps.folder' },
          fields: 'id',
        })).data.id;

    res.json({ folderId });
  } catch (error) {
    console.error('Drive error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save letter to Google Drive
router.post('/save', authMiddleware, async (req, res) => {
    try {
      console.log("✅ Received request to save letter:", req.body);

      const { title, content, letterId, folderId } = req.body;
      if (!title || !content) {
        console.log("❌ Missing title or content.");
        return res.status(400).json({ message: "Title and content are required" });
      }

      const oauth2Client = await getOAuth2Client(req.user._id);
      if (!oauth2Client) {
        console.error("❌ OAuth2 Client could not be created.");
        return res.status(500).json({ message: "OAuth2 Client creation failed" });
      }

      const drive = google.drive({ version: "v3", auth: oauth2Client });

      let letter = letterId ? await Letter.findById(letterId) : null;

      if (letter && letter.driveFileId) {
        console.log("🔄 Updating existing Google Doc...");
        try {
          await drive.files.update({
            fileId: letter.driveFileId,
            media: { mimeType: "text/plain", body: content },
          });
        } catch (error) {
          console.error("❌ Error updating Google Doc:", error);
          return res.status(500).json({ message: "Error updating Google Doc", error: error.message });
        }

        letter.title = title;
        letter.content = content;
        letter.lastSaved = Date.now();
        await letter.save();
      } else {
        console.log("🆕 Creating new Google Doc...");
        try {
          const fileMetadata = {
            name: title,
            mimeType: "application/vnd.google-apps.document",
            parents: folderId ? [folderId] : [],
          };

          const media = {
            mimeType: "text/plain",
            body: content,
          };

          const driveResponse = await drive.files.create({
            resource: fileMetadata,
            media,
            fields: "id, webViewLink",
          });

          if (!driveResponse.data.id) {
            throw new Error("Drive did not return a file ID");
          }

          letter = letter
            ? Object.assign(letter, { title, content, driveFileId: driveResponse.data.id, lastSaved: Date.now() })
            : await Letter.create({ title, content, user: req.user._id, driveFileId: driveResponse.data.id });

          await letter.save();
          console.log("✅ Letter saved successfully:", letter);
        } catch (error) {
          console.error("❌ Drive save error:", error);
          return res.status(500).json({ message: "Error saving to Google Drive", error: error.message });
        }
      }

      res.json({ letter, driveLink: `https://docs.google.com/document/d/${letter.driveFileId}` });
    } catch (error) {
      console.error("❌ Unexpected Error:", error);
      res.status(500).json({ message: "Unexpected error", error: error.message });
    }
  });


// Get user's saved letters
router.get('/list', authMiddleware, async (req, res) => {
    try {
      console.log("✅ Received request to list Google Drive files...");
  
      const oauth2Client = await getOAuth2Client(req.user._id);
      if (!oauth2Client) {
        console.error("❌ OAuth2 Client could not be created.");
        return res.status(500).json({ message: "OAuth2 Client creation failed" });
      }
  
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
      console.log("🔄 Fetching files from Google Drive...");
      try {
        const response = await drive.files.list({
          q: "mimeType='application/vnd.google-apps.document' and trashed=false",
          fields: "files(id, name, webViewLink, createdTime, modifiedTime)",
          orderBy: "modifiedTime desc",
        });
  
        console.log("✅ Google Drive files retrieved:", response.data.files);
        res.json(response.data.files);
      } catch (error) {
        console.error("❌ Drive list error:", error);
        return res.status(500).json({ message: "Error fetching files from Google Drive", error: error.message });
      }
    } catch (error) {
      console.error("❌ Unexpected Error:", error);
      res.status(500).json({ message: "Unexpected error", error: error.message });
    }
  });
  

// Save draft letter (MongoDB only)
router.post('/draft', authMiddleware, async (req, res) => {
  try {
    const { title, content, letterId } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    let letter = letterId ? await Letter.findById(letterId) : null;

    if (letter) {
      if (letter.user.toString() !== req.user._id.toString()) {
        return res.status(401).json({ message: 'Not authorized' });
      }

      letter.title = title;
      letter.content = content;
      letter.lastSaved = Date.now();
      await letter.save();
    } else {
      letter = await Letter.create({ title, content, user: req.user._id });
    }

    res.json(letter);
  } catch (error) {
    console.error('Draft save error:', error);
    res.status(500).json({ message: 'Error saving draft' });
  }
});

// Get user's draft letters
router.get('/drafts', authMiddleware, async (req, res) => {
  try {
    const letters = await Letter.find({ user: req.user._id }).sort({ lastSaved: -1 });
    res.json(letters);
  } catch (error) {
    console.error('Drafts fetch error:', error);
    res.status(500).json({ message: 'Error fetching drafts' });
  }
});

module.exports = router;
