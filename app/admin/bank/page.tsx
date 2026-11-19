"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getBankLedgerAction, BankLedgerData, PassbookEntry } from "@/actions/finance-actions";
import { formatCurrency } from "@/lib/pricing";

export default function AdminBankLedgerPage() {
  const [ledger, setLedger] = useState<BankLedgerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [channelFilter, setChannelFilter] = useState<"all" | "online" | "cash">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadLedger = async () => {
    setIsLoading(true);
    const res = await getBankLedgerAction();
    if (res.success && res.ledger) {
      setLedger(res.ledger);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadLedger();
  }, []);

  // Filtered passbook entries
  const filteredEntries = useMemo(() => {
    if (!ledger) return [];

    return ledger.entries.filter((entry) => {
      const matchesChannel = channelFilter === "all" || entry.channel === channelFilter;
      const matchesType = typeFilter === "all" || entry.type === typeFilter;
      const matchesSearch =
        !searchQuery ||
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.referenceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.subtitle && entry.subtitle.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesChannel && matchesType && matchesSearch;
    });
  }, [ledger, channelFilter, typeFilter, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
              Treasury & Accounts
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-500">Bank & Cash Passbook</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Bank & Cashbook Ledger
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Real-time balance reconciliation for Bank (Online / UPI) and Cash in Drawer across all billing & expenses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/adjustments"
            className="flex h-10 items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/20"
          >
            <span>⇄</span>
            <span>Transfer / Adjust</span>
          </Link>

          <button
            type="button"
            onClick={loadLedger}
            disabled={isLoading}
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#15151b] px-4 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            <span className={isLoading ? "animate-spin" : ""}>🔄</span>
            <span>{isLoading ? "Syncing..." : "Sync Accounts"}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-10 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <span>🖨</span>
            <span>Print Passbook</span>
          </button>
        </div>
      </div>

      {/* Account Balance Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* 1. Online / Bank Account Card */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-[#121624] to-[#0c0e18] p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
              <span className="text-base">🏦</span> Online Bank Account
            </span>
            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
              UPI & NetBanking
            </span>
          </div>

          <div className="mt-4">
            <span className="text-xs text-gray-400">Current Net Balance</span>
            <p className="mt-1 text-3xl font-black tracking-tight text-white">
              {formatCurrency(ledger?.onlineBalance || 0)}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs">
            <div>
              <span className="text-gray-400">Inflow (+):</span>{" "}
              <span className="font-semibold text-emerald-400">
                {formatCurrency(ledger?.onlineInflow || 0)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Outflow (-):</span>{" "}
              <span className="font-semibold text-red-400">
                {formatCurrency(ledger?.onlineOutflow || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Cash in Hand Drawer Card */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-[#12221b] to-[#0c1410] p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <span className="text-base">💵</span> Cash in Drawer
            </span>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              Physical Cash Register
            </span>
          </div>

          <div className="mt-4">
            <span className="text-xs text-gray-400">Current Net Cash in Hand</span>
            <p className="mt-1 text-3xl font-black tracking-tight text-white">
              {formatCurrency(ledger?.cashBalance || 0)}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs">
            <div>
              <span className="text-gray-400">Inflow (+):</span>{" "}
              <span className="font-semibold text-emerald-400">
                {formatCurrency(ledger?.cashInflow || 0)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Outflow (-):</span>{" "}
              <span className="font-semibold text-red-400">
                {formatCurrency(ledger?.cashOutflow || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Combined Total Liquidity */}
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[#1a1426] to-[#0f0c16] p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
              <span className="text-base">💼</span> Total Liquidity
            </span>
            <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
              Bank + Cash
            </span>
          </div>

          <div className="mt-4">
            <span className="text-xs text-gray-400">Total Liquid Business Funds</span>
            <p className="mt-1 text-3xl font-black tracking-tight text-purple-300">
              {formatCurrency(ledger?.totalLiquidity || 0)}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-gray-400">
            <div>
              <span>Bills Processed:</span>{" "}
              <span className="font-semibold text-white">{ledger?.totalBillsCount || 0}</span>
            </div>
            <div>
              <span>Expenses Paid:</span>{" "}
              <span className="font-semibold text-white">{ledger?.totalExpensesCount || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Account Channel Tabs */}
          <div className="flex rounded-xl border border-white/10 bg-[#15151b] p-1">
            <button
              type="button"
              onClick={() => setChannelFilter("all")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                channelFilter === "all"
                  ? "bg-emerald-500 text-black shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              All Channels
            </button>
            <button
              type="button"
              onClick={() => setChannelFilter("online")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                channelFilter === "online"
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              🏦 Bank (Online)
            </button>
            <button
              type="button"
              onClick={() => setChannelFilter("cash")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                channelFilter === "cash"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              💵 Cash Drawer
            </button>
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="rounded-xl border border-white/10 bg-[#15151b] px-3.5 py-1.5 text-xs font-semibold text-gray-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Inflow & Outflow</option>
            <option value="income">Credit Inflow (Billing Only)</option>
            <option value="expense">Debit Outflow (Expenses Only)</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions..."
            className="w-full rounded-xl border border-white/10 bg-[#15151b] px-4 py-2 text-xs text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
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

      {/* Unified Bank Passbook Ledger Table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111116]/90 backdrop-blur-xl">
        <div className="border-b border-white/10 bg-[#15151b]/80 px-6 py-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            Unified Transaction Passbook Statement
          </h2>
          <p className="text-xs text-gray-400">
            Chronological audit trail of all customer payments and operational expenses.
          </p>
        </div>

        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-xs text-gray-400">Calculating bank ledger balances...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="text-4xl">🏦</span>
            <p className="text-sm font-semibold text-white">No passbook transactions found</p>
            <p className="max-w-md text-xs text-gray-500">
              {searchQuery || channelFilter !== "all" || typeFilter !== "all"
                ? "Try resetting your filter parameters."
                : "Transactions will appear here as soon as you record bills or expenses."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="border-b border-white/10 bg-[#15151b]/40 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Transaction Details</th>
                  <th className="px-6 py-4">Account Channel</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Recorded By</th>
                  <th className="px-6 py-4 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-xs">
                {filteredEntries.map((entry) => {
                  const isCredit = entry.type === "income";
                  const formattedTime = new Date(entry.timestamp).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={entry.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-6 py-4 font-sans">
                        <div className="text-xs font-medium text-white">{entry.dateStr}</div>
                        <div className="text-[11px] text-gray-500">{formattedTime}</div>
                      </td>

                      <td className="px-6 py-4 font-sans">
                        <div className="font-semibold text-white">{entry.title}</div>
                        {entry.subtitle && (
                          <div className="text-[11px] text-gray-400">{entry.subtitle}</div>
                        )}
                        <span className="text-[10px] text-gray-500">Ref: {entry.referenceId}</span>
                      </td>

                      <td className="px-6 py-4 font-sans">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            entry.channel === "online"
                              ? "border border-blue-500/20 bg-blue-500/10 text-blue-300"
                              : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                          }`}
                        >
                          <span>{entry.channel === "online" ? "🏦 Bank" : "💵 Cash Drawer"}</span>
                        </span>
                      </td>

                      <td className="px-6 py-4 font-sans">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                            isCredit
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}
                        >
                          {isCredit ? "Credit (+)" : "Debit (-)"}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-sans text-xs text-gray-400">
                        {entry.adminName || "Admin"}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span
                          className={`text-sm font-extrabold ${
                            isCredit ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {isCredit ? "+" : "-"}
                          {formatCurrency(entry.amount)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
