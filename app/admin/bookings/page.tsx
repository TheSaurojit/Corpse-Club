"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  getAllBookingsForAdminAction,
  updateBookingStatusAction,
  deleteBookingAction,
  AdminBookingRecord,
} from "@/actions/booking-actions";
import { getAdminSessionAction } from "@/actions/admin-auth";

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<AdminBookingRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Delete modal states
  const [deleteTarget, setDeleteTarget] = useState<AdminBookingRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch session and all bookings
  const loadBookings = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage("");

    try {
      const [session, bookingsRes] = await Promise.all([
        getAdminSessionAction(),
        getAllBookingsForAdminAction(),
      ]);

      if (session.isAuthenticated && session.email) {
        setAdminEmail(session.email);
      }

      if (bookingsRes.success && bookingsRes.bookings) {
        setBookings(bookingsRes.bookings);
      } else {
        setErrorMessage(bookingsRes.error || "Failed to load bookings from database.");
      }
    } catch (err: unknown) {
      console.error("Error loading bookings:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Error connecting to database."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  // Handle status update
  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    setUpdatingId(bookingId);
    try {
      const res = await updateBookingStatusAction(
        bookingId,
        newStatus,
        adminEmail || "admin@corpseclub.com"
      );
      if (res.success) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  status: newStatus,
                  updatedAt: new Date(),
                  updatedByEmail: adminEmail,
                  updatedBy: { email: adminEmail, name: "Admin" },
                }
              : b
          )
        );
      } else {
        alert(res.error || "Failed to update status.");
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Network error updating status.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle delete booking
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError("");

    try {
      const res = await deleteBookingAction(deleteTarget.id);
      if (res.success) {
        const deletedId = deleteTarget.id;
        setBookings((prev) => prev.filter((b) => b.id !== deleteTarget.id));
        setDeleteTarget(null);
        setToastMessage({
          type: "success",
          text: `Booking #${deletedId.slice(0, 8).toUpperCase()} was deleted successfully.`,
        });
        setTimeout(() => setToastMessage(null), 4500);
      } else {
        setDeleteError(res.error || "Failed to delete booking from database.");
      }
    } catch (err: unknown) {
      console.error("Failed to delete booking:", err);
      setDeleteError(err instanceof Error ? err.message : "Network error deleting booking.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Distinct booking dates sorted in descending order with slot count
  const distinctDates = useMemo(() => {
    const counts = new Map<string, number>();
    bookings.forEach((b) => {
      if (b.bookingDate) {
        counts.set(b.bookingDate, (counts.get(b.bookingDate) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[0].localeCompare(a[0])) // Descending order of date (latest first)
      .map(([date, count]) => ({ date, count }));
  }, [bookings]);

  // Filtered bookings sorted descending by booking date
  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        const matchesStatus =
          statusFilter === "all" ? true : b.status.toLowerCase() === statusFilter.toLowerCase();

        const matchesDate =
          dateFilter === "all" ? true : b.bookingDate === dateFilter;

        const query = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !query ||
          b.customerName.toLowerCase().includes(query) ||
          b.customerPhone.includes(query) ||
          (b.customerEmail && b.customerEmail.toLowerCase().includes(query)) ||
          b.id.toLowerCase().includes(query) ||
          b.bookingDate.includes(query);

        return matchesStatus && matchesDate && matchesSearch;
      })
      .sort((a, b) => {
        // Descending order of booking date (latest date first)
        const dateComp = b.bookingDate.localeCompare(a.bookingDate);
        if (dateComp !== 0) return dateComp;
        // Secondary: chronological or descending start time
        return b.startTime.localeCompare(a.startTime);
      });
  }, [bookings, statusFilter, dateFilter, searchQuery]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = bookings.length;
    const confirmed = bookings.filter((b) => b.status === "confirmed").length;
    const checkedIn = bookings.filter((b) => b.status === "checked_in").length;
    const completed = bookings.filter((b) => b.status === "completed").length;
    const revenue = bookings
      .filter((b) => b.status !== "cancelled")
      .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    return { total, confirmed, checkedIn, completed, revenue };
  }, [bookings]);

  // Helpers
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "checked_in":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "completed":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "cancelled":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-purple-400">
              Database Ledger
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            <span className="text-xs text-gray-500">Live Sync</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Bookings Ledger
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            View, search, and manage all player session reservations stored in Neon PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadBookings(true)}
            disabled={isRefreshing || isLoading}
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#15151b] px-4 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
            <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
          </button>

          <Link
            href="/book"
            target="_blank"
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:brightness-110"
          >
            <span>+</span>
            <span>New Booking</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Bookings */}
        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Bookings</span>
            <span className="text-lg">◷</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            {isLoading ? "—" : stats.total}
          </div>
          <div className="mt-1 text-xs text-gray-500">All registered sessions</div>
        </div>

        {/* Confirmed / Upcoming */}
        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-medium uppercase tracking-wider">Confirmed</span>
            <span className="text-lg">⏳</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            {isLoading ? "—" : stats.confirmed}
          </div>
          <div className="mt-1 text-xs text-amber-400/80">Upcoming & awaiting check-in</div>
        </div>

        {/* Checked In / Playing */}
        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between text-purple-400">
            <span className="text-xs font-medium uppercase tracking-wider">In Lounge</span>
            <span className="text-lg">🎮</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            {isLoading ? "—" : stats.checkedIn}
          </div>
          <div className="mt-1 text-xs text-purple-400/80">Active on PS5 pods</div>
        </div>

        {/* Gross Revenue */}
        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-medium uppercase tracking-wider">Gross Revenue</span>
            <span className="text-lg">₹</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            {isLoading ? "—" : `₹${stats.revenue.toLocaleString("en-IN")}`}
          </div>
          <div className="mt-1 text-xs text-emerald-400/80">From active reservations</div>
        </div>
      </div>

      {/* Error Alert if DB not connected */}
      {errorMessage && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span>
            <span>Database Connection Notice</span>
          </div>
          <p className="mt-1 text-xs text-red-300/80">{errorMessage}</p>
        </div>
      )}

      {/* Filters & Search Control Bar */}
      <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-4 backdrop-blur-xl space-y-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Box */}
          <div className="relative flex-1 md:max-w-xs">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search name, phone, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl border border-white/10 bg-[#15151b] pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Controls: Date Filter + Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Filter Group */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-gray-400 uppercase hidden sm:inline">Date:</span>
              <div className="relative">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="h-9 rounded-xl border border-white/10 bg-[#15151b] pl-3 pr-8 text-xs font-semibold text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer appearance-none"
                >
                  <option value="all">📅 All Dates ({bookings.length})</option>
                  {distinctDates.map(({ date, count }) => (
                    <option key={date} value={date}>
                      {date} ({count} {count === 1 ? 'booking' : 'bookings'})
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                  ▼
                </span>
              </div>

              {/* Direct Date Picker */}
              <input
                type="date"
                value={dateFilter !== 'all' ? dateFilter : ''}
                onChange={(e) => setDateFilter(e.target.value || 'all')}
                className="h-9 rounded-xl border border-white/10 bg-[#15151b] px-2 text-xs text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 [color-scheme:dark]"
                title="Pick exact date"
              />

              {/* Reset to All Dates if filtered */}
              {dateFilter !== 'all' && (
                <button
                  onClick={() => setDateFilter('all')}
                  className="h-9 px-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold hover:bg-purple-500/30 transition flex items-center gap-1"
                  title="Show all dates"
                >
                  <span>All Dates</span>
                  <span>✕</span>
                </button>
              )}
            </div>

            <div className="hidden lg:block h-5 w-px bg-white/10" />

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { label: "All", value: "all" },
                { label: "Confirmed", value: "confirmed" },
                { label: "Playing", value: "checked_in" },
                { label: "Completed", value: "completed" },
                { label: "Cancelled", value: "cancelled" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`h-9 rounded-lg px-2.5 text-xs font-semibold transition ${
                    statusFilter === tab.value
                      ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                      : "bg-[#15151b] text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active Filter Indicators Bar */}
        {(dateFilter !== "all" || statusFilter !== "all" || searchQuery) && (
          <div className="pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-gray-400">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-purple-400 font-bold text-[11px]">FILTER ACTIVE:</span>
              {dateFilter !== "all" && (
                <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px]">
                  Date: {dateFilter}
                </span>
              )}
              {statusFilter !== "all" && (
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white capitalize text-[11px]">
                  Status: {statusFilter}
                </span>
              )}
              {searchQuery && (
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white text-[11px]">
                  &quot;{searchQuery}&quot;
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setDateFilter("all");
                setStatusFilter("all");
                setSearchQuery("");
              }}
              className="text-[11px] text-purple-400 hover:underline cursor-pointer font-sans"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Bookings Ledger Table / Cards */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111116]/90 backdrop-blur-xl">
        {/* Table Header */}
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Reservations Table
            </h2>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-gray-400">
              {filteredBookings.length} records
            </span>
          </div>
          {searchQuery && (
            <span className="text-xs text-gray-500">
              Filtered by &quot;{searchQuery}&quot;
            </span>
          )}
        </div>

        {isLoading ? (
          /* Loading Skeleton */
          <div className="p-8 text-center space-y-3">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <p className="text-xs text-gray-400">Fetching bookings from Neon PostgreSQL...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-2xl">
              🎮
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">No Bookings Found</h3>
            <p className="mt-1 text-xs text-gray-400">
              {searchQuery || statusFilter !== "all" || dateFilter !== "all"
                ? "No reservations match your search or date filters. Try clearing filters."
                : "No customer reservations have been made yet. Use the booking modal on /book to create one."}
            </p>
            {(searchQuery || statusFilter !== "all" || dateFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setDateFilter("all");
                }}
                className="mt-4 rounded-xl bg-[#15151b] px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          /* Bookings List */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-white/[0.02] text-[11px] uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-6 py-3.5">
                    ID / Date <span className="text-purple-400 font-bold">↓ (Latest First)</span>
                  </th>
                  <th className="px-6 py-3.5">Player Details</th>
                  <th className="px-6 py-3.5">Session Time</th>
                  <th className="px-6 py-3.5">Hardware</th>
                  <th className="px-6 py-3.5">Amount</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredBookings.map((b) => {
                  // const whatsappUrl = `https://wa.me/91${b.customerPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  //   `Hi ${b.customerName}! Your Corpse Club PS5 reservation on ${b.bookingDate} (${b.startTime} - ${b.endTime}) is confirmed. We look forward to seeing you!`
                  // )}`;

                  return (
                    <tr
                      key={b.id}
                      className="transition-colors hover:bg-white/[0.02]"
                    >
                      {/* ID / Date */}
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-purple-400">
                          #{b.id.slice(0, 8).toUpperCase()}
                        </div>
                        <div className="mt-0.5 text-gray-400">{b.bookingDate}</div>
                        <div className="text-[10px] text-gray-600">
                          {new Date(b.createdAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>

                      {/* Customer Details */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{b.customerName}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-gray-400">
                          <span>📞</span>
                          <span>{b.customerPhone}</span>
                        </div>
                        {b.customerEmail && (
                          <div className="text-[11px] text-gray-500">{b.customerEmail}</div>
                        )}
                      </td>

                      {/* Session Time */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">
                          {b.startTime} – {b.endTime}
                        </div>
                        <div className="mt-0.5 text-gray-400">
                          {b.durationMins} minutes ({b.slots?.length || 1} slots)
                        </div>
                      </td>

                      {/* Hardware / Station */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-medium text-white">
                          <span>🎮</span>
                          <span>Station Pod 01</span>
                        </div>
                        <div className="mt-0.5 text-gray-400">
                          {b.controllers} {b.controllers === 1 ? "Controller" : "Controllers"}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-white sm:text-sm">
                          ₹{b.totalPrice}
                        </div>
                        <div className="text-[10px] text-emerald-400">Paid / Verified</div>
                      </td>

                      {/* Status Switcher */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={b.status}
                            disabled={updatingId === b.id}
                            onChange={(e) => handleStatusChange(b.id, e.target.value)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold focus:outline-none ${getStatusBadge(
                              b.status
                            )} bg-[#15151b] cursor-pointer`}
                          >
                            <option value="confirmed" className="bg-[#15151b] text-amber-400">
                              Confirmed
                            </option>
                            <option value="checked_in" className="bg-[#15151b] text-purple-400">
                              Playing (Checked In)
                            </option>
                            <option value="completed" className="bg-[#15151b] text-emerald-400">
                              Completed
                            </option>
                            <option value="cancelled" className="bg-[#15151b] text-red-400">
                              Cancelled
                            </option>
                          </select>
                          {updatingId === b.id && (
                            <span className="h-3 w-3 animate-spin rounded-full border border-purple-500 border-t-transparent" />
                          )}
                        </div>

                        {/* Audit trail */}
                        {b.updatedByEmail && (
                          <div
                            className="mt-1 text-[10px] text-gray-500"
                            title={`Updated by ${b.updatedByEmail} at ${new Date(
                              b.updatedAt
                            ).toLocaleTimeString()}`}
                          >
                            by {b.updatedBy?.name || b.updatedByEmail.split("@")[0]}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError("");
                            setDeleteTarget(b);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300 active:scale-95 cursor-pointer"
                          title="Delete this booking"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================================================= */}
      {/* DELETE CONFIRMATION POPUP (YES / NO) */}
      {/* ================================================= */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setDeleteTarget(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#121218] p-6 shadow-2xl shadow-red-950/50 text-white relative">
            {/* Warning Icon Badge */}
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 border border-red-500/30 text-2xl text-red-400">
              🗑️
            </div>

            {/* Title & Subtitle */}
            <div className="mt-4 text-center">
              <h3 id="delete-dialog-title" className="text-lg font-bold text-white">
                Delete This Booking?
              </h3>
              <p className="mt-1 text-xs text-gray-400">
                Are you sure you want to permanently delete this reservation?
              </p>
            </div>

            {/* Booking Details Box */}
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-gray-400">Booking ID:</span>
                <span className="font-mono font-bold text-purple-400">
                  #{deleteTarget.id.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Customer:</span>
                <span className="font-semibold text-white">
                  {deleteTarget.customerName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Phone:</span>
                <span className="font-mono text-gray-300">
                  {deleteTarget.customerPhone}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Date &amp; Time:</span>
                <span className="text-gray-200">
                  {deleteTarget.bookingDate} ({deleteTarget.startTime} – {deleteTarget.endTime})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Station / Controllers:</span>
                <span className="text-gray-200">
                  Station Pod 01 • {deleteTarget.controllers} {deleteTarget.controllers === 1 ? 'Controller' : 'Controllers'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-white/5 font-semibold">
                <span className="text-gray-400">Total Amount:</span>
                <span className="text-emerald-400">₹{deleteTarget.totalPrice}</span>
              </div>
            </div>

            {/* Warning Note */}
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-300">
              ⚠️ <strong>Warning:</strong> This cannot be undone. The booking will be deleted and its reserved time slots will immediately be released.
            </div>

            {/* Error Message */}
            {deleteError && (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/15 p-3 text-xs text-red-300">
                {deleteError}
              </div>
            )}

            {/* Action Buttons: No / Yes */}
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50 cursor-pointer"
              >
                No, Cancel
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 rounded-xl border border-red-500/40 bg-red-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-red-600/30 transition hover:bg-red-500 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-semibold shadow-2xl backdrop-blur-md transition-all ${
            toastMessage.type === "success"
              ? "border-emerald-500/30 bg-emerald-950/95 text-emerald-200 shadow-emerald-950/50"
              : "border-red-500/30 bg-red-950/95 text-red-200 shadow-red-950/50"
          }`}
        >
          <span>{toastMessage.type === "success" ? "✓" : "✕"}</span>
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-gray-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
