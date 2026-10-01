require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test endpoint
app.get('/', (req, res) => {
  res.send('IRON RISK Server is running');
});

// HealthID Callback Endpoint
app.get('/auth/healthid/callback', async (req, res) => {
  console.log('--- Incoming HealthID Callback ---');
  console.log('Request Query Parameters:', req.query);
  
  const { code, state, error } = req.query;

  if (error) {
    console.error('HealthID Authorization Error:', error);
    return res.status(400).send(`Authorization Error: ${error}`);
  }

  if (!code) {
    return res.status(400).send('Authorization code is missing.');
  }

  try {
    // 1. Exchange the authorization code for an access token
    // The exact URL and parameters depend on the MOPH HealthID documentation.
    // This is a standard OAuth 2.0 implementation structure.
    
    // Determine base URL based on MOPH_ENV
    const healthIdBaseUrl = process.env.MOPH_ENV === 'prd' 
      ? 'https://moph.id.th' 
      : 'https://uat-moph.id.th';

    const tokenResponse = await axios.post(`${healthIdBaseUrl}/api/v1/token`, new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: process.env.HEALTHID_CLIENT_ID,
      client_secret: process.env.HEALTHID_CLIENT_SECRET,
      redirect_uri: `${process.env.PUBLIC_BASE_URL}/auth/healthid/callback`
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, id_token } = tokenResponse.data;

    // 2. You can now use the access_token to fetch user profile,
    // or decode the id_token to get user information.
    // Example (pseudo-code):
    // const profileResponse = await axios.get(`${healthIdBaseUrl}/userinfo`, {
    //   headers: { Authorization: `Bearer ${access_token}` }
    // });
    // const userData = profileResponse.data;

    // 3. Create a session for the user or redirect them to the frontend
    // For now, we will just return success and the token data for debugging.
    
    // res.json({
    //   message: 'Authentication successful',
    //   data: tokenResponse.data
    // });

    // Normally you redirect back to your frontend with a session token
    res.redirect(`${process.env.PUBLIC_BASE_URL}/dashboard?success=true`);

  } catch (err) {
    console.error('Error exchanging token with HealthID:', err.response?.data || err.message);
    res.status(500).json({ 
      error: 'Failed to authenticate with HealthID',
      details: err.response?.data || err.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
