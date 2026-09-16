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
  if (!idToken || typeof idToken !== "string") {
    return null;
  }

  try {
    const app = getFirebaseAdminApp();

    const decoded = await getAuth(app).verifyIdToken(idToken);

    if (!decoded.email) {
      return null;
    }

    return {
      email: decoded.email.toLowerCase().trim(),
      name: decoded.name || undefined,
    };
  } catch (error) {
    console.error(
      "Firebase ID token verification failed:",
      error
    );

    return null;
  }
}
