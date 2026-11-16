"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getMenuItemsAction,
  createMenuItemAction,
  updateMenuItemAction,
  deleteMenuItemAction,
  toggleMenuItemStockAction,
  seedDefaultMenuAction,
  MenuItemData,
} from "@/actions/menu-actions";
import { formatCurrency } from "@/lib/pricing";

const PRESET_CATEGORIES = [
  "Beverages",
  "Coffee",
  "Snacks",
  "Food",
  "Combos",
  "Desserts",
];

export default function AdminMenuPage() {
  const [items, setItems] = useState<MenuItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemData | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "Beverages",
    customCategory: "",
    price: "",
    description: "",
    isAvailable: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<MenuItemData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadMenu = async () => {
    setIsLoading(true);
    const res = await getMenuItemsAction();
    if (res.success) {
      setItems(res.items);
    } else {
      showToast(res.error || "Failed to load menu", "error");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadMenu();
  }, []);

  // Unique categories derived from items
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.category));
    return ["all", ...Array.from(set)];
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" ||
        item.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description &&
          item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      category: "Beverages",
      customCategory: "",
      price: "",
      description: "",
      isAvailable: true,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (item: MenuItemData) => {
    setEditingItem(item);
    const isPreset = PRESET_CATEGORIES.includes(item.category);
    setFormData({
      name: item.name,
      category: isPreset ? item.category : "Custom",
      customCategory: isPreset ? "" : item.category,
      price: item.price.toString(),
      description: item.description || "",
      isAvailable: item.isAvailable,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Submit Add/Edit form
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formData.name.trim()) {
      setFormError("Item name is required.");
      return;
    }

    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError("Valid positive price is required.");
      return;
    }

    const finalCategory =
      formData.category === "Custom"
        ? formData.customCategory.trim() || "General"
        : formData.category;

    setIsSaving(true);
    try {
      if (editingItem) {
        const res = await updateMenuItemAction(editingItem.id, {
          name: formData.name.trim(),
          category: finalCategory,
          price: priceNum,
          description: formData.description.trim(),
          isAvailable: formData.isAvailable,
        });
        if (res.success && res.item) {
          setItems((prev) => prev.map((i) => (i.id === editingItem.id ? res.item! : i)));
          setIsModalOpen(false);
          showToast(`Updated "${res.item.name}"`);
        } else {
          setFormError(res.error || "Failed to update item.");
        }
      } else {
        const res = await createMenuItemAction({
          name: formData.name.trim(),
          category: finalCategory,
          price: priceNum,
          description: formData.description.trim(),
          isAvailable: formData.isAvailable,
        });
        if (res.success && res.item) {
          setItems((prev) => [res.item!, ...prev]);
          setIsModalOpen(false);
          showToast(`Added "${res.item.name}" to menu`);
        } else {
          setFormError(res.error || "Failed to add item.");
        }
      }
    } catch {
      setFormError("Server error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle in-stock / out-of-stock
  const handleToggleStock = async (item: MenuItemData) => {
    const nextState = !item.isAvailable;
    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isAvailable: nextState } : i))
    );
    const res = await toggleMenuItemStockAction(item.id, nextState);
    if (!res.success) {
      // Revert if failed
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isAvailable: item.isAvailable } : i))
      );
      showToast("Failed to update availability", "error");
    } else {
      showToast(`${item.name} marked as ${nextState ? "In Stock" : "Out of Stock"}`);
    }
  };

  // Delete Item
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await deleteMenuItemAction(deleteTarget.id);
    if (res.success) {
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      showToast(`Removed "${deleteTarget.name}" from catalog`);
      setDeleteTarget(null);
    } else {
      showToast(res.error || "Failed to delete item", "error");
    }
    setIsDeleting(false);
  };

  // Seed sample menu
  // const handleSeedMenu = async () => {
  //   setIsLoading(true);
  //   const res = await seedDefaultMenuAction();
  //   if (res.success) {
  //     showToast(`Seeded ${res.count} cafe menu items!`);
  //     loadMenu();
  //   } else {
  //     showToast(res.error || "Failed to seed menu", "error");
  //     setIsLoading(false);
  //   }
  // };

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
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

      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
              Lounge Kitchen & Cafe
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="text-xs text-gray-500">Catalog Manager</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Cafe Menu Management
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Add, update, or toggle stock for food, beverages, and snacks served at Corpse Club.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* {items.length === 0 && !isLoading && (
            <button
              type="button"
              onClick={handleSeedMenu}
              className="flex h-10 items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
            >
              <span>🌱</span>
              <span>Load Sample Menu</span>
            </button>
          )} */}

          <button
            type="button"
            onClick={loadMenu}
            disabled={isLoading}
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#15151b] px-4 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            <span className={isLoading ? "animate-spin" : ""}>🔄</span>
            <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 text-xs font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:brightness-110"
          >
            <span className="text-base font-bold">+</span>
            <span>Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Total Catalog Items
          </span>
          <p className="mt-2 text-2xl font-extrabold text-white">{items.length}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
            In Stock
          </span>
          <p className="mt-2 text-2xl font-extrabold text-emerald-400">
            {items.filter((i) => i.isAvailable).length}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111116]/80 p-5 backdrop-blur-xl">
          <span className="text-xs font-medium uppercase tracking-wider text-red-400">
            Out of Stock
          </span>
          <p className="mt-2 text-2xl font-extrabold text-red-400">
            {items.filter((i) => !i.isAvailable).length}
          </p>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                selectedCategory === cat
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                  : "border border-white/10 bg-[#15151b] text-gray-400 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full rounded-xl border border-white/10 bg-[#15151b] px-4 py-2 text-xs text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
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

      {/* Menu Catalog Table / Grid */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111116]/90 backdrop-blur-xl">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <p className="text-xs text-gray-400">Loading catalog items...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="text-4xl">☕</span>
            <p className="text-sm font-semibold text-white">No menu items found</p>
            <p className="max-w-md text-xs text-gray-500">
              {searchQuery || selectedCategory !== "all"
                ? "Try clearing your filters or search keywords."
                : "Your catalog is empty. Click 'Add Menu Item' or load sample items to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="border-b border-white/10 bg-[#15151b]/60 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Availability</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-gray-500">{item.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-lg border border-white/10 bg-[#1a1a24] px-2.5 py-1 text-xs font-medium text-amber-300">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-white">{formatCurrency(item.price)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStock(item)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                          item.isAvailable
                            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            item.isAvailable ? "bg-emerald-400" : "bg-red-400"
                          }`}
                        />
                        <span>{item.isAvailable ? "In Stock" : "Out of Stock"}</span>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="rounded-lg border border-white/10 bg-[#1c1c24] px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
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
                {editingItem ? "Edit Menu Item" : "Add New Menu Item"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-400">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cold Coffee Classic"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#1a1a24] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#1a1a24] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  >
                    {PRESET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="Custom">+ Custom Category</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="90"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#1a1a24] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {formData.category === "Custom" && (
                <div>
                  <label className="block text-xs font-medium text-gray-400">
                    Custom Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Specialty Shakes"
                    value={formData.customCategory}
                    onChange={(e) =>
                      setFormData({ ...formData, customCategory: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#1a1a24] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-400">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Short description of the item..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#1a1a24] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isAvailableCheck"
                  checked={formData.isAvailable}
                  onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                  className="h-4 w-4 rounded border-white/20 bg-[#1a1a24] text-amber-500 focus:ring-0"
                />
                <label htmlFor="isAvailableCheck" className="text-xs font-medium text-gray-300">
                  Mark as Available (In Stock for billing)
                </label>
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
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-500/20 hover:brightness-110 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : editingItem ? "Update Item" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#151214] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Delete Menu Item?</h3>
            <p className="mt-2 text-xs text-gray-400">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-white">"{deleteTarget.name}"</span>?
            </p>
            <p className="mt-2 text-xs text-amber-400/80">
              Note: Past bills containing this item will NOT be affected.
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
