"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createMoneyAdjustmentAction } from "@/actions/adjustment-actions";
import { formatCurrency } from "@/lib/pricing";

const PRESET_REASONS_CASH_TO_ONLINE = [
  "Cash to Online (UPI Deposit)",
  "Admin / Owner Cash Swap",
  "Daily Cash Drawer Bank Deposit",
  "Counter Cash Surplus to Bank",
];

const PRESET_REASONS_ONLINE_TO_CASH = [
  "Counter Cash Float Top-up",
  "Online to Cash (Withdrawal)",
  "Emergency Drawer Replenishment",
  "Staff Float for Change",
];

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000, 5000];

export default function CreateAdjustmentPage() {
  const router = useRouter();

  // Direction mode
  const [mode, setMode] = useState<"cash_to_online" | "online_to_cash">("cash_to_online");

  // Form state
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("Cash to Online (UPI Deposit)");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Submission
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Success
  const [success, setSuccess] = useState(false);
  const [savedAmount, setSavedAmount] = useState(0);
  const [savedMode, setSavedMode] = useState<"cash_to_online" | "online_to_cash">("cash_to_online");
  const [savedReason, setSavedReason] = useState("");
  const [savedId, setSavedId] = useState<number | null>(null);

  const handleModeChange = (newMode: "cash_to_online" | "online_to_cash") => {
    setMode(newMode);
    // Reset reason to first preset for the selected direction
    if (newMode === "cash_to_online") {
      setReason(PRESET_REASONS_CASH_TO_ONLINE[0]);
    } else {
      setReason(PRESET_REASONS_ONLINE_TO_CASH[0]);
    }
  };

  const parsedAmount = Number(amount);
  const amountValid = parsedAmount > 0 && !isNaN(parsedAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!amountValid) {
      setFormError("Please enter a valid positive amount.");
      return;
    }

    if (!reason.trim()) {
      setFormError("Please specify a reason for this adjustment.");
      return;
    }

    const fromAccount = mode === "cash_to_online" ? "cash" : "online";
    const toAccount = mode === "cash_to_online" ? "online" : "cash";

    setIsSaving(true);
    try {
      const res = await createMoneyAdjustmentAction({
        type: "transfer",
        fromAccount,
        toAccount,
        amount: Math.round(parsedAmount),
        date,
        reason: reason.trim(),
        notes: notes.trim(),
      });

      if (res.success && res.adjustment) {
        setSavedAmount(Math.round(parsedAmount));
        setSavedMode(mode);
        setSavedReason(reason.trim());
        setSavedId(res.adjustment.id);
        setSuccess(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setFormError(res.error || "Failed to record money adjustment.");
      }
    } catch (err: unknown) {
      console.error("Error saving adjustment:", err);
      setFormError("A server error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSuccess(false);
    setAmount("");
    setReason(PRESET_REASONS_CASH_TO_ONLINE[0]);
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setMode("cash_to_online");
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const presetReasons =
    mode === "cash_to_online" ? PRESET_REASONS_CASH_TO_ONLINE : PRESET_REASONS_ONLINE_TO_CASH;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
            <Link href="/admin/adjustments" className="hover:underline flex items-center gap-1">
              ← Money Adjustments
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">New Transfer</span>
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse ml-1" />
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {success ? "Transfer Recorded ✓" : "New Money Transfer / Adjustment"}
          </h1>
          <p className="mt-1 text-xs text-gray-400">
            {success
              ? "The internal transfer has been logged to the passbook."
              : "Move funds between Cash Drawer and Online Bank/UPI without affecting sales or expenses."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/bank"
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#15151b] px-4 text-xs font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            <span>🏦</span>
            <span>Bank Passbook</span>
          </Link>
          <Link
            href="/admin/adjustments"
            className="flex h-10 items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/20"
          >
            <span>⇄</span>
            <span>All Adjustments</span>
          </Link>
        </div>
      </div>

      {/* ── SUCCESS VIEW ── */}
      {success ? (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 text-2xl font-bold">
                ⇄
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">Internal Transfer Recorded!</h3>
                <p className="text-xs text-purple-300/80">
                  Adjustment #{savedId} — {formatCurrency(savedAmount)} from{" "}
                  <strong>{savedMode === "cash_to_online" ? "Cash Drawer" : "Online Bank"}</strong> to{" "}
                  <strong>{savedMode === "cash_to_online" ? "Online Bank" : "Cash Drawer"}</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition hover:brightness-110"
              >
                <span>🏠</span>
                <span>Go to Home</span>
              </button>
              <Link
                href="/admin/bank"
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#15151b] px-4 py-2.5 text-xs font-semibold text-gray-300 hover:text-white transition"
              >
                <span>🏦</span>
                <span>Passbook</span>
              </Link>
            </div>
          </div>

          {/* Summary Card */}
          <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-2xl">
            <div className="text-center border-b border-white/10 pb-5">
              <h2 className="text-lg font-black uppercase tracking-[0.15em] text-white">
                Corpse Club
              </h2>
              <p className="text-[11px] text-gray-400">Internal Transfer Receipt</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1">
                <span className="text-xs font-bold text-purple-300">Adjustment #{savedId}</span>
              </div>
              <p className="mt-2 text-[10px] text-gray-500">
                {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>

            <div className="mt-5 space-y-4 text-xs font-mono">
              {/* Direction Visual */}
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#16161f] p-4">
                <div className="text-center">
                  <div className="text-2xl">{savedMode === "cash_to_online" ? "💵" : "🏦"}</div>
                  <div className="mt-1 text-[10px] font-bold text-gray-300">
                    {savedMode === "cash_to_online" ? "Cash Drawer" : "Online Bank"}
                  </div>
                  <div className="mt-0.5 text-[10px] text-red-400">− {formatCurrency(savedAmount)}</div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="text-purple-400 font-black text-xl">⇄</div>
                  <div className="text-[10px] text-gray-500">Transfer</div>
                </div>

                <div className="text-center">
                  <div className="text-2xl">{savedMode === "cash_to_online" ? "🏦" : "💵"}</div>
                  <div className="mt-1 text-[10px] font-bold text-gray-300">
                    {savedMode === "cash_to_online" ? "Online Bank" : "Cash Drawer"}
                  </div>
                  <div className="mt-0.5 text-[10px] text-emerald-400">+ {formatCurrency(savedAmount)}</div>
                </div>
              </div>

              <div className="space-y-2 border-b border-white/10 pb-4">
                <div className="flex justify-between text-gray-400">
                  <span>Amount Transferred:</span>
                  <span className="font-bold text-white text-base">{formatCurrency(savedAmount)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Reason:</span>
                  <span className="text-gray-200">{savedReason}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Date:</span>
                  <span className="text-gray-200">{date}</span>
                </div>
              </div>

              <div className="flex justify-between font-semibold text-gray-300 pt-1">
                <span>Total Business Liquidity Impact:</span>
                <span className="text-purple-300">₹0 (None)</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Revenue / Expense Impact:</span>
                <span className="text-gray-300">₹0 (None)</span>
              </div>

              <div className="text-center pt-3 text-[10px] text-gray-500">
                This is an internal contra entry. No sales or expense records were affected.
              </div>
            </div>

            {/* Post-success actions */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-purple-600 px-6 py-3 text-xs font-bold text-white shadow-lg transition hover:brightness-110"
              >
                <span>🏠</span>
                <span>Go to Home</span>
              </button>
              <div className="w-full sm:w-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#1a1a24] px-4 py-3 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  <span>🖨️</span>
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/20"
                >
                  <span>⇄</span>
                  <span>New Transfer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── CREATION FORM ── */
        <form onSubmit={handleSubmit}>
          {formError && (
            <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/15 p-4 text-xs font-semibold text-red-200">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-bold text-red-400">Cannot Record Adjustment</p>
                  <p className="text-red-300">{formError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormError("")}
                className="rounded-lg p-1.5 text-red-400 hover:bg-white/10"
              >
                ✕
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* LEFT: Form Inputs */}
            <div className="space-y-6 lg:col-span-7">

              {/* Step 1: Direction Selector */}
              <div className="rounded-2xl border border-white/10 bg-[#111116]/90 p-5 shadow-xl backdrop-blur-xl">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  1. Transfer Direction *
                </span>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleModeChange("cash_to_online")}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-5 text-center transition ${
                      mode === "cash_to_online"
                        ? "border-blue-500 bg-blue-500/15 shadow-lg shadow-blue-500/20"
                        : "border-white/10 bg-[#16161f] hover:border-white/20"
                    }`}
                  >
                    <span className="text-3xl">💵 ➔ 🏦</span>
                    <span className={`mt-2 text-sm font-bold ${mode === "cash_to_online" ? "text-blue-300" : "text-gray-400"}`}>
                      Cash to Online Bank
                    </span>
                    <span className="mt-1 text-[11px] text-gray-500">
                      e.g. Deposit counter cash into UPI / Bank
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange("online_to_cash")}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-5 text-center transition ${
                      mode === "online_to_cash"
                        ? "border-emerald-500 bg-emerald-500/15 shadow-lg shadow-emerald-500/20"
                        : "border-white/10 bg-[#16161f] hover:border-white/20"
                    }`}
                  >
                    <span className="text-3xl">🏦 ➔ 💵</span>
                    <span className={`mt-2 text-sm font-bold ${mode === "online_to_cash" ? "text-emerald-300" : "text-gray-400"}`}>
                      Online Bank to Cash
                    </span>
                    <span className="mt-1 text-[11px] text-gray-500">
                      e.g. Withdrawal to replenish counter float
                    </span>
                  </button>
                </div>
              </div>

              {/* Step 2: Amount */}
              <div className="rounded-2xl border border-white/10 bg-[#111116]/90 p-5 shadow-xl backdrop-blur-xl">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  2. Amount (₹) *
                </span>
                <div className="mt-4">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full rounded-xl border border-white/10 bg-[#15151b] px-4 py-3 text-2xl font-bold text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                  />

                  {/* Quick Amount Chips */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(String(amt))}
                        className={`rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition ${
                          Number(amount) === amt
                            ? "border-purple-500 bg-purple-500/20 text-white"
                            : "border-white/10 bg-[#1a1a24] text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 3: Reason */}
              <div className="rounded-2xl border border-white/10 bg-[#111116]/90 p-5 shadow-xl backdrop-blur-xl">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  3. Reason / Purpose *
                </span>
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Cash deposited to UPI account"
                    className="w-full rounded-xl border border-white/10 bg-[#15151b] px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                  />

                  {/* Preset Reason Pills */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {presetReasons.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReason(r)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] transition ${
                          reason === r
                            ? "border-purple-500/50 bg-purple-500/15 text-white"
                            : "border-white/5 bg-[#171722] text-gray-400 hover:border-purple-500/30 hover:text-white"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 4: Date & Notes */}
              <div className="rounded-2xl border border-white/10 bg-[#111116]/90 p-5 shadow-xl backdrop-blur-xl space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  4. Date & Notes
                </span>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#15151b] px-4 py-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Audit Notes / Remarks (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional context, e.g. 'Transferred by Saurov at 6PM for bank deposit run'..."
                    className="w-full rounded-xl border border-white/10 bg-[#15151b] px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* RIGHT: Summary Sidebar */}
            <div className="lg:col-span-5">
              <div className="sticky top-24 space-y-5">
                {/* Live Preview Card */}
                <div className="rounded-2xl border border-white/10 bg-[#111116]/90 p-6 shadow-2xl backdrop-blur-xl space-y-5">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400">
                      Transfer Preview
                    </h3>
                    <p className="text-xs text-gray-500">Live impact on account balances</p>
                  </div>

                  {/* Direction Visual */}
                  <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#16161f] p-4">
                    <div className="text-center">
                      <div className="text-2xl">{mode === "cash_to_online" ? "💵" : "🏦"}</div>
                      <div className="mt-1 text-[11px] font-bold text-gray-300">
                        {mode === "cash_to_online" ? "Cash Drawer" : "Online Bank"}
                      </div>
                      <div className={`mt-0.5 text-sm font-extrabold ${amountValid ? "text-red-400" : "text-gray-500"}`}>
                        − {amountValid ? formatCurrency(Math.round(parsedAmount)) : "₹0"}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <div className="text-purple-400 font-black text-2xl">⇄</div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl">{mode === "cash_to_online" ? "🏦" : "💵"}</div>
                      <div className="mt-1 text-[11px] font-bold text-gray-300">
                        {mode === "cash_to_online" ? "Online Bank" : "Cash Drawer"}
                      </div>
                      <div className={`mt-0.5 text-sm font-extrabold ${amountValid ? "text-emerald-400" : "text-gray-500"}`}>
                        + {amountValid ? formatCurrency(Math.round(parsedAmount)) : "₹0"}
                      </div>
                    </div>
                  </div>

                  {/* Impact Summary */}
                  <div className="space-y-2.5 text-xs border-b border-white/10 pb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">
                        {mode === "cash_to_online" ? "Cash Drawer Impact:" : "Online Bank Impact:"}
                      </span>
                      <span className={`font-bold ${amountValid ? "text-red-400" : "text-gray-500"}`}>
                        − {amountValid ? formatCurrency(Math.round(parsedAmount)) : "₹0"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">
                        {mode === "cash_to_online" ? "Online Bank Impact:" : "Cash Drawer Impact:"}
                      </span>
                      <span className={`font-bold ${amountValid ? "text-emerald-400" : "text-gray-500"}`}>
                        + {amountValid ? formatCurrency(Math.round(parsedAmount)) : "₹0"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-gray-400">Total Liquidity Change:</span>
                      <span className="font-bold text-purple-300">₹0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Revenue Impact:</span>
                      <span className="font-bold text-gray-300">₹0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Expense Impact:</span>
                      <span className="font-bold text-gray-300">₹0</span>
                    </div>
                  </div>

                  {/* Summary Details */}
                  <div className="space-y-1.5 text-xs text-gray-400">
                    <div className="flex items-start justify-between gap-2">
                      <span>Reason:</span>
                      <span className="text-gray-200 text-right max-w-[180px]">{reason || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Date:</span>
                      <span className="text-gray-200">{date}</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSaving || !amountValid}
                    className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-purple-500/25 transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? "Recording Transfer..." : "Confirm & Record Transfer"}
                  </button>
                  <p className="text-center text-[10px] text-gray-500">
                    This entry is logged in the passbook ledger as a contra adjustment.
                  </p>
                </div>

                {/* Info Box */}
                <div className="rounded-2xl border border-purple-500/15 bg-purple-500/5 p-4 text-xs text-gray-400 space-y-2">
                  <p className="font-bold text-purple-300 text-[11px] uppercase tracking-wider">
                    Why use this instead of Billing / Expense?
                  </p>
                  <p>
                    <strong className="text-white">Billing</strong> records customer revenue and inflates your sales figures.
                  </p>
                  <p>
                    <strong className="text-white">Expense</strong> records a cost and reduces your net profit.
                  </p>
                  <p>
                    <strong className="text-white">Money Adjustment</strong> is a pure internal transfer — it only shifts balances
                    between Cash and Online accounts. Total liquidity and profit remain unchanged.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
