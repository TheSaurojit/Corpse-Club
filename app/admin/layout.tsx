
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
    <html>
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-600">
                    <span className="text-xl">
                      🎮
                    </span>
                  </div>

                  <div>
                    <h1 className="font-bold text-white">
                      GameZone
                    </h1>

                    <p className="text-[10px] uppercase tracking-widest text-gray-500">
                      Admin Panel
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
                <div className="flex items-center gap-3">

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
