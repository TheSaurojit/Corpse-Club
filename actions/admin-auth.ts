'use server';

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { signAdminJwt, verifyAdminJwt } from '@/lib/jwt';
import { verifyFirebaseIdToken } from '@/lib/firebase-admin';

export interface AdminAuthResult {
  authorized: boolean;
  admin?: {
    email: string;
    name?: string | null;
  };
  error?: string;
}

/**
 * Verifies a Firebase ID Token using Firebase Admin SDK (or Google Identity Toolkit),
 * checks the verified email against the Neon PostgreSQL admin whitelist,
 * and issues a custom signed JWT stored in an HTTP-only cookie.
 */
export async function verifyAdminAction(
  idToken: string
): Promise<AdminAuthResult> {
  if (!idToken || typeof idToken !== 'string') {
    return {
      authorized: false,
      error: 'Authentication token is missing or invalid.',
    };
  }

  try {
    // 1. Cryptographically verify the Firebase ID token on the server
    const verifiedUser = await verifyFirebaseIdToken(idToken);

    if (!verifiedUser || !verifiedUser.email) {
      return {
        authorized: false,
        error: 'Invalid or forged Firebase authentication token. Sign-in rejected.',
      };
    }

    const verifiedEmail = verifiedUser.email.toLowerCase().trim();

    // 2. Check if database URL is configured
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
      return {
        authorized: false,
        error:
          'Database not connected yet. Please set your Neon DATABASE_URL in .env.local and run migrations.',
      };
    }

    // 3. Query Neon database for whitelisted admin email using the GUARANTEED verified email
    const adminRecord = await prisma.admin.findUnique({
      where: {
        email: verifiedEmail,
      },
    });

    if (!adminRecord) {
      return {
        authorized: false,
        error: `Access Denied: The Google account "${verifiedEmail}" is not on the Corpse Club admin whitelist.`,
      };
    }

    // 4. Issue cryptographically signed custom JWT embedding email and name
    const adminName = adminRecord.name || verifiedUser.name || 'Lounge Admin';
    const token = await signAdminJwt({
      email: adminRecord.email,
      name: adminName,
    });

    // 5. Set secure HTTP-only session cookie containing the custom JWT
    const cookieStore = await cookies();
    cookieStore.set('corpse_admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return {
      authorized: true,
      admin: {
        email: adminRecord.email,
        name: adminName,
      },
    };
  } catch (err: unknown) {
    console.error('Error verifying admin whitelist:', err);
    return {
      authorized: false,
      error: 'Security verification error or database connection failure.',
    };
  }
}

/**
 * Reads and cryptographically verifies the custom JWT from the HTTP-only session cookie
 */
export async function getAdminSessionAction(): Promise<{
  isAuthenticated: boolean;
  email?: string;
  name?: string;
}> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('corpse_admin_session');

    if (!sessionCookie || !sessionCookie.value) {
      return { isAuthenticated: false };
    }

    // Cryptographically verify custom JWT signature & expiration
    const payload = await verifyAdminJwt(sessionCookie.value);
    if (!payload || !payload.email) {
      return { isAuthenticated: false };
    }

    return {
      isAuthenticated: true,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return { isAuthenticated: false };
  }
}

/**
 * Destroys the admin session cookie
 */
export async function logoutAdminAction(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('corpse_admin_session');
    return { success: true };
  } catch {
    return { success: false };
  }
}
