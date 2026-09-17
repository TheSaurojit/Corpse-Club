
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getAdminSessionAction, logoutAdminAction } from "@/actions/admin-auth";
import "./globals.css";

interface AdminLayoutProps {
  children: ReactNode;
}

const navigation = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: "▦",
  },
  {
    name: "Bookings",
    href: "/admin/bookings",
    icon: "◷",
  },
  // {
  //   name: "Stations",
  //   href: "/admin/stations",
  //   icon: "▣",
  // },
  // {
  //   name: "Customers",
  //   href: "/admin/customers",
  //   icon: "♙",
  // },
  // {
  //   name: "Revenue",
  //   href: "/admin/revenue",
  //   icon: "₹",
  // },
];

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [showProfile, setShowProfile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState<string>("");
  const [adminEmail, setAdminEmail] = useState<string>("");

  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    getAdminSessionAction().then((session) => {
      if (session.isAuthenticated) {
        setAdminName(session.name || "Admin");
        setAdminEmail(session.email || "");
      } else {
        router.push("/login");
      }
    });
  }, [router]);

  // Register PWA Service Worker & detect installability
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Admin PWA Service Worker active with scope:", reg.scope);
        })
        .catch((err) => {
          console.error("Admin Service Worker registration failed:", err);
        });
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    window.addEventListener("appinstalled", () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowInstallModal(false);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const handleLogout = async () => {
    setShowProfile(false);
    try {
      await signOut(auth);
    } catch {}
    await logoutAdminAction();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }

    return pathname.startsWith(href);
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Corpse Club Admin</title>
        <meta name="description" content="Corpse Club Gaming Lounge Admin &amp; Bookings Management" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        {/* PWA Manifest & Icons */}
        <link rel="manifest" href="/manifest-admin.json" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" />
        <link rel="shortcut icon" href="/icons/icon-192x192.png" />

        {/* Theme Colors for Mobile Browser Status Bars */}
        <meta name="theme-color" content="#08080c" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#08080c" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#08080c" />

        {/* iOS Safari Standalone Web App Meta */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CC Admin" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512x512.png" />

        {/* General Mobile / Windows */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="CC Admin" />
        <meta name="msapplication-TileColor" content="#08080c" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body>

        <div className="min-h-screen bg-[#08080c] text-white">

          {/* Background */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-purple-600/10 blur-[140px]" />

            <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[140px]" />
          </div>

          <div className="relative flex min-h-screen">

            {/* ================================================= */}
            {/* MOBILE SIDEBAR OVERLAY */}
            {/* ================================================= */}

            {sidebarOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/60 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* ================================================= */}
            {/* SIDEBAR */}
            {/* ================================================= */}

            <aside
              className={`
            fixed inset-y-0 left-0 z-50
            flex w-64 flex-col
            border-r border-white/10
            bg-[#0d0d12]
            transition-transform duration-300
            lg:static lg:translate-x-0
            ${sidebarOpen
                  ? "translate-x-0"
                  : "-translate-x-full"
                }
          `}
            >

              {/* Logo */}
              <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-6">

                <Link
                  href="/admin"
                  className="flex items-center gap-3"
                  onClick={() => setSidebarOpen(false)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-purple-700 shadow-md shadow-red-950/40">
                    <span className="text-xl">
                      🎮
                    </span>
                  </div>

                  <div>
                    <h1 className="font-bold text-white tracking-tight">
                      Corpse Club
                    </h1>

                    <p className="text-[10px] uppercase tracking-widest text-red-400 font-mono">
                      Admin Portal
                    </p>
                  </div>
                </Link>

                {/* Mobile close */}
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-xl text-gray-500 hover:text-white lg:hidden"
                >
                  ×
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 space-y-1 overflow-y-auto p-4">

                <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                  Management
                </p>

                {navigation.map((item) => {
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                    flex w-full items-center gap-3
                    rounded-xl px-4 py-3
                    text-sm font-medium
                    transition-all
                    ${active
                          ? "bg-purple-500/15 text-purple-400"
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                        }
                  `}
                    >
                      <span className="flex w-5 justify-center text-lg">
                        {item.icon}
                      </span>

                      {item.name}
                    </Link>
                  );
                })}

                {/* System */}
                {/* <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                  System
                </p> */}

                {/* <Link
                  href="/admin/settings"
                  onClick={() => setSidebarOpen(false)}
                  className={`
                flex w-full items-center gap-3
                rounded-xl px-4 py-3
                text-sm font-medium
                transition-all
                ${isActive("/admin/settings")
                      ? "bg-purple-500/15 text-purple-400"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }
              `}
                >
                  <span className="w-5 text-center text-lg">
                    ⚙
                  </span>

                  Settings
                </Link> */}
              </nav>

              {/* Install PWA Widget */}
              {!isStandalone && (
                <div className="mx-4 mb-2 rounded-xl border border-purple-500/25 bg-gradient-to-b from-purple-500/10 to-transparent p-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 text-base">
                      📱
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Mobile App</p>
                      <p className="text-[10px] text-gray-400">Install to phone</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="mt-2.5 w-full rounded-lg bg-purple-600 px-3 py-1.5 text-center text-xs font-semibold text-white shadow-md shadow-purple-600/30 transition hover:bg-purple-500 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Install App</span>
                    <span>↗</span>
                  </button>
                </div>
              )}

              {/* Cafe Status */}
              <div className="m-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">

                <div className="flex items-center gap-2">

                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />

                  <span className="text-xs font-medium text-emerald-400">
                    Cafe is Open
                  </span>

                </div>

                <p className="mt-2 text-[11px] text-gray-500">
                  Today · 10:00 AM - 11:00 PM
                </p>

              </div>
            </aside>

            {/* ================================================= */}
            {/* MAIN */}
            {/* ================================================= */}

            <div className="flex min-w-0 flex-1 flex-col">

              {/* Header */}
              <header className="sticky top-0 z-30 flex h-20 shrink-0 items-center justify-between border-b border-white/10 bg-[#0d0d12]/90 px-5 backdrop-blur-xl md:px-8">

                {/* Left */}
                <div className="flex items-center gap-4">

                  {/* Mobile menu */}
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-gray-400 hover:text-white lg:hidden"
                  >
                    ☰
                  </button>

                  <div>
                    <h2 className="text-xl font-bold">
                      {getPageTitle(pathname)}
                    </h2>

                    <p className="mt-1 text-xs text-gray-500">
                      Manage your gaming cafe
                    </p>
                  </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-2 sm:gap-3">

                  {/* PWA Install Button */}
                  {!isStandalone && (
                    <button
                      type="button"
                      onClick={handleInstallClick}
                      className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/15 px-3 py-2 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/25 hover:border-purple-500/50 cursor-pointer shadow-sm shadow-purple-950/40"
                      title="Install app to phone home screen"
                    >
                      <span className="text-sm">📲</span>
                      <span className="hidden sm:inline">Install App</span>
                      <span className="sm:hidden">Install</span>
                    </button>
                  )}

                  {/* Notification */}
                  <button
                    className="
                  relative flex h-10 w-10
                  items-center justify-center
                  rounded-xl border border-white/10
                  bg-white/[0.03]
                  text-gray-400
                  hover:bg-white/10
                  hover:text-white
                "
                  >
                    <span className="text-lg">
                      ♢
                    </span>

                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-purple-500" />
                  </button>

                  {/* Profile */}
                  <div className="relative">

                    <button
                      onClick={() =>
                        setShowProfile(!showProfile)
                      }
                      className="flex items-center gap-3"
                    >

                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-medium text-white">
                          {adminName || "Admin"}
                        </p>

                        <p className="text-[11px] text-gray-500 truncate max-w-[140px]" title={adminEmail}>
                          {adminEmail || "Administrator"}
                        </p>
                      </div>

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 font-bold uppercase">
                        {(adminName || "A")[0]}
                      </div>

                    </button>

                    {/* Dropdown */}
                    {showProfile && (
                      <div className="absolute right-0 top-14 z-50 w-48 rounded-xl border border-white/10 bg-[#15151b] p-2 shadow-2xl">

                        <Link
                          href="/admin/settings"
                          onClick={() =>
                            setShowProfile(false)
                          }
                          className="block rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
                        >
                          Profile
                        </Link>

                        <Link
                          href="/admin/settings"
                          onClick={() =>
                            setShowProfile(false)
                          }
                          className="block rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
                        >
                          Settings
                        </Link>

                        <div className="my-1 border-t border-white/10" />

                        <button
                          onClick={handleLogout}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition flex items-center justify-between"
                        >
                          <span>Logout</span>
                          <span>⏻</span>
                        </button>

                      </div>
                    )}

                  </div>
                </div>
              </header>

              {/* ================================================= */}
              {/* PAGE CONTENT */}
              {/* ================================================= */}

              <main className="flex-1 p-5 md:p-8">
                {children}
              </main>

            </div>
          </div>
        </div>

        {/* ================================================= */}
        {/* PWA INSTALL GUIDE MODAL (FOR PHONES / IOS / ANDROID) */}
        {/* ================================================= */}
        {showInstallModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowInstallModal(false);
              }
            }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-purple-500/30 bg-[#121218] p-6 shadow-2xl shadow-purple-950/50 text-white relative">
              {/* App Icon */}
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-purple-700 text-2xl shadow-lg shadow-purple-900/50">
                🎮
              </div>

              {/* Title & Subtitle */}
              <div className="mt-4 text-center">
                <h3 id="pwa-install-title" className="text-lg font-bold text-white">
                  Install Corpse Club Admin
                </h3>
                <p className="mt-1 text-xs text-gray-400">
                  Add to your home screen for quick 1-tap access with zero browser bars.
                </p>
              </div>

              {/* Step-by-step instructions */}
              {isIOS ? (
                /* iOS Safari Instructions */
                <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs">
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[11px] font-bold text-purple-300">
                      1
                    </span>
                    <p className="text-gray-300">
                      In <strong className="text-white">Safari</strong>, tap the <strong className="text-purple-300">Share</strong> button at the bottom of the screen:
                      <span className="ml-1 inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-mono text-white">
                        ⎙ / ⬆
                      </span>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[11px] font-bold text-purple-300">
                      2
                    </span>
                    <p className="text-gray-300">
                      Scroll down the list and tap <strong className="text-white">&quot;Add to Home Screen&quot;</strong>:
                      <span className="ml-1 inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-mono text-white">
                        [+]
                      </span>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[11px] font-bold text-purple-300">
                      3
                    </span>
                    <p className="text-gray-300">
                      Tap <strong className="text-purple-300">&quot;Add&quot;</strong> in the top right corner. The Corpse Club Admin icon will appear right on your home screen!
                    </p>
                  </div>
                </div>
              ) : (
                /* Android / Chrome Instructions */
                <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs">
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[11px] font-bold text-purple-300">
                      1
                    </span>
                    <p className="text-gray-300">
                      Tap the <strong className="text-purple-300">three dots menu</strong> (⋮) in the top-right corner of Chrome.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[11px] font-bold text-purple-300">
                      2
                    </span>
                    <p className="text-gray-300">
                      Select <strong className="text-white">&quot;Install app&quot;</strong> or <strong className="text-white">&quot;Add to Home screen&quot;</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[11px] font-bold text-purple-300">
                      3
                    </span>
                    <p className="text-gray-300">
                      Tap <strong className="text-purple-300">&quot;Install&quot;</strong> to confirm. The app will install directly onto your phone!
                    </p>
                  </div>
                </div>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="mt-5 w-full rounded-xl bg-purple-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-purple-600/30 transition hover:bg-purple-500 cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}

      </body>

    </html>
  );
}

/* ================================================= */
/* PAGE TITLE */
/* ================================================= */

function getPageTitle(pathname: string) {
  if (pathname === "/admin") {
    return "Dashboard";
  }

  if (pathname.startsWith("/admin/bookings")) {
    return "Bookings";
  }

  if (pathname.startsWith("/admin/stations")) {
    return "Stations";
  }

  if (pathname.startsWith("/admin/customers")) {
    return "Customers";
  }

  if (pathname.startsWith("/admin/revenue")) {
    return "Revenue";
  }

  if (pathname.startsWith("/admin/settings")) {
    return "Settings";
  }

  return "Admin";
}
