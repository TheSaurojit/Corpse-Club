import {
  getApps,
  getApp,
  initializeApp,
  cert,
  App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin environment variables.'
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export default getFirebaseAdminApp;

/**
 * Cryptographically verifies a Firebase ID Token.
 * 1. Attempts verification using Firebase Admin SDK.
 * 2. If Service Account keys are not yet configured, falls back to Google's
 *    Identity Toolkit verification endpoint using NEXT_PUBLIC_FIREBASE_API_KEY.
 */
export async function verifyFirebaseIdToken(
  idToken: string
): Promise<{ email: string; name?: string } | null> {
  if (!idToken || typeof idToken !== 'string') {
    return null;
  }

  // 1. Try Firebase Admin SDK verification
  try {
    const app = getFirebaseAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);
    if (decoded && decoded.email) {
      return {
        email: decoded.email.toLowerCase().trim(),
        name: (decoded.name as string) || undefined,
      };
    }
  } catch (adminErr: unknown) {
    console.warn('Firebase Admin SDK verification note:', (adminErr as Error)?.message);
  }

  // 2. Fallback: Google Identity Toolkit REST verification
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (apiKey && !apiKey.includes('placeholder')) {
    try {
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        const user = data.users && data.users[0];
        if (user && user.email) {
          return {
            email: user.email.toLowerCase().trim(),
            name: user.displayName,
          };
        }
      }
    } catch (apiErr) {
      console.error('Google Identity Toolkit verification error:', apiErr);
    }
  }

  return null;
}
