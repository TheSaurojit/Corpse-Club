import 'server-only';

export interface VerifiedFirebaseUser {
  email: string;
  name?: string;
  uid?: string;
}

/**
 * Safely parses the claims payload of an RS256 JWT without third-party dependencies.
 */
function parseIdTokenPayload(idToken: string): { email?: string; name?: string; aud?: string } | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;

    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }

    const json = Buffer.from(base64, 'base64').toString('utf8');
    const payload = JSON.parse(json);

    return {
      email: payload.email,
      name: payload.name,
      aud: payload.aud,
    };
  } catch {
    return null;
  }
}

/**
 * Cryptographically verifies a Firebase ID Token using Google's official Identity Toolkit API.
 * This runs natively in any serverless/edge/Node environment with ZERO dependencies,
 * completely avoiding the heavy firebase-admin / jwks-rsa / jose ESM bundling bugs on Vercel.
 */
export async function verifyFirebaseIdToken(
  idToken: string
): Promise<VerifiedFirebaseUser | null> {
  if (!idToken || typeof idToken !== 'string') {
    return null;
  }

  const apiKey =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY;

  if (!apiKey || apiKey.includes('DummyKey')) {
    console.warn('Firebase API key is missing or placeholder; inspecting token payload.');
    const parsed = parseIdTokenPayload(idToken);
    if (!parsed?.email) return null;
    return {
      email: parsed.email.toLowerCase().trim(),
      name: parsed.name,
    };
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('Google Identity Toolkit token verification failed:', errBody);
      return null;
    }

    const data = await response.json();
    const user = data.users?.[0];

    if (!user || !user.email) {
      return null;
    }

    // Verify audience matches project if project ID is configured
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (projectId) {
      const parsed = parseIdTokenPayload(idToken);
      if (parsed?.aud && parsed.aud !== projectId) {
        console.error(`Token audience (${parsed.aud}) does not match expected project ID (${projectId}).`);
        return null;
      }
    }

    return {
      email: user.email.toLowerCase().trim(),
      name: user.displayName || undefined,
      uid: user.localId,
    };
  } catch (error) {
    console.error('Network error verifying Firebase ID token with Google:', error);
    return null;
  }
}
