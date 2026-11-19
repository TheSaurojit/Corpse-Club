"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { toast as reactToast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  getAllBillsAction,
  deleteBillAction,
  BillRecord,
} from "@/actions/billing-actions";
import { formatCurrency } from "@/lib/pricing";

export default function AdminBillingPage() {
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Receipt Modal State
  const [receiptTarget, setReceiptTarget] = useState<BillRecord | null>(null);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<BillRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast
  const showToast = (message: string, type: "success" | "error" = "success") => {
    if (type === "success") {
      reactToast.success(message);
    } else {
      reactToast.error(message);
    }
  };

  // Load bills
  const loadData = async () => {
    setIsLoading(true);
    const billsRes = await getAllBillsAction();
    if (billsRes.success) {
      setBills(billsRes.bills);
    } else {
      showToast(billsRes.error || "Failed to load bills", "error");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // KPI Metrics
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalCash = 0;
    let totalOnline = 0;
    let todayRevenue = 0;
    const todayStr = new Date().toISOString().split("T")[0];

    bills.forEach((b) => {
      totalRevenue += b.totalAmount;
      totalCash += b.cashAmount;
      totalOnline += b.onlineAmount;
      const bDate = new Date(b.createdAt).toISOString().split("T")[0];
      if (bDate === todayStr) todayRevenue += b.totalAmount;
    });

    return { totalBills: bills.length, totalRevenue, totalCash, totalOnline, todayRevenue };
  }, [bills]);

  // Unique dates for filter
  const billDates = useMemo(() => {
    const dates = new Set<string>();
    bills.forEach((b) => dates.add(new Date(b.createdAt).toISOString().split("T")[0]));
    return ["all", ...Array.from(dates)];
  }, [bills]);

  // Filtered bills
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const matchesSearch =
        !searchQuery ||
        b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.customerName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || b.paymentStatus.toLowerCase() === statusFilter.toLowerCase();

      const bDate = new Date(b.createdAt).toISOString().split("T")[0];
      const matchesDate = dateFilter === "all" || bDate === dateFilter;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [bills, searchQuery, statusFilter, dateFilter]);

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await deleteBillAction(deleteTarget.id);
    if (res.success) {
      setBills((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      showToast(`Deleted Bill #${deleteTarget.id}`);
      setDeleteTarget(null);
    } else {
      showToast(res.error || "Failed to delete bill", "error");
    }
    setIsDeleting(false);
  };

  return (
    <div className="space-y-8">
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        theme="dark"
        style={{ zIndex: 999999 }}
      />

      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-purple-400">
              Counter Cashier & POS
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            <span className="text-xs text-gray-500">Live Ledger</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Billing & Invoices
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Generate receipts for PS5 gaming sessions, cafe food & drinks, and split transactions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#15151b] px-4 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            <span className={isLoading ? "animate-spin" : ""}>🔄</span>
            <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
          </button>

          <Link
            href="/admin/billing/create"
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:brightness-110"
          >
            <span className="text-base font-bold">+</span>
            <span>Create Billing</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Today's Total Billing
          </span>
          <p className="mt-2 text-2xl font-extrabold text-white">
            {formatCurrency(stats.todayRevenue)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <span className="text-xs font-medium uppercase tracking-wider text-purple-400">
            Total Bills Created
          </span>
          <p className="mt-2 text-2xl font-extrabold text-purple-400">{stats.totalBills}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
            Cash In Drawer
          </span>
          <p className="mt-2 text-2xl font-extrabold text-emerald-400">
            {formatCurrency(stats.totalCash)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <span className="text-xs font-medium uppercase tracking-wider text-blue-400">
            Online / UPI Bank Inflow
          </span>
          <p className="mt-2 text-2xl font-extrabold text-blue-400">
            {formatCurrency(stats.totalOnline)}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#15151b] px-3.5 py-2 text-xs font-semibold text-gray-300 focus:border-purple-500 focus:outline-none"
          >
            <option value="all">All Payment Statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#15151b] px-3.5 py-2 text-xs font-semibold text-gray-300 focus:border-purple-500 focus:outline-none"
          >
            <option value="all">All Billing Dates</option>
            {billDates
              .filter((d) => d !== "all")
              .map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Bill ID or Customer..."
            className="w-full rounded-xl border border-white/10 bg-[#15151b] px-4 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Bills Ledger Table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111116]/90 backdrop-blur-xl">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <p className="text-xs text-gray-400">Loading billing ledger...</p>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="text-4xl">🧾</span>
            <p className="text-sm font-semibold text-white">No bills found</p>
            <p className="max-w-md text-xs text-gray-500">
              {searchQuery || statusFilter !== "all" || dateFilter !== "all"
                ? "Try clearing your filters."
                : "No bills have been created yet. Click 'Create Billing' to generate one."}
            </p>
            {!searchQuery && statusFilter === "all" && dateFilter === "all" && (
              <Link
                href="/admin/billing/create"
                className="mt-2 flex h-9 items-center gap-2 rounded-xl bg-purple-600 px-4 text-xs font-bold text-white hover:bg-purple-500 transition"
              >
                <span>+</span>
                <span>Create Billing</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="border-b border-white/10 bg-[#15151b]/60 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-6 py-4">Bill ID & Customer</th>
                  <th className="px-6 py-4">Items Summary</th>
                  <th className="px-6 py-4">Payment Split</th>
                  <th className="px-6 py-4">Total Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Created By</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredBills.map((bill) => {
                  const bDate = new Date(bill.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={bill.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-purple-400">
                            {bill.id}
                          </span>
                        </div>
                        <div className="font-semibold text-white">{bill.customerName}</div>
                        <div className="text-[11px] text-gray-500">{bDate}</div>
                      </td>

                      <td className="px-6 py-4 text-xs">
                        {bill.sessions.length > 0 && (
                          <div className="text-purple-300">
                            🎮 {bill.sessions.length} PS5 Session{bill.sessions.length > 1 ? "s" : ""}
                          </div>
                        )}
                        {bill.items.length > 0 && (
                          <div className="text-amber-300">
                            ☕ {bill.items.length} Cafe Item{bill.items.length > 1 ? "s" : ""}
                          </div>
                        )}
                        {bill.discount > 0 && (
                          <div className="text-emerald-400">Discount: -₹{bill.discount}</div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs">
                        {bill.cashAmount > 0 && (
                          <div className="text-emerald-400 font-medium">
                            Cash: {formatCurrency(bill.cashAmount)}
                          </div>
                        )}
                        {bill.onlineAmount > 0 && (
                          <div className="text-blue-400 font-medium">
                            Online: {formatCurrency(bill.onlineAmount)}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-base font-extrabold text-white">
                          {formatCurrency(bill.totalAmount)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                            bill.paymentStatus === "paid"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : bill.paymentStatus === "partial"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}
                        >
                          {bill.paymentStatus}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs text-gray-400">
                        {bill.admin?.name || bill.createdByEmail || "Admin"}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReceiptTarget(bill)}
                            className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1.5 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/20"
                          >
                            Receipt
                          </button>
                          <Link
                            href={`/admin/billing/${bill.id}/edit`}
                            className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
                          >
                            ✏ Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(bill)}
                            className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Receipt Modal */}
      {receiptTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111116] p-6 shadow-2xl text-white">
            <div id="receipt-print-area" className="space-y-4 font-mono text-xs">
              <div className="text-center border-b border-white/10 pb-3">
                <h2 className="text-base font-extrabold tracking-widest text-white uppercase">
                  Corpse Club
                </h2>
                <p className="text-[10px] text-gray-400">Gaming Lounge & Cafe</p>
                <p className="mt-1 text-[11px] font-bold text-purple-400">
                  Receipt #{receiptTarget.id}
                </p>
                <p className="text-[10px] text-gray-500">
                  {new Date(receiptTarget.createdAt).toLocaleString("en-IN")}
                </p>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-400">Customer:</span>
                  <span className="font-bold text-white">{receiptTarget.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cashier:</span>
                  <span className="text-gray-300">
                    {receiptTarget.admin?.name || receiptTarget.createdByEmail || "Admin"}
                  </span>
                </div>
              </div>

              <div className="border-t border-b border-white/10 py-3 space-y-2">
                {receiptTarget.sessions.map((s, idx) => (
                  <div key={`s-${idx}`} className="flex justify-between text-[11px]">
                    <span>
                      {s.controller === "GTA 6"
                        ? `GTA 6 Pass (${s.duration}m) × ${s.quantity}`
                        : `PS5 ${s.controller} (${s.duration}m) × ${s.quantity}`}
                    </span>
                    <span className="font-semibold">{formatCurrency(s.total)}</span>
                  </div>
                ))}
                {receiptTarget.items.map((i, idx) => (
                  <div key={`i-${idx}`} className="flex justify-between text-[11px]">
                    <span>{i.name} × {i.quantity}</span>
                    <span className="font-semibold">{formatCurrency(i.total)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(receiptTarget.subtotal)}</span>
                </div>
                {receiptTarget.discount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount:</span>
                    <span>-{formatCurrency(receiptTarget.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-white pt-1 border-t border-white/10">
                  <span>Total Payable:</span>
                  <span>{formatCurrency(receiptTarget.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 pt-1">
                  <span>Cash Paid:</span>
                  <span>{formatCurrency(receiptTarget.cashAmount)}</span>
                </div>
                <div className="flex justify-between text-blue-400">
                  <span>Online / UPI Paid:</span>
                  <span>{formatCurrency(receiptTarget.onlineAmount)}</span>
                </div>
                <div className="flex justify-between text-gray-400 pt-1">
                  <span>Status:</span>
                  <span className="font-bold uppercase tracking-wider">
                    {receiptTarget.paymentStatus}
                  </span>
                </div>
              </div>

              <div className="text-center pt-3 border-t border-white/10 text-[10px] text-gray-500">
                <p>Thank you for playing at Corpse Club!</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setReceiptTarget(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500"
              >
                <span>🖨</span>
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#151214] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Delete Bill Record?</h3>
            <p className="mt-2 text-xs text-gray-400">
              Are you sure you want to delete Bill{" "}
              <span className="font-semibold text-white">#{deleteTarget.id}</span> for{" "}
              <span className="text-white">{deleteTarget.customerName}</span>?
            </p>
            <p className="mt-2 text-xs text-red-400/80">
              This will remove all associated line items and affect financial totals.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
