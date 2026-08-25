import crypto from 'crypto';

function oauthStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('OAUTH_STATE_SECRET is required in production');
  }
  return 'openship-local-development-oauth-state-secret';
}

export async function generateOAuthState(platformId: string, type: 'shop' | 'channel'): Promise<string> {
  // Create state payload with timestamp for expiry
  const payload = {
    platformId,
    type,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };

  const payloadString = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', oauthStateSecret()).update(payloadString).digest('hex');

  const signedState = {
    payload: payloadString,
    signature
  };

  return Buffer.from(JSON.stringify(signedState)).toString('base64');
}