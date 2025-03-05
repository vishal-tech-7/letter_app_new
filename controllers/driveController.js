const { google } = require('googleapis');
const { Readable } = require('stream'); // ✅ Convert text to a readable stream
const User = require('../models/User');

const saveToDrive = async (req, res) => {
  const { content } = req.body;
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // ✅ Set up OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: user.refreshToken, // ✅ Use refreshToken to get a new access token
  });

  // ✅ Refresh access token to prevent expiration errors
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
  } catch (error) {
    console.error('Failed to refresh access token:', error.message);
    return res.status(500).json({ message: 'Google authentication failed' });
  }

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // ✅ Convert content to a readable stream
  const contentStream = Readable.from(content);

  const fileMetadata = {
    name: 'MyLetter.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // ✅ Save as .docx
  };

  const media = {
    mimeType: 'text/plain',
    body: contentStream, // ✅ Use stream instead of raw text
  };

  try {
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });

    res.json({ fileId: file.data.id });
  } catch (err) {
    console.error('Google Drive Upload Error:', err.message);
    res.status(500).json({ message: 'Failed to save to Google Drive' });
  }
};

module.exports = { saveToDrive };
