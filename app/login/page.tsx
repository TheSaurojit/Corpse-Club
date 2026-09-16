"use client";

import "./globals.css";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { verifyAdminAction, getAdminSessionAction } from '@/actions/admin-auth';

export default function AdminLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  // If already logged in with valid session cookie, redirect to /admin
  useEffect(() => {
    getAdminSessionAction().then((session) => {
      if (session.isAuthenticated) {
        const redirect =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('redirect')
            : null;
        router.push(redirect || '/admin');
      }
    });
  }, [router]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setUserEmail('');

    try {
      // 1. Firebase Google OAuth Popup
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email;

      if (!email) {
        await signOut(auth);
        setErrorMessage('Unable to retrieve an email address from your Google account.');
        setIsLoading(false);
        return;
      }

      setUserEmail(email);

      // 2. Extract authentic Firebase ID token
      const idToken = await result.user.getIdToken();

      // 3. Server verifies token via Firebase Admin, checks Neon whitelist, and issues custom JWT
      const verification = await verifyAdminAction(idToken);

      if (!verification.authorized) {
        // 4. User is NOT in Neon `admins` table -> Immediately sign them out of Firebase!
        await signOut(auth);
        setErrorMessage(
          verification.error ||
            `Access Denied: The Google account "${email}" does not have admin privileges.`
        );
        setIsLoading(false);
        return;
      }

      // 4. Authorized Admin -> Proceed to Lounge Admin Console
      const redirect =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('redirect')
          : null;
      router.push(redirect || '/admin');
    } catch (err: unknown) {
      console.error('Sign-in error:', err);
      const msg = err instanceof Error ? err.message : 'Google authentication failed';
      setErrorMessage(msg);
      setIsLoading(false);
    }
  };

  return (
    <html>
    <body>
    <main className="relative min-h-screen overflow-hidden bg-[#08080c] flex items-center justify-center px-4">

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
      </div>

      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">

        <div className="rounded-3xl border border-white/10 bg-[#111116]/90 p-8 shadow-2xl backdrop-blur-xl">

          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 shadow-xl shadow-purple-500/20">
              <span className="text-4xl">🎮</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-purple-400">
              Admin Portal
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-white">
              Welcome Back
            </h1>

            <p className="mt-3 text-sm text-gray-400">
              Sign in to manage your gaming cafe
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-300">
              <span className="text-base shrink-0">⚠️</span>
              <div className="space-y-1">
                <p className="font-semibold text-red-200">Authentication Failed</p>
                <p className="leading-relaxed text-red-300/90">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Google Login */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="group flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-white font-semibold text-gray-900 transition-all duration-200 hover:bg-gray-100 hover:shadow-lg hover:shadow-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            ) : (
              <>
                {/* Google Logo */}
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M21.35 12.23c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.42Z"
                    fill="#4285F4"
                  />

                  <path
                    d="M12 21.5c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.75 9.75 0 0 0 12 21.5Z"
                    fill="#34A853"
                  />

                  <path
                    d="M6.53 13.6A5.86 5.86 0 0 1 6.22 12c0-.56.1-1.1.31-1.6V7.87H3.28A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.03 4.13l3.25-2.53Z"
                    fill="#FBBC05"
                  />

                  <path
                    d="M12 6.37c1.43 0 2.7.49 3.71 1.45l2.78-2.78C16.84 3.39 14.63 2.5 12 2.5a9.75 9.75 0 0 0-8.72 5.37l3.25 2.53C7.3 8.09 9.46 6.37 12 6.37Z"
                    fill="#EA4335"
                  />
                </svg>

                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Security */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
            <span>🔒</span>
            <span>Secure admin authentication</span>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-600">
          PS5 Gaming Cafe Management System
        </p>
      </div>
    </main>
    </body>
    </html>

  );
}
