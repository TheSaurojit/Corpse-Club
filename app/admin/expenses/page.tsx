"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getAllExpensesAction,
  createExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
  ExpenseRecord,
} from "@/actions/expense-actions";
import { formatCurrency } from "@/lib/pricing";

const PRESET_CATEGORIES = [
  "Inventory & Stock",
  "Utilities & Electricity",
  "Maintenance & Repairs",
  "Gaming Accessories",
  "Staff & Wages",
  "General & Miscellaneous",
];

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    method: "cash",
    category: "Inventory & Stock",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadExpenses = async () => {
    setIsLoading(true);
    const res = await getAllExpensesAction();
    if (res.success) {
      setExpenses(res.expenses);
    } else {
      showToast(res.error || "Failed to load expenses", "error");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  // KPIs
  const stats = useMemo(() => {
    let total = 0;
    let cash = 0;
    let online = 0;
    let today = 0;
    const todayStr = new Date().toISOString().split("T")[0];

    expenses.forEach((e) => {
      total += e.amount;
      if (e.method.toLowerCase() === "online") {
        online += e.amount;
      } else {
        cash += e.amount;
      }
      if (e.date === todayStr) {
        today += e.amount;
      }
    });

    return { total, cash, online, today, count: expenses.length };
  }, [expenses]);

  // Derived categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return ["all", ...Array.from(set)];
  }, [expenses]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchesSearch =
        !searchQuery ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.notes && e.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesMethod =
        methodFilter === "all" || e.method.toLowerCase() === methodFilter.toLowerCase();

      const matchesCategory =
        categoryFilter === "all" || (e.category || "").toLowerCase() === categoryFilter.toLowerCase();

      return matchesSearch && matchesMethod && matchesCategory;
    });
  }, [expenses, searchQuery, methodFilter, categoryFilter]);

  // Open Create
  const handleOpenCreate = () => {
    setEditingExpense(null);
    setFormData({
      title: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      method: "cash",
      category: "Inventory & Stock",
      notes: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Open Edit
  const handleOpenEdit = (exp: ExpenseRecord) => {
    setEditingExpense(exp);
    setFormData({
      title: exp.title,
      amount: exp.amount.toString(),
      date: exp.date,
      method: exp.method,
      category: exp.category || "Inventory & Stock",
      notes: exp.notes || "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Save Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formData.title.trim()) {
      setFormError("Expense title is required.");
      return;
    }

    const amountNum = Math.round(Number(formData.amount));
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError("Valid positive amount is required.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingExpense) {
        const res = await updateExpenseAction(editingExpense.id, {
          title: formData.title.trim(),
          amount: amountNum,
          date: formData.date,
          method: formData.method,
          category: formData.category,
          notes: formData.notes.trim(),
        });
        if (res.success && res.expense) {
          setExpenses((prev) =>
            prev.map((item) => (item.id === editingExpense.id ? res.expense! : item))
          );
          setIsModalOpen(false);
          showToast(`Updated expense "${res.expense.title}"`);
        } else {
          setFormError(res.error || "Failed to update expense.");
        }
      } else {
        const res = await createExpenseAction({
          title: formData.title.trim(),
          amount: amountNum,
          date: formData.date,
          method: formData.method,
          category: formData.category,
          notes: formData.notes.trim(),
        });
        if (res.success && res.expense) {
          setExpenses((prev) => [res.expense!, ...prev]);
          setIsModalOpen(false);
          showToast(`Recorded expense "${res.expense.title}"`);
        } else {
          setFormError(res.error || "Failed to create expense.");
        }
      }
    } catch {
      setFormError("Server error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await deleteExpenseAction(deleteTarget.id);
    if (res.success) {
      setExpenses((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      showToast(`Deleted expense "${deleteTarget.title}"`);
      setDeleteTarget(null);
    } else {
      showToast(res.error || "Failed to delete expense", "error");
    }
    setIsDeleting(false);
  };

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl transition-all ${
            toast.type === "success"
              ? "bg-emerald-500/90 text-white"
              : "bg-red-500/90 text-white"
          }`}
        >
          <span>{toast.type === "success" ? "✓" : "⚠"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-red-400">
              Cash Outflow & Petty Cash
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="text-xs text-gray-500">Expenses</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Lounge Expenses
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Log inventory restocks, utilities, cafe supplies, and repairs paid in cash or online.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadExpenses}
            disabled={isLoading}
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#15151b] px-4 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            <span className={isLoading ? "animate-spin" : ""}>🔄</span>
            <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 text-xs font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:brightness-110"
          >
            <span className="text-base font-bold">+</span>
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Today's Expenses
          </span>
          <p className="mt-2 text-2xl font-extrabold text-white">
            {formatCurrency(stats.today)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <span className="text-xs font-medium uppercase tracking-wider text-red-400">
            Total Outflow (All Time)
          </span>
          <p className="mt-2 text-2xl font-extrabold text-red-400">
            {formatCurrency(stats.total)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
            Cash Drawer Paid Out
          </span>
          <p className="mt-2 text-2xl font-extrabold text-emerald-400">
            {formatCurrency(stats.cash)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <span className="text-xs font-medium uppercase tracking-wider text-blue-400">
            Online Bank / UPI Paid Out
          </span>
          <p className="mt-2 text-2xl font-extrabold text-blue-400">
            {formatCurrency(stats.online)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#15151b] px-3.5 py-2 text-xs font-semibold text-gray-300 focus:border-red-500 focus:outline-none"
          >
            <option value="all">All Payment Methods</option>
            <option value="cash">Cash Only</option>
            <option value="online">Online / UPI Only</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#15151b] px-3.5 py-2 text-xs font-semibold text-gray-300 focus:border-red-500 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories
              .filter((c) => c !== "all")
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search expenses..."
            className="w-full rounded-xl border border-white/10 bg-[#15151b] px-4 py-2 text-xs text-white placeholder-gray-500 focus:border-red-500 focus:outline-none"
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

      {/* Expenses Table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111116]/90 backdrop-blur-xl">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
            <p className="text-xs text-gray-400">Loading expenses...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="text-4xl">💸</span>
            <p className="text-sm font-semibold text-white">No expenses found</p>
            <p className="max-w-md text-xs text-gray-500">
              {searchQuery || methodFilter !== "all" || categoryFilter !== "all"
                ? "Try clearing your filters."
                : "No expenses recorded yet. Click 'Add Expense' above to log one."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="border-b border-white/10 bg-[#15151b]/60 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-6 py-4">Title & Description</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Logged By</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{exp.title}</div>
                      {exp.notes && <div className="text-xs text-gray-500">{exp.notes}</div>}
                    </td>

                    <td className="px-6 py-4">
                      <span className="rounded-lg border border-white/10 bg-[#1a1a24] px-2.5 py-1 text-xs font-medium text-gray-300">
                        {exp.category || "General"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-extrabold text-red-400">
                        {formatCurrency(exp.amount)}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                          exp.method.toLowerCase() === "online"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {exp.method}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs text-gray-400">{exp.date}</td>

                    <td className="px-6 py-4 text-xs text-gray-400">
                      {exp.admin?.name || exp.createdByEmail || "Admin"}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(exp)}
                          className="rounded-lg border border-white/10 bg-[#1c1c24] px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(exp)}
                          className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#13131a] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white">
                {editingExpense ? "Edit Expense" : "Record New Expense"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-400">Title / Purpose *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Milk & Coffee beans restock"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#1a1a24] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="250"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#1a1a24] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#1a1a24] px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400">Payment Channel *</label>
                  <select
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#1a1a24] px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
                  >
                    <option value="cash">Cash (Drawer)</option>
                    <option value="online">Online / UPI (Bank)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#1a1a24] px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
                  >
                    {PRESET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400">Notes / Receipt Ref</label>
                <textarea
                  rows={2}
                  placeholder="Optional details, vendor name or receipt note..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#1a1a24] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-500/20 hover:brightness-110 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : editingExpense ? "Update Expense" : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#151214] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Delete Expense?</h3>
            <p className="mt-2 text-xs text-gray-400">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-white">"{deleteTarget.title}"</span> (₹
              {deleteTarget.amount})?
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
