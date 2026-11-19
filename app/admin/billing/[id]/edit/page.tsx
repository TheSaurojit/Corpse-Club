"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast as reactToast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  getBillByIdAction,
  updateBillAction,
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

export default function AdminBillingEditPage() {
  const router = useRouter();
  const params = useParams();
  const billId = params.id as string;

  // Data
  const [bill, setBill] = useState<BillRecord | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [todayCustomerNames, setTodayCustomerNames] = useState<string[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

  // Submission State
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Success State
  const [updatedBill, setUpdatedBill] = useState<BillRecord | null>(null);

  // Load bill + menu + names
  useEffect(() => {
    if (!billId) return;
    async function init() {
      setIsLoadingInitial(true);
      try {
        const [billRes, menuRes, namesRes] = await Promise.all([
          getBillByIdAction(billId),
          getMenuItemsAction(),
          getTodayBookingsForBillingAction(),
        ]);

        if (!billRes.success || !billRes.bill) {
          setNotFound(true);
          setIsLoadingInitial(false);
          return;
        }

        const b = billRes.bill;
        setBill(b);

        // Pre-populate form from existing bill
        setCustomerName(b.customerName);
        setDiscount(b.discount.toString());
        setCashAmount(b.cashAmount.toString());
        setOnlineAmount(b.onlineAmount.toString());
        setNotes(b.notes || "");

        // Map sessions
        setSelectedPs5Sessions(
          b.sessions.map((s) => ({
            controller: s.controller as ControllerMode,
            duration: s.duration as Ps5Duration,
            unitPrice: s.unitPrice,
            quantity: s.quantity,
          }))
        );

        // Map menu items (non-custom)
        setSelectedMenuItems(
          b.items
            .filter((i) => !i.isCustom)
            .map((i) => ({
              menuItemId: i.menuItemId || undefined,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
            }))
        );

        // Map custom items
        setSelectedCustomItems(
          b.items
            .filter((i) => i.isCustom)
            .map((i) => ({
              name: i.name,
              price: i.price,
              quantity: i.quantity,
            }))
        );

        // Menu catalog
        if (menuRes.success && menuRes.items) {
          const available = menuRes.items.filter((i) => i.isAvailable);
          setMenuItems(available);
          if (available.length > 0) {
            setTempSelectedMenuItemId(available[0].id.toString());
          }
        }

        if (namesRes.success && namesRes.customerNames) {
          setTodayCustomerNames(namesRes.customerNames);
        }
      } catch (err) {
        console.error("Failed to load bill for editing:", err);
        reactToast.error("Failed to load billing data.", { autoClose: 4000 });
      } finally {
        setIsLoadingInitial(false);
      }
    }
    init();
  }, [billId]);

  // Form financial calculations
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
    const discountNum = Math.max(0, parseInt(discount, 10) || 0);
    const totalAmount = Math.max(0, subtotal - discountNum);

    const cashNum = Math.max(0, parseInt(cashAmount, 10) || 0);
    const onlineNum = Math.max(0, parseInt(onlineAmount, 10) || 0);
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

  // Handlers: PS5 Sessions
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
    reactToast.info(
      `Added PS5 ${tempController} (${tempDuration}m × ${Math.max(1, tempPs5Qty)})`,
      { autoClose: 2000 }
    );
  };

  const handleAddGta6Session = (session: {
    controller: string;
    duration: number;
    unitPrice: number;
    quantity: number;
  }) => {
    setSelectedPs5Sessions((prev) => [
      ...prev,
      {
        controller: session.controller as ControllerMode,
        duration: session.duration as Ps5Duration,
        unitPrice: session.unitPrice,
        quantity: session.quantity,
      },
    ]);
    reactToast.info(
      `Added GTA 6 Pass (${session.duration}m × ${session.quantity} = ₹${session.unitPrice * session.quantity})`,
      { autoClose: 2000 }
    );
  };

  const handleRemovePs5Session = (index: number) => {
    setSelectedPs5Sessions((prev) => prev.filter((_, i) => i !== index));
  };

  // Handlers: Cafe Items
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
    reactToast.info(`Added ${item.name} × ${Math.max(1, tempMenuQty)}`, { autoClose: 2000 });
  };

  const handleRemoveMenuItem = (index: number) => {
    setSelectedMenuItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Handlers: Custom Items
  const handleAddCustomItem = () => {
    if (!tempCustomName.trim()) {
      reactToast.error("Please enter a name for the custom item.", { autoClose: 3000 });
      return;
    }
    const price = Math.max(0, parseInt(tempCustomPrice, 10) || 0);
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
    reactToast.info("Added custom item to bill.", { autoClose: 2000 });
  };

  const handleRemoveCustomItem = (index: number) => {
    setSelectedCustomItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Payment Quick Presets
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

  const handleOnlineChange = (valStr: string) => {
    if (valStr === "") {
      setOnlineAmount("");
      setCashAmount(formCalculations.totalAmount.toString());
      return;
    }
    let parsed = parseInt(valStr, 10);
    if (isNaN(parsed) || parsed < 0) parsed = 0;
    if (parsed > formCalculations.totalAmount) parsed = formCalculations.totalAmount;
    setOnlineAmount(parsed.toString());
    setCashAmount(Math.max(0, formCalculations.totalAmount - parsed).toString());
  };

  const handleCashChange = (valStr: string) => {
    if (valStr === "") {
      setCashAmount("");
      setOnlineAmount(formCalculations.totalAmount.toString());
      return;
    }
    let parsed = parseInt(valStr, 10);
    if (isNaN(parsed) || parsed < 0) parsed = 0;
    if (parsed > formCalculations.totalAmount) parsed = formCalculations.totalAmount;
    setCashAmount(parsed.toString());
    setOnlineAmount(Math.max(0, formCalculations.totalAmount - parsed).toString());
  };

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

  // Submit: Update Bill
  const handleUpdateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!customerName.trim()) {
      const msg = "Customer name is required.";
      setFormError(msg);
      reactToast.error(msg, { autoClose: 4000 });
      return;
    }

    if (
      selectedPs5Sessions.length === 0 &&
      selectedMenuItems.length === 0 &&
      selectedCustomItems.length === 0
    ) {
      const msg = "Please add at least one item to the bill.";
      setFormError(msg);
      reactToast.error(msg, { autoClose: 4000 });
      return;
    }

    if (formCalculations.totalPaid > formCalculations.totalAmount) {
      const msg = `Total payment (${formatCurrency(formCalculations.totalPaid)}) cannot exceed total payable (${formatCurrency(formCalculations.totalAmount)}).`;
      setFormError(msg);
      reactToast.error(msg, { autoClose: 4000 });
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

      const res = await updateBillAction(billId, payload);
      if (res.success && res.bill) {
        reactToast.success(`Bill #${res.bill.id} updated successfully!`, { autoClose: 5000 });
        setUpdatedBill(res.bill);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const msg = res.error || "Failed to update bill.";
        setFormError(msg);
        reactToast.error(msg, { autoClose: 4000 });
      }
    } catch (err: unknown) {
      console.error("Error updating bill:", err);
      const msg = "A server error occurred while updating the bill.";
      setFormError(msg);
      reactToast.error(msg, { autoClose: 4000 });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Loading State ───
  if (isLoadingInitial) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        <p className="text-sm text-gray-400">Loading bill #{billId}...</p>
      </div>
    );
  }

  // ─── Not Found ───
  if (notFound) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <span className="text-5xl">🔍</span>
        <h2 className="text-xl font-bold text-white">Bill Not Found</h2>
        <p className="text-sm text-gray-400">
          No bill with ID <span className="text-purple-400 font-mono">#{billId}</span> was found.
        </p>
        <Link
          href="/admin/billing"
          className="mt-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-purple-500"
        >
          ← Back to Billing Ledger
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        theme="dark"
        style={{ zIndex: 999999 }}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
            <Link href="/admin/billing" className="hover:underline flex items-center gap-1">
              ← Billing Ledger
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">Edit Bill #{billId}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse ml-1" />
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {updatedBill ? `Bill Updated — #${updatedBill.id}` : `Edit Bill — #${billId}`}
          </h1>
          <p className="mt-1 text-xs text-gray-400">
            {updatedBill
              ? "Bill has been updated and saved to the ledger."
              : `Modify the existing bill for ${bill?.customerName || "customer"}.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/billing"
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#15151b] px-4 text-xs font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            <span>🧾</span>
            <span>All Bills</span>
          </Link>

          <Link
            href="/admin/billing/create"
            className="flex h-10 items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/20"
          >
            <span>+</span>
            <span>New Bill</span>
          </Link>
        </div>
      </div>

      {/* ── POST-UPDATE SUCCESS VIEW ── */}
      {updatedBill ? (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-xl font-bold">
                ✓
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">Bill Updated Successfully!</h3>
                <p className="text-xs text-amber-300/80">
                  Bill #{updatedBill.id} for {updatedBill.customerName} has been revised and saved.
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
                href="/admin/billing"
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#15151b] px-4 py-2.5 text-xs font-semibold text-gray-300 hover:text-white transition"
              >
                <span>🧾</span>
                <span>Ledger</span>
              </Link>
            </div>
          </div>

          {/* Printable Receipt */}
          <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#121218] p-6 sm:p-8 shadow-2xl">
            <div id="receipt-print-area" className="font-mono text-xs text-gray-200 space-y-5">
              {/* Brand Header */}
              <div className="text-center border-b border-white/10 pb-5">
                <h2 className="text-xl font-black uppercase tracking-[0.2em] text-white">
                  Corpse Club
                </h2>
                <p className="text-[11px] text-gray-400">Gaming Lounge & Cafe</p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
                  <span className="text-xs font-bold text-amber-300">
                    Updated Receipt #{updatedBill.id}
                  </span>
                </div>
                <p className="mt-2 text-[10px] text-gray-500">
                  {new Date(updatedBill.updatedAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4 border-b border-white/10 pb-4 text-[11px]">
                <div>
                  <span className="block text-[10px] text-gray-500 uppercase">Customer</span>
                  <span className="font-bold text-white text-sm">{updatedBill.customerName}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] text-gray-500 uppercase">Cashier / Staff</span>
                  <span className="font-medium text-gray-300">
                    {updatedBill.admin?.name || updatedBill.createdByEmail || "Admin"}
                  </span>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3 border-b border-white/10 pb-5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Line Items
                </span>

                {updatedBill.sessions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-semibold text-purple-400">🎮 PS5 Gaming Sessions</span>
                    {updatedBill.sessions.map((s, idx) => (
                      <div key={`s-${idx}`} className="flex items-center justify-between bg-white/[0.02] px-3 py-2 rounded-lg">
                        <div>
                          <span className={`font-semibold capitalize ${s.controller === "GTA 6" ? "text-red-400" : "text-white"}`}>
                            {s.controller === "GTA 6" ? "GTA 6 Event Pass" : `${s.controller} Controller`}
                          </span>
                          <span className="text-gray-400 ml-2">({s.duration} mins)</span>
                          <span className="text-gray-500 ml-2">× {s.quantity}</span>
                        </div>
                        <span className="font-bold text-white">{formatCurrency(s.total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {updatedBill.items.filter((i) => !i.isCustom).length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-semibold text-amber-400">☕ Cafe Menu Items</span>
                    {updatedBill.items.filter((i) => !i.isCustom).map((item, idx) => (
                      <div key={`m-${idx}`} className="flex items-center justify-between bg-white/[0.02] px-3 py-2 rounded-lg">
                        <div>
                          <span className="font-semibold text-white">{item.name}</span>
                          <span className="text-gray-500 ml-2">(₹{item.price} × {item.quantity})</span>
                        </div>
                        <span className="font-bold text-white">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {updatedBill.items.filter((i) => i.isCustom).length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-semibold text-blue-400">📦 Custom / Misc Items</span>
                    {updatedBill.items.filter((i) => i.isCustom).map((custom, idx) => (
                      <div key={`c-${idx}`} className="flex items-center justify-between bg-white/[0.02] px-3 py-2 rounded-lg">
                        <div>
                          <span className="font-semibold text-white">{custom.name}</span>
                          <span className="text-gray-500 ml-2">(₹{custom.price} × {custom.quantity})</span>
                        </div>
                        <span className="font-bold text-white">{formatCurrency(custom.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Financial Totals */}
              <div className="space-y-2 border-b border-white/10 pb-5 text-[11px]">
                <div className="flex justify-between text-gray-400">
                  <span>Gross Subtotal:</span>
                  <span>{formatCurrency(updatedBill.subtotal)}</span>
                </div>
                {updatedBill.discount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount:</span>
                    <span>-{formatCurrency(updatedBill.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-white/10">
                  <span>Total Payable:</span>
                  <span className="text-amber-400">{formatCurrency(updatedBill.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 pt-1">
                  <span>Cash Paid:</span>
                  <span>{formatCurrency(updatedBill.cashAmount)}</span>
                </div>
                <div className="flex justify-between text-blue-400">
                  <span>Online / UPI Paid:</span>
                  <span>{formatCurrency(updatedBill.onlineAmount)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-400">Payment Status:</span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      updatedBill.paymentStatus === "paid"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : updatedBill.paymentStatus === "partial"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {updatedBill.paymentStatus}
                  </span>
                </div>
                {updatedBill.notes && (
                  <div className="pt-2 text-[10px] text-gray-400 italic">
                    Note: {updatedBill.notes}
                  </div>
                )}
              </div>

              <div className="text-center pt-2 text-[10px] text-gray-500">
                <p>Thank you for choosing Corpse Club!</p>
              </div>
            </div>

            {/* Receipt Actions */}
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
                  <span>Print Receipt</span>
                </button>
                <Link
                  href="/admin/billing"
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
                >
                  <span>🧾</span>
                  <span>All Bills</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── EDIT FORM ── */
        <form onSubmit={handleUpdateBill} className="space-y-6">
          {formError && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/15 p-4 text-xs font-semibold text-red-200 shadow-xl shadow-red-500/10">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-bold text-red-400">Cannot Update Bill</p>
                  <p className="text-red-300">{formError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormError("")}
                className="rounded-lg p-1.5 text-red-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* Original Bill Info Banner */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-amber-400 font-bold">📋 Editing:</span>
            <span className="text-white font-semibold">Bill #{bill?.id}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-300">{bill?.customerName}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-400">
              Original Total:{" "}
              <span className="text-white font-bold">{formatCurrency(bill?.totalAmount || 0)}</span>
            </span>
            <span className="text-gray-400">•</span>
            <span className={`font-bold uppercase tracking-wider ${
              bill?.paymentStatus === "paid"
                ? "text-emerald-400"
                : bill?.paymentStatus === "partial"
                ? "text-amber-400"
                : "text-red-400"
            }`}>
              {bill?.paymentStatus}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* LEFT COLUMN */}
            <div className="space-y-6 lg:col-span-7">
              {/* 1. Customer Name */}
              <div className="rounded-2xl border border-white/10 bg-[#111116]/90 p-5 shadow-xl backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    1. Customer Name *
                  </span>
                  <span className="text-[11px] text-gray-500">Required</span>
                </div>
                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    list="customer-suggestions-edit"
                    required
                    placeholder="Type customer name..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#15151b] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                  />
                  <datalist id="customer-suggestions-edit">
                    {todayCustomerNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  {todayCustomerNames.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-gray-400">
                      <span className="text-[11px] text-gray-500">Today's Bookings:</span>
                      {todayCustomerNames.slice(0, 6).map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setCustomerName(name)}
                          className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300 hover:bg-amber-500/20"
                        >
                          + {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* GTA 6 Section */}
              <Gta6BillingSection onAddSession={handleAddGta6Session} />

              {/* 2. PS5 Sessions */}
              <div className="rounded-2xl border border-white/10 bg-[#111116]/90 p-5 shadow-xl backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                    2. PS5 Gaming Pod Sessions (OPTIONAL)
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTempController("single")}
                      className={`rounded-xl py-2 text-xs font-bold transition ${
                        tempController === "single"
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                          : "border border-white/10 bg-[#15151b] text-gray-400 hover:text-white"
                      }`}
                    >
                      🎮 Single Controller
                    </button>
                    <button
                      type="button"
                      onClick={() => setTempController("dual")}
                      className={`rounded-xl py-2 text-xs font-bold transition ${
                        tempController === "dual"
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                          : "border border-white/10 bg-[#15151b] text-gray-400 hover:text-white"
                      }`}
                    >
                      👥 Dual Controller
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {([20, 40, 60] as Ps5Duration[]).map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setTempDuration(dur)}
                        className={`rounded-xl py-2 text-xs font-bold transition ${
                          tempDuration === dur
                            ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                            : "border border-white/10 bg-[#15151b] text-gray-400 hover:text-white"
                        }`}
                      >
                        <div>{dur} mins</div>
                        <div className="text-[10px] opacity-80">
                          ₹{PS5_BILLING_RATES[tempController][dur]}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={tempPs5Qty}
                        onChange={(e) => setTempPs5Qty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-16 rounded-xl border border-white/10 bg-[#15151b] px-2 py-1.5 text-center text-xs text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddPs5Session}
                      className="flex-1 rounded-xl bg-purple-600 py-2 text-xs font-bold text-white shadow-md shadow-purple-600/20 hover:brightness-110"
                    >
                      + Add PS5 Session (₹{getPs5Rate(tempController, tempDuration) * Math.max(1, tempPs5Qty)})
                    </button>
                  </div>
                </div>

                {selectedPs5Sessions.length > 0 && (
                  <div className="mt-4 divide-y divide-white/5 rounded-xl border border-white/5 bg-[#15151b]">
                    {selectedPs5Sessions.map((session, idx) => {
                      const rate = session.unitPrice ?? getPs5Rate(session.controller, session.duration);
                      const total = rate * session.quantity;
                      return (
                        <div key={idx} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold capitalize ${session.controller === "GTA 6" ? "text-red-400" : "text-purple-300"}`}>
                              {session.controller === "GTA 6" ? "GTA 6 Event Pass" : `${session.controller} Controller`}
                            </span>
                            <span className="text-gray-400">({session.duration}m)</span>
                            <span className="text-gray-500">× {session.quantity}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-white">{formatCurrency(total)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemovePs5Session(idx)}
                              className="rounded p-1 text-red-400 hover:bg-white/10 hover:text-red-300"
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
              <div className="rounded-2xl border border-white/10 bg-[#111116]/90 p-5 shadow-xl backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    3. Cafe Menu Items (OPTIONAL)
                  </span>
                  <span className="text-[11px] text-gray-500">{menuItems.length} items available</span>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row items-center gap-2.5">
                  <select
                    value={tempSelectedMenuItemId}
                    onChange={(e) => setTempSelectedMenuItemId(e.target.value)}
                    className="w-full sm:flex-1 rounded-xl border border-white/10 bg-[#15151b] px-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  >
                    {menuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.category}) — ₹{item.price}
                      </option>
                    ))}
                  </select>
                  <div className="flex w-full sm:w-auto items-center gap-2">
                    <span className="text-xs text-gray-400">Qty:</span>
                    <input
                      type="number"
                      min="1"
                      value={tempMenuQty}
                      onChange={(e) => setTempMenuQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-16 rounded-xl border border-white/10 bg-[#15151b] px-2 py-1.5 text-center text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddMenuItem}
                      disabled={menuItems.length === 0}
                      className="flex-1 sm:flex-initial rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>
                {selectedMenuItems.length > 0 && (
                  <div className="mt-4 divide-y divide-white/5 rounded-xl border border-white/5 bg-[#15151b]">
                    {selectedMenuItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{item.name}</span>
                          <span className="text-gray-500">(₹{item.price} × {item.quantity})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-white">{formatCurrency(item.price * item.quantity)}</span>
                          <button type="button" onClick={() => handleRemoveMenuItem(idx)} className="rounded p-1 text-red-400 hover:bg-white/10 hover:text-red-300">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Custom Items */}
              <div className="rounded-2xl border border-white/10 bg-[#111116]/90 p-5 shadow-xl backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                    4. Miscellaneous Costs (OPTIONAL)
                  </span>
                  <span className="text-[11px] text-gray-500">Out-of-menu items</span>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <input
                    type="text"
                    placeholder="Item name (e.g. Cold Drink)"
                    value={tempCustomName}
                    onChange={(e) => setTempCustomName(e.target.value)}
                    className="sm:col-span-5 rounded-xl border border-white/10 bg-[#15151b] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Price (₹)"
                    value={tempCustomPrice}
                    onChange={(e) => setTempCustomPrice(e.target.value)}
                    className="sm:col-span-3 rounded-xl border border-white/10 bg-[#15151b] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  />
                  <div className="sm:col-span-2 flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">Qty:</span>
                    <input
                      type="number"
                      min="1"
                      value={tempCustomQty}
                      onChange={(e) => setTempCustomQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-14 rounded-xl border border-white/10 bg-[#15151b] px-2 py-1.5 text-center text-xs text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomItem}
                    className="sm:col-span-2 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:brightness-110"
                  >
                    + Add
                  </button>
                </div>
                {selectedCustomItems.length > 0 && (
                  <div className="mt-4 divide-y divide-white/5 rounded-xl border border-white/5 bg-[#15151b]">
                    {selectedCustomItems.map((custom, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-blue-300">{custom.name}</span>
                          <span className="text-gray-500">(₹{custom.price} × {custom.quantity})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-white">{formatCurrency(custom.price * custom.quantity)}</span>
                          <button type="button" onClick={() => handleRemoveCustomItem(idx)} className="rounded p-1 text-red-400 hover:bg-white/10 hover:text-red-300">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Order Summary */}
            <div className="space-y-6 lg:col-span-5">
              <div className="sticky top-24 rounded-2xl border border-white/10 bg-[#111116]/90 p-6 shadow-2xl backdrop-blur-xl space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
                    Payment Settlement
                  </h3>
                  <p className="text-xs text-gray-500">Updated order breakdown & split payment</p>
                </div>

                {/* Subtotals */}
                <div className="space-y-2.5 border-b border-white/10 pb-5 text-xs">
                  <div className="flex justify-between text-gray-400">
                    <span>PS5 Gaming Subtotal:</span>
                    <span className="font-semibold text-white">{formatCurrency(formCalculations.ps5Sum)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Cafe Subtotal:</span>
                    <span className="font-semibold text-white">{formatCurrency(formCalculations.cafeSum)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Custom Items Subtotal:</span>
                    <span className="font-semibold text-white">{formatCurrency(formCalculations.customSum)}</span>
                  </div>
                  <div className="flex justify-between text-gray-300 pt-2 border-t border-white/5 font-semibold">
                    <span>Gross Subtotal:</span>
                    <span className="text-white">{formatCurrency(formCalculations.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-emerald-400 font-semibold">Discount (₹):</span>
                    <input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(e) => handleDiscountChange(e.target.value)}
                      className="w-24 rounded-xl border border-white/10 bg-[#15151b] px-3 py-1.5 text-right text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-baseline justify-between pt-3 border-t border-white/10">
                    <span className="text-sm font-bold text-white">Total Payable:</span>
                    <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                      {formatCurrency(formCalculations.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Split Payment Controls */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold uppercase tracking-wider text-gray-300">Payment Method Split</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={handleSetAllCash} className="rounded-xl border border-white/10 bg-[#15151b] py-2 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/10 transition">
                      All Cash
                    </button>
                    <button type="button" onClick={handleSetAllOnline} className="rounded-xl border border-white/10 bg-[#15151b] py-2 text-[11px] font-semibold text-blue-400 hover:bg-blue-500/10 transition">
                      All Online
                    </button>
                    <button type="button" onClick={handleSetSplit5050} className="rounded-xl border border-white/10 bg-[#15151b] py-2 text-[11px] font-semibold text-purple-400 hover:bg-purple-500/10 transition">
                      Split 50/50
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-emerald-400">Cash Paid (₹)</label>
                      <input
                        type="number"
                        min="0"
                        max={formCalculations.totalAmount}
                        value={cashAmount}
                        onChange={(e) => handleCashChange(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-[#15151b] px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-blue-400">Online / UPI Paid (₹)</label>
                      <input
                        type="number"
                        min="0"
                        max={formCalculations.totalAmount}
                        value={onlineAmount}
                        onChange={(e) => handleOnlineChange(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-[#15151b] px-3.5 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-gray-400">Total Collected:</span>
                    <span className="font-bold text-white">{formatCurrency(formCalculations.totalPaid)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Status:</span>
                    <span className={`font-bold uppercase tracking-wider ${
                      formCalculations.status === "paid"
                        ? "text-emerald-400"
                        : formCalculations.status === "partial"
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}>
                      {formCalculations.status}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <input
                    type="text"
                    placeholder="Optional transaction remarks..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#15151b] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>

                {/* Submit */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-amber-500/25 transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? "Updating Bill..." : "Update & Save Bill"}
                  </button>
                  <p className="mt-2 text-center text-[10px] text-gray-500">
                    All changes are immediately reflected in the billing ledger and passbook.
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
