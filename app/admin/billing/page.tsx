"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { toast as reactToast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  getAllBillsAction,
  updateBillAction,
  deleteBillAction,
  getTodayBookingsForBillingAction,
  BillRecord,
  BillingPs5SessionInput,
  BillingMenuItemInput,
  BillingCustomItemInput,
} from "@/actions/billing-actions";
import { getMenuItemsAction, MenuItemData } from "@/actions/menu-actions";
import {
  PS5_BILLING_RATES,
  ControllerMode,
  Ps5Duration,
  getPs5Rate,
  formatCurrency,
} from "@/lib/pricing";
import Gta6BillingSection from "@/components/admin/Gta6BillingSection";

export default function AdminBillingPage() {
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [todayCustomerNames, setTodayCustomerNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<BillRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Form Fields
  const [customerName, setCustomerName] = useState("");
  const [selectedPs5Sessions, setSelectedPs5Sessions] = useState<BillingPs5SessionInput[]>([]);
  const [selectedMenuItems, setSelectedMenuItems] = useState<BillingMenuItemInput[]>([]);
  const [selectedCustomItems, setSelectedCustomItems] = useState<BillingCustomItemInput[]>([]);
  const [discount, setDiscount] = useState<string>("0");
  const [cashAmount, setCashAmount] = useState<string>("0");
  const [onlineAmount, setOnlineAmount] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");

  // PS5 Builder Temp State
  const [tempController, setTempController] = useState<ControllerMode>("single");
  const [tempDuration, setTempDuration] = useState<Ps5Duration>(20);
  const [tempPs5Qty, setTempPs5Qty] = useState<number>(1);

  // Menu Item Builder Temp State
  const [tempSelectedMenuItemId, setTempSelectedMenuItemId] = useState<string>("");
  const [tempMenuQty, setTempMenuQty] = useState<number>(1);

  // Custom Item Builder Temp State
  const [tempCustomName, setTempCustomName] = useState<string>("");
  const [tempCustomPrice, setTempCustomPrice] = useState<string>("");
  const [tempCustomQty, setTempCustomQty] = useState<number>(1);

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

  // Load all initial data
  const loadData = async () => {
    setIsLoading(true);
    const [billsRes, menuRes, namesRes] = await Promise.all([
      getAllBillsAction(),
      getMenuItemsAction(),
      getTodayBookingsForBillingAction(),
    ]);

    if (billsRes.success) {
      setBills(billsRes.bills);
    } else {
      showToast(billsRes.error || "Failed to load bills", "error");
    }

    if (menuRes.success) {
      setMenuItems(menuRes.items.filter((i) => i.isAvailable));
    }

    if (namesRes.success) {
      setTodayCustomerNames(namesRes.customerNames);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Set default menu selection when items load
  useEffect(() => {
    if (menuItems.length > 0 && !tempSelectedMenuItemId) {
      setTempSelectedMenuItemId(menuItems[0].id.toString());
    }
  }, [menuItems, tempSelectedMenuItemId]);

  // Derived calculations for form
  const formCalculations = useMemo(() => {
    let ps5Sum = 0;
    selectedPs5Sessions.forEach((s) => {
      const rate = s.unitPrice ?? getPs5Rate(s.controller, s.duration);
      ps5Sum += rate * (s.quantity || 1);
    });

    let cafeSum = 0;
    selectedMenuItems.forEach((m) => {
      cafeSum += (m.price || 0) * (m.quantity || 1);
    });

    let customSum = 0;
    selectedCustomItems.forEach((c) => {
      customSum += (c.price || 0) * (c.quantity || 1);
    });

    const subtotal = ps5Sum + cafeSum + customSum;
    const discountNum = Math.max(0, parseInt(discount) || 0);
    const totalAmount = Math.max(0, subtotal - discountNum);

    const cashNum = Math.max(0, parseInt(cashAmount) || 0);
    const onlineNum = Math.max(0, parseInt(onlineAmount) || 0);
    const totalPaid = cashNum + onlineNum;

    let status = "paid";
    if (totalPaid === 0 && totalAmount > 0) {
      status = "pending";
    } else if (totalPaid < totalAmount) {
      status = "partial";
    }

    return {
      ps5Sum,
      cafeSum,
      customSum,
      subtotal,
      discountNum,
      totalAmount,
      cashNum,
      onlineNum,
      totalPaid,
      status,
    };
  }, [
    selectedPs5Sessions,
    selectedMenuItems,
    selectedCustomItems,
    discount,
    cashAmount,
    onlineAmount,
  ]);

  // KPI Metrics
  const stats = useMemo(() => {
    const totalBills = bills.length;
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
      if (bDate === todayStr) {
        todayRevenue += b.totalAmount;
      }
    });

    return { totalBills, totalRevenue, totalCash, totalOnline, todayRevenue };
  }, [bills]);

  // Unique bill dates for filter
  const billDates = useMemo(() => {
    const dates = new Set<string>();
    bills.forEach((b) => {
      dates.add(new Date(b.createdAt).toISOString().split("T")[0]);
    });
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

  // Open Edit Modal
  const handleOpenEdit = (bill: BillRecord) => {
    setEditingBill(bill);
    setCustomerName(bill.customerName);
    setSelectedPs5Sessions(
      bill.sessions.map((s) => ({
        controller: s.controller as ControllerMode,
        duration: s.duration as Ps5Duration,
        unitPrice: s.unitPrice,
        quantity: s.quantity,
      }))
    );
    setSelectedMenuItems(
      bill.items
        .filter((i) => !i.isCustom)
        .map((m) => ({
          menuItemId: m.menuItemId || undefined,
          name: m.name,
          price: m.price,
          quantity: m.quantity,
        }))
    );
    setSelectedCustomItems(
      bill.items
        .filter((i) => i.isCustom)
        .map((c) => ({
          name: c.name,
          price: c.price,
          quantity: c.quantity,
        }))
    );
    setDiscount(bill.discount.toString());
    setCashAmount(bill.cashAmount.toString());
    setOnlineAmount(bill.onlineAmount.toString());
    setNotes(bill.notes || "");
    setFormError("");
    setIsModalOpen(true);
  };

  // Add PS5 session row
  const handleAddPs5Session = () => {
    const unitPrice = getPs5Rate(tempController, tempDuration);
    setSelectedPs5Sessions((prev) => [
      ...prev,
      {
        controller: tempController,
        duration: tempDuration,
        unitPrice,
        quantity: Math.max(1, tempPs5Qty),
      },
    ]);
    setTempPs5Qty(1);
  };

  // Add GTA 6 Event session row (Remove when event ends)
  const handleAddGta6Session = (session: {
    controller: string;
    duration: number;
    unitPrice: number;
    quantity: number;
  }) => {
    setSelectedPs5Sessions((prev) => [
      ...prev,
      {
        controller: session.controller as any,
        duration: session.duration as any,
        unitPrice: session.unitPrice,
        quantity: session.quantity,
      },
    ]);
  };

  const handleRemovePs5Session = (index: number) => {
    setSelectedPs5Sessions((prev) => prev.filter((_, i) => i !== index));
  };

  // Add Cafe Menu item row
  const handleAddMenuItem = () => {
    const item = menuItems.find((m) => m.id.toString() === tempSelectedMenuItemId);
    if (!item) return;

    setSelectedMenuItems((prev) => [
      ...prev,
      {
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: Math.max(1, tempMenuQty),
      },
    ]);
    setTempMenuQty(1);
  };

  const handleRemoveMenuItem = (index: number) => {
    setSelectedMenuItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Add Custom Out-of-Menu item row
  const handleAddCustomItem = () => {
    if (!tempCustomName.trim()) return;
    const price = Math.max(0, parseInt(tempCustomPrice) || 0);

    setSelectedCustomItems((prev) => [
      ...prev,
      {
        name: tempCustomName.trim(),
        price,
        quantity: Math.max(1, tempCustomQty),
      },
    ]);
    setTempCustomName("");
    setTempCustomPrice("");
    setTempCustomQty(1);
  };

  const handleRemoveCustomItem = (index: number) => {
    setSelectedCustomItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick Payment Preset Handlers
  const handleSetAllCash = () => {
    setCashAmount(formCalculations.totalAmount.toString());
    setOnlineAmount("0");
  };

  const handleSetAllOnline = () => {
    setOnlineAmount(formCalculations.totalAmount.toString());
    setCashAmount("0");
  };

  const handleSetSplit5050 = () => {
    const half = Math.floor(formCalculations.totalAmount / 2);
    setOnlineAmount(half.toString());
    setCashAmount((formCalculations.totalAmount - half).toString());
  };

  // Online input handler: automatically deducts remaining balance from cash!
  const handleOnlineChange = (valStr: string) => {
    if (valStr === "") {
      setOnlineAmount("");
      setCashAmount(formCalculations.totalAmount.toString());
      return;
    }

    let parsed = parseInt(valStr, 10);
    if (isNaN(parsed) || parsed < 0) parsed = 0;

    // Strict cap: online cannot exceed total payable
    if (parsed > formCalculations.totalAmount) {
      parsed = formCalculations.totalAmount;
    }

    setOnlineAmount(parsed.toString());

    // Automatically deduct cash amount
    const remainingCash = Math.max(0, formCalculations.totalAmount - parsed);
    setCashAmount(remainingCash.toString());
  };

  // Cash input handler: ensures online + cash cannot exceed total payable
  const handleCashChange = (valStr: string) => {
    if (valStr === "") {
      setCashAmount("");
      setOnlineAmount(formCalculations.totalAmount.toString());

      return;
    }

    let parsed = parseInt(valStr, 10);
    if (isNaN(parsed) || parsed < 0) parsed = 0;

    // Strict cap: cash cannot exceed total payable
    if (parsed > formCalculations.totalAmount) {
      parsed = formCalculations.totalAmount;
    }

    setCashAmount(parsed.toString());

        // Automatically deduct cash amount
    const remainingOnline = Math.max(0, formCalculations.totalAmount - parsed);
    setOnlineAmount(remainingOnline.toString());
  };

  // Discount input handler: recalculates and auto-balances cash/online
  const handleDiscountChange = (valStr: string) => {
    setDiscount(valStr);
    const discountNum = Math.max(0, parseInt(valStr, 10) || 0);
    const newTotal = Math.max(0, formCalculations.subtotal - discountNum);
    const currentOnline = parseInt(onlineAmount, 10) || 0;

    if (currentOnline >= newTotal) {
      setOnlineAmount(newTotal.toString());
      setCashAmount("0");
    } else {
      setCashAmount(Math.max(0, newTotal - currentOnline).toString());
    }
  };

  // Auto-sync cash amount when total amount changes (e.g. items added/removed)
  useEffect(() => {
    if (!isModalOpen || editingBill) return;
    const currentOnline = Math.max(0, parseInt(onlineAmount, 10) || 0);
    const target = formCalculations.totalAmount;

    if (currentOnline > target) {
      setOnlineAmount(target.toString());
      setCashAmount("0");
    } else {
      setCashAmount(Math.max(0, target - currentOnline).toString());
    }
  }, [formCalculations.totalAmount, isModalOpen, editingBill]);

  // Submit Create or Edit Form
  const handleSubmitBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!customerName.trim()) {
      const msg = "Customer name is required.";
      setFormError(msg);
      reactToast.error(msg, { position: "top-right", autoClose: 4000 });
      return;
    }

    if (
      selectedPs5Sessions.length === 0 &&
      selectedMenuItems.length === 0 &&
      selectedCustomItems.length === 0
    ) {
      const msg = "Please add at least one PS5 session, cafe item, or custom item to the bill.";
      setFormError(msg);
      reactToast.error(msg, { position: "top-right", autoClose: 4000 });
      return;
    }

    if (formCalculations.totalPaid > formCalculations.totalAmount) {
      const msg = `Total payment (${formatCurrency(formCalculations.totalPaid)}) cannot exceed the payable total (${formatCurrency(formCalculations.totalAmount)}).`;
      setFormError(msg);
      reactToast.error(msg, { position: "top-right", autoClose: 4000 });
      return;
    }

    if (formCalculations.totalPaid > formCalculations.subtotal) {
      const msg = `Total payment (${formatCurrency(formCalculations.totalPaid)}) cannot exceed the subtotal (${formatCurrency(formCalculations.subtotal)}).`;
      setFormError(msg);
      reactToast.error(msg, { position: "top-right", autoClose: 4000 });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        ps5Sessions: selectedPs5Sessions,
        menuItems: selectedMenuItems,
        customItems: selectedCustomItems,
        discount: formCalculations.discountNum,
        cashAmount: formCalculations.cashNum,
        onlineAmount: formCalculations.onlineNum,
        notes: notes.trim(),
      };

      if (editingBill) {
        const res = await updateBillAction(editingBill.id, payload);
        if (res.success && res.bill) {
          setBills((prev) => prev.map((b) => (b.id === editingBill.id ? res.bill! : b)));
          setIsModalOpen(false);
          setEditingBill(null);
          showToast(`Updated Bill #${res.bill.id}`);
        } else {
          const msg = res.error || "Failed to update bill.";
          setFormError(msg);
          reactToast.error(msg, { position: "top-right", autoClose: 4000 });
        }
      }
    } catch {
      const msg = "Server error occurred while saving bill.";
      setFormError(msg);
      reactToast.error(msg, { position: "top-right", autoClose: 4000 });
    } finally {
      setIsSaving(false);
    }
  };

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
      {/* Toast Notification Container with high z-index to show over modals */}
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          {/* Status Filter */}
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

          {/* Date Filter */}
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

        {/* Search Input */}
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
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(bill)}
                            className="rounded-lg border border-white/10 bg-[#1c1c24] px-2.5 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
                          >
                            Edit
                          </button>
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

      {/* Edit Bill Modal */}
      {isModalOpen && editingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="my-8 w-full max-w-3xl rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Edit Bill #{editingBill.id}
                </h3>
                <p className="text-xs text-gray-400">
                  Update customer details, items, discount, and payment allocation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingBill(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitBill} className="mt-5 space-y-6">
              {formError && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/15 p-3.5 text-xs font-semibold text-red-200 shadow-xl shadow-red-500/10">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">⚠️</span>
                    <span>{formError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormError("")}
                    className="rounded-md px-2 py-0.5 text-xs text-red-400 hover:bg-white/10 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* 1. Customer Name (With Today's Bookings Combobox Dropdown) */}
              <div className="rounded-xl border border-white/10 bg-[#171720] p-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400">
                  1. Customer Name *
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      list="today-customers-list"
                      required
                      placeholder="Type customer name or select from today's bookings..."
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#111116] px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                    />
                    <datalist id="today-customers-list">
                      {todayCustomerNames.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </div>

                  {todayCustomerNames.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span>Quick Select:</span>
                      <select
                        onChange={(e) => {
                          if (e.target.value) setCustomerName(e.target.value);
                        }}
                        className="rounded-lg border border-white/10 bg-[#111116] px-2 py-1.5 text-xs text-purple-300 focus:outline-none"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Today's Players ({todayCustomerNames.length})
                        </option>
                        {todayCustomerNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* ─── GTA 6 EVENT PS5 SESSIONS (REMOVE WHEN EVENT ENDS) ─── */}
              <Gta6BillingSection onAddSession={handleAddGta6Session} />

              {/* 2. PS5 Sessions (Optional - Multi-session support) */}
              <div className="rounded-xl border border-white/10 bg-[#171720] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                    2. PS5 Gaming Sessions (Optional)
                  </span>
                  <span className="text-xs text-gray-500">
                    Single (20m: ₹60, 40m: ₹130, 60m: ₹150) | Dual (20m: ₹110, 40m: ₹180, 60m: ₹200)
                  </span>
                </div>

                {/* Session Builder Row */}
                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <div className="flex rounded-lg border border-white/10 bg-[#111116] p-1">
                      <button
                        type="button"
                        onClick={() => setTempController("single")}
                        className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                          tempController === "single"
                            ? "bg-purple-600 text-white shadow"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        Single Controller
                      </button>
                      <button
                        type="button"
                        onClick={() => setTempController("dual")}
                        className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                          tempController === "dual"
                            ? "bg-purple-600 text-white shadow"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        Dual Controller
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-4">
                    <div className="flex rounded-lg border border-white/10 bg-[#111116] p-1">
                      {([20, 40, 60] as Ps5Duration[]).map((dur) => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => setTempDuration(dur)}
                          className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                            tempDuration === dur
                              ? "bg-purple-600 text-white shadow"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          {dur} min (₹{PS5_BILLING_RATES[tempController][dur]})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:col-span-2">
                    <span className="text-xs text-gray-400">Qty:</span>
                    <input
                      type="number"
                      min="1"
                      value={tempPs5Qty}
                      onChange={(e) => setTempPs5Qty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 rounded-lg border border-white/10 bg-[#111116] px-2 py-1 text-center text-xs text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddPs5Session}
                      className="w-full rounded-lg bg-purple-600/80 px-3 py-2 text-xs font-bold text-white hover:bg-purple-600"
                    >
                      + Add PS5
                    </button>
                  </div>
                </div>

                {/* Selected Sessions Table */}
                {selectedPs5Sessions.length > 0 && (
                  <div className="mt-3 divide-y divide-white/5 rounded-lg border border-white/5 bg-[#111116]">
                    {selectedPs5Sessions.map((session, idx) => {
                      const rate = session.unitPrice ?? getPs5Rate(session.controller, session.duration);
                      const total = rate * session.quantity;
                      return (
                        <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold capitalize ${
                                session.controller === "GTA 6"
                                  ? "text-red-400 font-bold"
                                  : "text-purple-300"
                              }`}
                            >
                              {session.controller === "GTA 6"
                                ? "GTA 6 Event Pass"
                                : `${session.controller} Controller`}
                            </span>
                            <span className="text-gray-400">({session.duration} min)</span>
                            <span className="text-gray-500">× {session.quantity}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-white">{formatCurrency(total)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemovePs5Session(idx)}
                              className="text-red-400 hover:text-red-300"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Cafe Menu Items */}
              <div className="rounded-xl border border-white/10 bg-[#171720] p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  3. Cafe Menu Items (Optional)
                </span>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={tempSelectedMenuItemId}
                    onChange={(e) => setTempSelectedMenuItemId(e.target.value)}
                    className="flex-1 rounded-xl border border-white/10 bg-[#111116] px-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  >
                    {menuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.category}) — ₹{item.price}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Qty:</span>
                    <input
                      type="number"
                      min="1"
                      value={tempMenuQty}
                      onChange={(e) => setTempMenuQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 rounded-lg border border-white/10 bg-[#111116] px-2 py-1.5 text-center text-xs text-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddMenuItem}
                    disabled={menuItems.length === 0}
                    className="rounded-lg bg-amber-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    + Add Item
                  </button>
                </div>

                {/* Selected Menu Items List */}
                {selectedMenuItems.length > 0 && (
                  <div className="mt-3 divide-y divide-white/5 rounded-lg border border-white/5 bg-[#111116]">
                    {selectedMenuItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{item.name}</span>
                          <span className="text-gray-500">
                            (₹{item.price} × {item.quantity})
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-white">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMenuItem(idx)}
                            className="text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Custom Out-of-Menu Items (Does NOT modify menu catalog) */}
              <div className="rounded-xl border border-white/10 bg-[#171720] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                    4. Custom / Ad-Hoc Items (Out of Menu)
                  </span>
                  <span className="text-[11px] text-gray-500">Will not be added to menu catalog</span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      placeholder="Item name (e.g. Energy Drink Can)"
                      value={tempCustomName}
                      onChange={(e) => setTempCustomName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#111116] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <input
                      type="number"
                      min="0"
                      placeholder="Price (₹)"
                      value={tempCustomPrice}
                      onChange={(e) => setTempCustomPrice(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#111116] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 sm:col-span-2">
                    <span className="text-xs text-gray-400">Qty:</span>
                    <input
                      type="number"
                      min="1"
                      value={tempCustomQty}
                      onChange={(e) => setTempCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 rounded-lg border border-white/10 bg-[#111116] px-2 py-1 text-center text-xs text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddCustomItem}
                      className="w-full rounded-lg bg-blue-600/80 px-3 py-2 text-xs font-bold text-white hover:bg-blue-600"
                    >
                      + Add Custom
                    </button>
                  </div>
                </div>

                {/* Selected Custom Items */}
                {selectedCustomItems.length > 0 && (
                  <div className="mt-3 divide-y divide-white/5 rounded-lg border border-white/5 bg-[#111116]">
                    {selectedCustomItems.map((c, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-blue-300">{c.name}</span>
                          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400">
                            Custom
                          </span>
                          <span className="text-gray-500">
                            (₹{c.price} × {c.quantity})
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-white">
                            {formatCurrency(c.price * c.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomItem(idx)}
                            className="text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Live Summary, Discount & Split Payment Settlement */}
              <div className="rounded-xl border border-white/10 bg-[#181822] p-5">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {/* Left Column: Subtotals & Discount */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>PS5 Gaming Subtotal:</span>
                      <span className="font-semibold text-white">
                        {formatCurrency(formCalculations.ps5Sum)}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Cafe Menu Subtotal:</span>
                      <span className="font-semibold text-white">
                        {formatCurrency(formCalculations.cafeSum)}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Custom Items Subtotal:</span>
                      <span className="font-semibold text-white">
                        {formatCurrency(formCalculations.customSum)}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-gray-300 pt-1 border-t border-white/10">
                      <span>Gross Subtotal:</span>
                      <span className="font-bold text-white">
                        {formatCurrency(formCalculations.subtotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="text-xs font-semibold text-emerald-400">Discount (₹):</span>
                      <input
                        type="number"
                        min="0"
                        value={discount}
                        onChange={(e) => handleDiscountChange(e.target.value)}
                        className="w-24 rounded-lg border border-white/10 bg-[#111116] px-2.5 py-1 text-right text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-white/10">
                      <span>Total Payable:</span>
                      <span className="text-lg text-purple-400">
                        {formatCurrency(formCalculations.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Split Payment Settler */}
                  <div className="space-y-3">
                    <span className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                      Payment Settlement (Split Cash / Online)
                    </span>

                    {/* Preset Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSetAllCash}
                        className="flex-1 rounded-lg border border-white/10 bg-[#111116] py-1.5 text-[11px] font-semibold text-emerald-400 hover:bg-white/5"
                      >
                        All Cash
                      </button>
                      <button
                        type="button"
                        onClick={handleSetAllOnline}
                        className="flex-1 rounded-lg border border-white/10 bg-[#111116] py-1.5 text-[11px] font-semibold text-blue-400 hover:bg-white/5"
                      >
                        All Online
                      </button>
                      <button
                        type="button"
                        onClick={handleSetSplit5050}
                        className="flex-1 rounded-lg border border-white/10 bg-[#111116] py-1.5 text-[11px] font-semibold text-purple-400 hover:bg-white/5"
                      >
                        Split 50/50
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-medium text-emerald-400">
                          Cash Amount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={formCalculations.totalAmount}
                          value={cashAmount}
                          onChange={(e) => handleCashChange(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-[#111116] px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-blue-400">
                          Online Amount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={formCalculations.totalAmount}
                          value={onlineAmount}
                          onChange={(e) => handleOnlineChange(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-[#111116] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-400 leading-tight">
                      💡 Entering an online amount auto-deducts cash. Total (Cash + Online) cannot exceed payable amount ({formatCurrency(formCalculations.totalAmount)}).
                    </p>

                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="text-gray-400">Total Collected:</span>
                      <span className="font-bold text-white">
                        {formatCurrency(formCalculations.totalPaid)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Status:</span>
                      <span
                        className={`font-bold uppercase tracking-wider ${
                          formCalculations.status === "paid"
                            ? "text-emerald-400"
                            : formCalculations.status === "partial"
                            ? "text-amber-400"
                            : "text-red-400"
                        }`}
                      >
                        {formCalculations.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Optional Notes */}
                <div className="mt-4 pt-3 border-t border-white/10">
                  <input
                    type="text"
                    placeholder="Optional notes or remarks..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#111116] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingBill(null);
                  }}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-gradient-to-r from-purple-500 to-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-500/25 hover:brightness-110 disabled:opacity-50"
                >
                  {isSaving ? "Updating Bill..." : "Update Bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111116] p-6 shadow-2xl text-white">
            {/* Printable Content */}
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

              {/* Line Items */}
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
                    <span>
                      {i.name} × {i.quantity}
                    </span>
                    <span className="font-semibold">{formatCurrency(i.total)}</span>
                  </div>
                ))}
              </div>

              {/* Totals Breakdown */}
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

            {/* Modal Controls */}
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
