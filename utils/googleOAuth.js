const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const getGoogleUser = async (code) => {
  try {
    const { tokens } = await client.getToken(code);

    if (!tokens?.id_token) {
      throw new Error('No ID token found in response');
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      tokens,
    };
  } catch (error) {
    console.error('Google OAuth error:', error.message);
    throw new Error('Failed to authenticate with Google');
  }
};

// Function to refresh access token (optional)
const refreshAccessToken = async (refreshToken) => {
  try {
    const { credentials } = await client.refreshToken(refreshToken);
    return credentials;
  } catch (error) {
    console.error('Token refresh error:', error.message);
    throw new Error('Failed to refresh access token');
  }
};

module.exports = { getGoogleUser, refreshAccessToken };
