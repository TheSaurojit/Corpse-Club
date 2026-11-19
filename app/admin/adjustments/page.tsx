"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  getAllAdjustmentsAction,
  createMoneyAdjustmentAction,
  deleteMoneyAdjustmentAction,
  MoneyAdjustmentRecord,
} from "@/actions/adjustment-actions";
import { formatCurrency } from "@/lib/pricing";

const PRESET_REASONS = [
  "Cash to Online (UPI Deposit)",
  "Admin / Owner Cash Swap",
  "Counter Cash Float Top-up",
  "Cash Drawer Reconciliation",
  "Emergency Drawer Withdrawal",
];

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

export default function AdminMoneyAdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<MoneyAdjustmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "cash_to_online" | "online_to_cash">("all");

  // Create Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<"cash_to_online" | "online_to_cash" | "custom">("cash_to_online");
  const [formData, setFormData] = useState({
    fromAccount: "cash",
    toAccount: "online",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    reason: "Cash to Online (UPI Deposit)",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState<MoneyAdjustmentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAdjustments = async () => {
    setIsLoading(true);
    const res = await getAllAdjustmentsAction();
    if (res.success) {
      setAdjustments(res.adjustments);
    } else {
      showToast(res.error || "Failed to load money adjustments", "error");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadAdjustments();
  }, []);

  // Update form direction when mode changes
  const handleModeChange = (newMode: "cash_to_online" | "online_to_cash" | "custom") => {
    setMode(newMode);
    if (newMode === "cash_to_online") {
      setFormData((prev) => ({
        ...prev,
        fromAccount: "cash",
        toAccount: "online",
        reason: prev.reason || "Cash to Online (UPI Deposit)",
      }));
    } else if (newMode === "online_to_cash") {
      setFormData((prev) => ({
        ...prev,
        fromAccount: "online",
        toAccount: "cash",
        reason: prev.reason || "Counter Cash Float Top-up",
      }));
    }
  };

  const handleOpenCreateModal = () => {
    setFormData({
      fromAccount: "cash",
      toAccount: "online",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      reason: "Cash to Online (UPI Deposit)",
      notes: "",
    });
    setMode("cash_to_online");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const parsedAmount = Number(formData.amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Please enter a valid positive amount.");
      return;
    }

    if (formData.fromAccount === formData.toAccount) {
      setFormError("Source and Destination accounts cannot be identical.");
      return;
    }

    if (!formData.reason.trim()) {
      setFormError("Please specify a reason for this adjustment.");
      return;
    }

    setIsSaving(true);
    const res = await createMoneyAdjustmentAction({
      type: "transfer",
      fromAccount: formData.fromAccount,
      toAccount: formData.toAccount,
      amount: parsedAmount,
      date: formData.date,
      reason: formData.reason,
      notes: formData.notes,
    });

    if (res.success) {
      showToast("Money adjustment recorded successfully!");
      setIsModalOpen(false);
      loadAdjustments();
    } else {
      setFormError(res.error || "Failed to create adjustment.");
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await deleteMoneyAdjustmentAction(deleteTarget.id);
    if (res.success) {
      showToast("Adjustment reversed and deleted successfully.");
      setDeleteTarget(null);
      loadAdjustments();
    } else {
      showToast(res.error || "Failed to delete adjustment.", "error");
    }
    setIsDeleting(false);
  };

  // KPI Calculations
  const stats = useMemo(() => {
    let cashToOnlineTotal = 0;
    let onlineToCashTotal = 0;

    adjustments.forEach((adj) => {
      const from = adj.fromAccount.toLowerCase();
      const to = adj.toAccount.toLowerCase();
      if (from === "cash" && to === "online") {
        cashToOnlineTotal += adj.amount;
      } else if (from === "online" && to === "cash") {
        onlineToCashTotal += adj.amount;
      }
    });

    // Net shift into Cash drawer
    const netDrawerShift = onlineToCashTotal - cashToOnlineTotal;

    return {
      cashToOnlineTotal,
      onlineToCashTotal,
      netDrawerShift,
      totalCount: adjustments.length,
    };
  }, [adjustments]);

  // Filtered adjustments
  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((adj) => {
      const from = adj.fromAccount.toLowerCase();
      const to = adj.toAccount.toLowerCase();

      // Direction Filter
      if (directionFilter === "cash_to_online" && !(from === "cash" && to === "online")) {
        return false;
      }
      if (directionFilter === "online_to_cash" && !(from === "online" && to === "cash")) {
        return false;
      }

      // Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesReason = adj.reason?.toLowerCase().includes(q);
        const matchesNotes = adj.notes?.toLowerCase().includes(q);
        const matchesAdmin =
          adj.admin?.name?.toLowerCase().includes(q) ||
          adj.admin?.email?.toLowerCase().includes(q) ||
          adj.createdByEmail?.toLowerCase().includes(q);
        const matchesRef = `adj-${adj.id}`.includes(q);

        return matchesReason || matchesNotes || matchesAdmin || matchesRef;
      }

      return true;
    });
  }, [adjustments, directionFilter, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl transition-all ${
            toast.type === "error"
              ? "border border-red-500/30 bg-red-950/90 text-red-200"
              : "border border-emerald-500/30 bg-emerald-950/90 text-emerald-200"
          }`}
        >
          <span>{toast.type === "error" ? "⚠️" : "✓"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-purple-400">
              Treasury & Accounts
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            <span className="text-xs text-gray-500">Internal Transfers & Drawer Balancing</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Money Adjustments
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Shift funds between Cash Drawer and Online Bank/UPI without generating fake sales bills or distorted expense costs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/bank"
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#15151b] px-4 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            <span>🏦</span>
            <span>View Bank Passbook</span>
          </Link>

          <Link
            href="/admin/adjustments/create"
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 text-xs font-bold text-white shadow-lg shadow-purple-600/30 transition hover:from-purple-500 hover:to-indigo-500"
          >
            <span className="text-sm">⇄</span>
            <span>New Adjustment</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Cash Deposited to Online */}
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-[#121624] to-[#0c0e18] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Cash ➔ Online Bank
            </span>
            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
              Deposited
            </span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-white">
            {formatCurrency(stats.cashToOnlineTotal)}
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Cash taken from drawer and put into online UPI/Bank
          </p>
        </div>

        {/* Card 2: Online Withdrawn to Cash */}
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-[#0e1f18] to-[#0a1410] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Online ➔ Cash Drawer
            </span>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              Withdrawn / Float
            </span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-white">
            {formatCurrency(stats.onlineToCashTotal)}
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Online money withdrawn to replenish counter change
          </p>
        </div>

        {/* Card 3: Net Cash Drawer Shift */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[#1a1429] to-[#0f0c18] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Net Drawer Shift
            </span>
            <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
              Transfer Impact
            </span>
          </div>
          <div
            className={`mt-3 text-2xl font-extrabold ${
              stats.netDrawerShift >= 0 ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {stats.netDrawerShift >= 0 ? "+" : ""}
            {formatCurrency(stats.netDrawerShift)}
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            {stats.netDrawerShift <= 0
              ? `${formatCurrency(Math.abs(stats.netDrawerShift))} net moved out to online`
              : `${formatCurrency(stats.netDrawerShift)} net added to cash drawer`}
          </p>
        </div>

        {/* Card 4: Total Adjustments Count */}
        <div className="rounded-2xl border border-white/10 bg-[#121217] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Transfers Logged
            </span>
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-gray-300">
              Count
            </span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-white">
            {stats.totalCount}
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Total non-revenue/expense contra adjustments
          </p>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Direction Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDirectionFilter("all")}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              directionFilter === "all"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "border border-white/10 bg-[#15151b] text-gray-400 hover:text-white"
            }`}
          >
            All Transfers
          </button>

          <button
            type="button"
            onClick={() => setDirectionFilter("cash_to_online")}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              directionFilter === "cash_to_online"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "border border-white/10 bg-[#15151b] text-gray-400 hover:text-white"
            }`}
          >
            💵 ➔ 🏦 Cash to Online
          </button>

          <button
            type="button"
            onClick={() => setDirectionFilter("online_to_cash")}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              directionFilter === "online_to_cash"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                : "border border-white/10 bg-[#15151b] text-gray-400 hover:text-white"
            }`}
          >
            🏦 ➔ 💵 Online to Cash
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reason, admin, or notes..."
            className="w-full rounded-xl border border-white/10 bg-[#15151b] px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
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

      {/* Adjustments Table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111116]/90 backdrop-blur-xl">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <p className="text-xs text-gray-400">Loading adjustments...</p>
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="text-4xl">⇄</span>
            <p className="text-sm font-semibold text-white">No money adjustments found</p>
            <p className="max-w-md text-xs text-gray-500">
              {searchQuery || directionFilter !== "all"
                ? "Try clearing your search query or filter selection."
                : "No transfers logged yet. Click 'New Adjustment' above to move funds between Cash and Online."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="border-b border-white/10 bg-[#15151b]/60 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-6 py-4">Transfer Direction</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Reason & Notes</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Logged By</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAdjustments.map((adj) => {
                  const isCashToOnline =
                    adj.fromAccount.toLowerCase() === "cash" && adj.toAccount.toLowerCase() === "online";
                  const isOnlineToCash =
                    adj.fromAccount.toLowerCase() === "online" && adj.toAccount.toLowerCase() === "cash";

                  return (
                    <tr key={adj.id} className="transition hover:bg-white/[0.02]">
                      {/* Direction */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                              isCashToOnline
                                ? "border border-blue-500/30 bg-blue-500/10 text-blue-300"
                                : isOnlineToCash
                                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : "border border-purple-500/30 bg-purple-500/10 text-purple-300"
                            }`}
                          >
                            <span>{adj.fromAccount === "cash" ? "💵 Cash" : "🏦 Online"}</span>
                            <span>➔</span>
                            <span>{adj.toAccount === "online" ? "🏦 Online" : "💵 Cash"}</span>
                          </span>
                          <span className="text-[10px] text-gray-500">#{adj.id}</span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-white text-base">
                          {formatCurrency(adj.amount)}
                        </span>
                      </td>

                      {/* Reason & Notes */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{adj.reason}</div>
                        {adj.notes && <div className="text-xs text-gray-400 mt-0.5">{adj.notes}</div>}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-xs text-gray-300">
                        {adj.date}
                      </td>

                      {/* Logged By */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-0.5 text-xs text-gray-300">
                          <span>👤</span>
                          <span>{adj.admin?.name || adj.createdByEmail || "Admin"}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(adj)}
                          className="rounded-lg p-2 text-xs font-semibold text-gray-500 transition hover:bg-red-500/10 hover:text-red-400"
                          title="Delete / Reverse Adjustment"
                        >
                          🗑
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

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121217] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Record Money Adjustment</h3>
                <p className="text-xs text-gray-400">
                  Transfer funds internally without affecting sales bills or expenses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="mt-5 space-y-4">
              {formError && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
                  ⚠️ {formError}
                </div>
              )}

              {/* Transfer Mode Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Transfer Direction
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleModeChange("cash_to_online")}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                      mode === "cash_to_online"
                        ? "border-blue-500 bg-blue-500/15 text-white"
                        : "border-white/10 bg-[#16161f] text-gray-400 hover:border-white/20"
                    }`}
                  >
                    <span className="text-lg">💵 ➔ 🏦</span>
                    <span className="mt-1 text-xs font-bold text-blue-300">Cash to Online</span>
                    <span className="text-[10px] text-gray-500">e.g. Deposit cash to UPI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange("online_to_cash")}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                      mode === "online_to_cash"
                        ? "border-emerald-500 bg-emerald-500/15 text-white"
                        : "border-white/10 bg-[#16161f] text-gray-400 hover:border-white/20"
                    }`}
                  >
                    <span className="text-lg">🏦 ➔ 💵</span>
                    <span className="mt-1 text-xs font-bold text-emerald-300">Online to Cash</span>
                    <span className="text-[10px] text-gray-500">e.g. Replenish change float</span>
                  </button>
                </div>
              </div>

              {/* Amount Input & Quick Chips */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="e.g. 50"
                  className="w-full rounded-xl border border-white/10 bg-[#16161f] px-4 py-2.5 text-base font-bold text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                />

                {/* Quick Add Chips */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setFormData({ ...formData, amount: String(amt) })}
                      className="rounded-lg border border-white/10 bg-[#1a1a24] px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-white/10"
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason Presets & Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Reason / Purpose *
                </label>
                <input
                  type="text"
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g. Cash deposited to UPI"
                  className="w-full rounded-xl border border-white/10 bg-[#16161f] px-4 py-2 text-xs text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                />

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRESET_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormData({ ...formData, reason: r })}
                      className="rounded-lg border border-white/5 bg-[#171722] px-2 py-0.5 text-[11px] text-gray-400 hover:border-purple-500/30 hover:text-white"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#16161f] px-4 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Notes / Audit Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional context about this transaction..."
                  className="w-full rounded-xl border border-white/10 bg-[#16161f] px-4 py-2 text-xs text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Financial Balance Impact Summary */}
              <div className="rounded-xl border border-white/10 bg-[#161622] p-3 text-xs">
                <div className="font-semibold text-gray-300">Ledger Impact Preview:</div>
                <div className="mt-1 flex items-center justify-between text-gray-400">
                  <span>Cash Drawer:</span>
                  <span className={mode === "cash_to_online" ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                    {mode === "cash_to_online" ? `-${formData.amount ? `₹${formData.amount}` : "₹0"}` : `+${formData.amount ? `₹${formData.amount}` : "₹0"}`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Online Bank / UPI:</span>
                  <span className={mode === "cash_to_online" ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {mode === "cash_to_online" ? `+${formData.amount ? `₹${formData.amount}` : "₹0"}` : `-${formData.amount ? `₹${formData.amount}` : "₹0"}`}
                  </span>
                </div>
                <div className="mt-1 border-t border-white/10 pt-1 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Sales & Expense Impact:</span>
                  <span className="text-gray-300 font-medium">₹0 (Untouched)</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-300 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-purple-500 disabled:opacity-50"
                >
                  {isSaving ? "Recording..." : "Confirm & Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121217] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Reverse & Delete Adjustment?</h3>
            <p className="mt-2 text-xs text-gray-400">
              Are you sure you want to delete this adjustment of{" "}
              <strong className="text-white">{formatCurrency(deleteTarget.amount)}</strong> (
              {deleteTarget.fromAccount} ➔ {deleteTarget.toAccount})? This will undo the balance transfer in the passbook ledger.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-300 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {isDeleting ? "Reversing..." : "Delete & Reverse"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
