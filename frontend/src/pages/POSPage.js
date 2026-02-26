import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { venueAPI, posAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Plus, Minus, Trash2, Wifi, WifiOff, RefreshCw,
  Package, IndianRupee, CheckCircle, X, Pencil, BarChart3,
  Banknote, CreditCard, Smartphone, History, ShieldAlert,
  Printer, Share2, Download, User, AlertTriangle
} from "lucide-react";

// --- Offline queue helpers (IndexedDB with localStorage fallback) -------
import {
  addToOfflineQueue, getOfflineQueue, clearOfflineQueue,
  getOfflineQueueCount, getCachedProducts as idbGetCachedProducts,
  cacheProducts as idbCacheProducts, logSyncEvent, registerBackgroundSync,
  migrateFromLocalStorage
} from "@/lib/offline-store";

// Async wrappers for IndexedDB operations
const getQueueAsync = () => getOfflineQueue().catch(() => []);
const addToQueueAsync = (sale) => addToOfflineQueue(sale).catch(() => {});
const clearQueueAsync = () => clearOfflineQueue().catch(() => {});
const getQueueCountAsync = () => getOfflineQueueCount().catch(() => 0);
const getCachedProductsAsync = (venueId) => idbGetCachedProducts(venueId).catch(() => null);
const cacheProductsAsync = (venueId, products) => idbCacheProducts(venueId, products).catch(() => {});

// --- Config -------------------------------------------------------
const CATEGORIES = [
  { id: "all", label: "All", emoji: "📋" },
  { id: "beverages", label: "Beverages", emoji: "🥤" },
  { id: "snacks", label: "Snacks", emoji: "🍿" },
  { id: "equipment", label: "Equipment", emoji: "⚽" },
  { id: "apparel", label: "Apparel", emoji: "👕" },
  { id: "other", label: "Other", emoji: "🛒" },
];

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: Banknote, color: "text-emerald-400" },
  { id: "card", label: "Card", icon: CreditCard, color: "text-sky-400" },
  { id: "upi", label: "UPI", icon: Smartphone, color: "text-violet-400" },
];

const CAT_EMOJI = { beverages: "🥤", snacks: "🍿", equipment: "⚽", apparel: "👕", other: "🛒" };
const LOW_STOCK_THRESHOLD = 5;

// --- Product Card -------------------------------------------------------
function ProductCard({ product, cartQty, onAdd, onRemove }) {
  const outOfStock = product.stock === 0;
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className={`glass-card rounded-xl p-3 flex flex-col gap-2 transition-all select-none
        ${outOfStock ? "opacity-50" : "hover:border-primary/40 cursor-pointer"}
        ${cartQty > 0 ? "border-primary/50 bg-primary/5" : ""}`}
      onClick={() => !outOfStock && onAdd(product)}
      data-testid={`product-card-${product.id}`}>
      <div className="text-3xl text-center">{product.emoji || CAT_EMOJI[product.category] || "🛒"}</div>
      <div className="flex-1">
        <p className="text-xs font-bold text-foreground leading-tight line-clamp-2">{product.name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{product.category}</p>
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-display font-black text-primary">₹{product.price}</span>
        {outOfStock ? (
          <span className="text-[10px] text-destructive font-bold">Out</span>
        ) : (
          <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
            {cartQty > 0 && (
              <button onClick={() => onRemove(product)}
                className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center hover:bg-destructive/20 transition-colors">
                <Minus className="h-3 w-3" />
              </button>
            )}
            {cartQty > 0 && <span className="text-xs font-bold w-5 text-center">{cartQty}</span>}
            <button onClick={() => onAdd(product)}
              className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/40 transition-colors">
              <Plus className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      {product.stock > 0 && (
        <div className={`text-[9px] ${product.stock <= LOW_STOCK_THRESHOLD ? "text-amber-400 font-bold" : "text-muted-foreground/60"}`}>
          {product.stock} left {product.stock <= LOW_STOCK_THRESHOLD ? "⚠" : ""}
        </div>
      )}
    </motion.div>
  );
}

// --- Main POS Page -------------------------------------------------------
export default function POSPage() {
  const { user } = useAuth();
  if (user?.role !== "venue_owner" && user?.role !== "super_admin") {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="glass-card rounded-lg p-8 space-y-4">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="font-display text-xl font-black">Access Denied</h1>
          <p className="text-sm text-muted-foreground">POS is only available to venue owners.</p>
        </div>
      </div>
    );
  }
  return <POSTerminal user={user} />;
}

function POSTerminal({ user }) {
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [charging, setCharging] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [activeView, setActiveView] = useState("pos");
  const [summary, setSummary] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: "", category: "beverages", price: "", stock: "-1", emoji: "" });
  // Feature: Discount
  const [discountType, setDiscountType] = useState("percent");
  const [discountValue, setDiscountValue] = useState("");
  // Feature: Customer
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  // Ref for receipt printing
  const receiptRef = useRef(null);

  // Online/offline listeners + IndexedDB init
  useEffect(() => {
    const onOnline = () => { setIsOnline(true); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Init: migrate localStorage to IndexedDB, then load count
    migrateFromLocalStorage().then(() => getQueueCountAsync()).then(setPendingCount);
    // Register POS Service Worker ONLY in production (dev uses hot reload, SW would cache stale bundles)
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/pos-sw.js").then((reg) => {
        registerBackgroundSync();
        // Auto-update: check for new SW every 5 minutes
        setInterval(() => reg.update(), 5 * 60 * 1000);
      }).catch(() => {});
    } else if (process.env.NODE_ENV !== "production" && "serviceWorker" in navigator) {
      // Dev mode: unregister any existing SW to prevent caching issues
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    }
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  // Sync queue when back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && selectedVenue) syncQueue();
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load venues (with offline cache fallback)
  useEffect(() => {
    venueAPI.getOwnerVenues().then(r => {
      const v = r.data || [];
      setVenues(v);
      if (v.length > 0) setSelectedVenue(v[0]);
      try { localStorage.setItem("pos_venues", JSON.stringify(v)); } catch {}
    }).catch((err) => {
      // Offline — load cached venues
      if (!err.response) {
        try {
          const cached = JSON.parse(localStorage.getItem("pos_venues"));
          if (cached?.length) { setVenues(cached); setSelectedVenue(cached[0]); return; }
        } catch {}
      }
      toast.error("Failed to load venues");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load products when venue changes (IndexedDB cache)
  useEffect(() => {
    if (!selectedVenue) return;
    getCachedProductsAsync(selectedVenue.id).then(cached => { if (cached) setProducts(cached); });
    posAPI.listProducts(selectedVenue.id)
      .then(r => { setProducts(r.data || []); cacheProductsAsync(selectedVenue.id, r.data || []); })
      .catch(() => {});
  }, [selectedVenue]);

  // Cart ops
  const addToCart = (product) => setCart(prev => {
    const ex = prev.find(c => c.product.id === product.id);
    if (ex) return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
    return [...prev, { product, qty: 1 }];
  });

  const removeFromCart = (product) => setCart(prev => {
    const ex = prev.find(c => c.product.id === product.id);
    if (!ex) return prev;
    if (ex.qty <= 1) return prev.filter(c => c.product.id !== product.id);
    return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty - 1 } : c);
  });

  const clearCart = () => { setCart([]); setDiscountValue(""); setCustomerName(""); setCustomerPhone(""); };
  const cartTotal = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  const cartQty = (id) => cart.find(c => c.product.id === id)?.qty || 0;

  // Discount computed values
  const discountNumeric = parseFloat(discountValue) || 0;
  const discountAmount = discountType === "percent"
    ? Math.round(cartTotal * Math.min(discountNumeric, 100) / 100 * 100) / 100
    : Math.min(discountNumeric, cartTotal);
  const finalTotal = Math.round((cartTotal - discountAmount) * 100) / 100;

  // Offline sync (IndexedDB)
  const syncQueue = useCallback(async () => {
    if (!selectedVenue) return;
    const queue = await getQueueAsync();
    if (!queue.length) return;
    setSyncing(true);
    try {
      await posAPI.syncBatch(selectedVenue.id, queue);
      await clearQueueAsync();
      setPendingCount(0);
      await logSyncEvent({ type: "sync_success", count: queue.length, venue_id: selectedVenue.id });
      toast.success(`${queue.length} offline sale${queue.length > 1 ? "s" : ""} synced!`);
      loadSummary();
    } catch {
      await logSyncEvent({ type: "sync_failed", count: queue.length, venue_id: selectedVenue.id });
      toast.error("Sync failed — will retry when reconnected");
    } finally { setSyncing(false); }
  }, [selectedVenue]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSummary = useCallback(() => {
    if (!selectedVenue) return;
    posAPI.summary(selectedVenue.id).then(r => setSummary(r.data)).catch(() => {});
  }, [selectedVenue]);

  const loadRecentSales = useCallback(() => {
    if (!selectedVenue) return;
    posAPI.listSales(selectedVenue.id, 30).then(r => setRecentSales(r.data || [])).catch(() => {});
  }, [selectedVenue]);

  // Receipt handlers
  const handlePrintReceipt = () => {
    if (!lastSale) return;
    const items = (lastSale.items || []).map(i =>
      `<tr><td>${i.name} x${i.qty}</td><td style="text-align:right;font-weight:bold">₹${i.price * i.qty}</td></tr>`
    ).join("");
    const discount = lastSale.discount_amount > 0 ? `
      <tr><td>Subtotal</td><td style="text-align:right">₹${lastSale.subtotal}</td></tr>
      <tr><td>Discount</td><td style="text-align:right">-₹${lastSale.discount_amount}</td></tr>` : "";
    const customer = (lastSale.customer_name || lastSale.customer_phone)
      ? `<tr><td>Customer</td><td style="text-align:right">${[lastSale.customer_name, lastSale.customer_phone].filter(Boolean).join(" — ")}</td></tr>` : "";
    const html = `<!DOCTYPE html><html><head><title>Receipt</title>
      <style>body{font-family:'Courier New',monospace;width:80mm;margin:0 auto;padding:6mm;font-size:12px}
      table{width:100%;border-collapse:collapse}td{padding:2px 0}.center{text-align:center}
      .divider{border-top:1px dashed #999;margin:6px 0}.bold{font-weight:bold}
      .total{font-size:18px;font-weight:900}.small{font-size:10px;color:#666}</style></head>
      <body><div class="center"><b>${selectedVenue?.name || "Venue"}</b><br>
      <span class="small">${new Date(lastSale.created_at || lastSale.offline_at).toLocaleString("en-IN")}</span></div>
      <div class="divider"></div><table>${items}</table><div class="divider"></div>
      ${discount ? `<table>${discount}</table>` : ""}
      <table><tr><td class="bold">Total</td><td style="text-align:right" class="total">₹${lastSale.total}</td></tr>
      <tr><td>Payment</td><td style="text-align:right">${lastSale.payment_method}</td></tr>
      ${customer}</table>
      <div class="divider"></div><p class="center small">Thank you!</p>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`;
    const win = window.open("", "_blank", "width=320,height=600");
    win.document.write(html);
    win.document.close();
  };
  const handleShareWhatsApp = () => {
    if (!lastSale) return;
    const lines = [
      `*Receipt — ${selectedVenue?.name || "Venue"}*`,
      `Date: ${new Date(lastSale.created_at || lastSale.offline_at).toLocaleString("en-IN")}`,
      "",
      ...(lastSale.items || []).map(i => `${i.name} x${i.qty} — ₹${i.price * i.qty}`),
      "",
    ];
    if (lastSale.discount_amount > 0) {
      lines.push(`Subtotal: ₹${lastSale.subtotal}`);
      lines.push(`Discount: -₹${lastSale.discount_amount}`);
    }
    lines.push(`*Total: ₹${lastSale.total}*`);
    lines.push(`Payment: ${lastSale.payment_method}`);
    if (lastSale.customer_name) lines.push(`Customer: ${lastSale.customer_name}`);
    if (lastSale.customer_phone) lines.push(`Phone: ${lastSale.customer_phone}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  };

  // CSV export
  const handleExportCSV = async () => {
    if (!selectedVenue) return;
    const today = new Date().toISOString().split("T")[0];
    try {
      const res = await posAPI.report(selectedVenue.id, today);
      const sales = res.data.sales || [];
      if (!sales.length) { toast("No sales to export"); return; }
      const headers = ["Time", "Items", "Qty", "Payment", "Subtotal", "Discount", "Total", "Customer Name", "Customer Phone"];
      const rows = sales.map(s => [
        new Date(s.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        (s.items || []).map(i => i.name).join("; "),
        (s.items || []).reduce((sum, i) => sum + (i.qty || 1), 0),
        s.payment_method || "cash",
        s.subtotal || s.total || 0,
        s.discount_amount || 0,
        s.total || 0,
        s.customer_name || "",
        s.customer_phone || "",
      ]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pos-report-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded!");
    } catch {
      toast.error("Failed to generate report");
    }
  };

  // Low stock computed
  const lowStockProducts = products.filter(p => p.stock >= 0 && p.stock <= LOW_STOCK_THRESHOLD && p.is_active !== false);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => {
    if (activeView === "history") loadRecentSales();
    if (activeView === "summary") loadSummary();
  }, [activeView, loadRecentSales, loadSummary]);

  // Charge
  const handleCharge = async () => {
    if (!cart.length || !selectedVenue) return;
    setCharging(true);
    const saleData = {
      venue_id: selectedVenue.id,
      items: cart.map(c => ({ product_id: c.product.id, name: c.product.name, price: c.product.price, qty: c.qty })),
      subtotal: cartTotal,
      discount_type: discountAmount > 0 ? discountType : null,
      discount_value: discountAmount > 0 ? discountNumeric : 0,
      discount_amount: discountAmount,
      total: finalTotal,
      payment_method: paymentMethod,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      offline_id: `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      ...(isOnline ? {} : { offline_at: new Date().toISOString() }),
    };
    try {
      let result;
      if (isOnline) {
        const res = await posAPI.recordSale(saleData);
        result = res.data;
        loadSummary();
      } else {
        await addToQueueAsync(saleData);
        const count = await getQueueCountAsync();
        setPendingCount(count);
        result = { ...saleData, created_at: saleData.offline_at, offline: true };
        toast("Sale saved offline — will sync when connected", { icon: "📴" });
      }
      setLastSale(result);
      setShowReceipt(true);
      // Low stock check before clearing cart
      const lowAfterSale = cart.filter(c => {
        const p = products.find(pr => pr.id === c.product.id);
        if (!p || p.stock < 0) return false;
        const remaining = p.stock - c.qty;
        return remaining >= 0 && remaining <= LOW_STOCK_THRESHOLD;
      });
      if (lowAfterSale.length > 0) {
        toast.warning(`Low stock: ${lowAfterSale.map(c => c.product.name).join(", ")}`);
      }
      clearCart();
      setProducts(prev => prev.map(p => {
        const item = cart.find(c => c.product.id === p.id);
        if (!item || p.stock < 0) return p;
        return { ...p, stock: Math.max(0, p.stock - item.qty) };
      }));
    } catch (err) {
      // Network error (no response) → fallback to offline IndexedDB
      if (!err.response) {
        try {
          saleData.offline_at = saleData.offline_at || new Date().toISOString();
          await addToQueueAsync(saleData);
          const count = await getQueueCountAsync();
          setPendingCount(count);
          setIsOnline(false);
          const offlineResult = { ...saleData, created_at: saleData.offline_at, offline: true };
          setLastSale(offlineResult);
          setShowReceipt(true);
          const lowAfterSale = cart.filter(c => {
            const p = products.find(pr => pr.id === c.product.id);
            if (!p || p.stock < 0) return false;
            return (p.stock - c.qty) >= 0 && (p.stock - c.qty) <= LOW_STOCK_THRESHOLD;
          });
          if (lowAfterSale.length > 0) toast.warning(`Low stock: ${lowAfterSale.map(c => c.product.name).join(", ")}`);
          clearCart();
          setProducts(prev => prev.map(p => {
            const item = cart.find(c => c.product.id === p.id);
            if (!item || p.stock < 0) return p;
            return { ...p, stock: Math.max(0, p.stock - item.qty) };
          }));
          toast("Network unreachable — sale saved offline", { icon: "📴" });
          return;
        } catch (offlineErr) {
          toast.error("Failed to save sale offline");
          return;
        }
      }
      toast.error(err?.response?.data?.detail || "Charge failed");
    } finally { setCharging(false); }
  };

  // Product CRUD
  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: "", category: "beverages", price: "", stock: "-1", emoji: "" });
    setProductDialogOpen(true);
  };
  const openEditProduct = (p) => {
    setEditingProduct(p);
    setProductForm({ name: p.name, category: p.category, price: String(p.price), stock: String(p.stock), emoji: p.emoji || "" });
    setProductDialogOpen(true);
  };
  const [savingProduct, setSavingProduct] = useState(false);
  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) { toast.error("Product name is required"); return; }
    if (!productForm.price || parseFloat(productForm.price) < 0) { toast.error("Valid price is required"); return; }
    if (!selectedVenue) { toast.error("No venue selected. Please add a venue first."); return; }
    setSavingProduct(true);
    const payload = {
      venue_id: selectedVenue.id, name: productForm.name.trim(), category: productForm.category,
      price: parseFloat(productForm.price), stock: parseInt(productForm.stock, 10),
      emoji: productForm.emoji || CAT_EMOJI[productForm.category],
    };
    try {
      if (editingProduct) {
        const res = await posAPI.updateProduct(editingProduct.id, payload);
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? res.data : p));
        toast.success("Product updated");
      } else {
        const res = await posAPI.createProduct(payload);
        setProducts(prev => [...prev, res.data]);
        toast.success("Product added");
      }
      setProductDialogOpen(false);
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed to save product"); }
    finally { setSavingProduct(false); }
  };
  const handleDeleteProduct = async (id) => {
    try {
      await posAPI.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      toast.success("Product removed");
    } catch { toast.error("Failed to delete"); }
  };
  const handleToggleProduct = async (p) => {
    try {
      const res = await posAPI.updateProduct(p.id, { is_active: !p.is_active });
      setProducts(prev => prev.map(x => x.id === p.id ? res.data : x));
    } catch { toast.error("Failed"); }
  };

  const filteredProducts = activeCategory === "all"
    ? products.filter(p => p.is_active !== false)
    : products.filter(p => p.is_active !== false && p.category === activeCategory);

  const VIEWS = [
    { id: "pos", icon: ShoppingCart, label: "POS" },
    { id: "products", icon: Package, label: "Products" },
    { id: "summary", icon: BarChart3, label: "Today" },
    { id: "history", icon: History, label: "History" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 pb-24 md:pb-6" data-testid="pos-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Point of Sale</span>
          <h1 className="font-display text-xl font-black tracking-tight">⚽ Venue POS</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isOnline ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"}`}>
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? "Online" : "Offline"}
          </div>
          {pendingCount > 0 && (
            <button onClick={syncQueue} disabled={!isOnline || syncing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 disabled:opacity-50"
              data-testid="sync-btn">
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              Sync {pendingCount}
            </button>
          )}
        </div>
      </div>

      {/* Venue selector */}
      {venues.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {venues.map(v => (
            <button key={v.id} onClick={() => setSelectedVenue(v)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedVenue?.id === v.id ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
              {v.name}
            </button>
          ))}
        </div>
      )}

      {/* View tabs */}
      <div className="flex gap-1 mb-5 bg-secondary/30 p-1 rounded-lg w-fit">
        {VIEWS.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setActiveView(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeView === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            data-testid={`pos-tab-${id}`}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ─── POS Terminal View ─── */}
      {activeView === "pos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Products */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
                  data-testid={`cat-${cat.id}`}>
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm">No products yet</p>
                <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={() => setActiveView("products")}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Products
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                <AnimatePresence>
                  {filteredProducts.map(p => (
                    <ProductCard key={p.id} product={p} cartQty={cartQty(p.id)} onAdd={addToCart} onRemove={removeFromCart} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-xl p-4 sticky top-20" data-testid="pos-cart">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  <h2 className="font-bold text-sm">Cart</h2>
                  {cart.length > 0 && <Badge className="text-[10px] bg-primary/20 text-primary">{cart.reduce((s, c) => s + c.qty, 0)}</Badge>}
                </div>
                {cart.length > 0 && (
                  <button onClick={clearCart} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Clear</button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs">Tap products to add</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-4">
                    <AnimatePresence>
                      {cart.map(({ product, qty }) => (
                        <motion.div key={product.id} layout initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                          className="flex items-center gap-2" data-testid={`cart-item-${product.id}`}>
                          <span className="text-lg">{product.emoji || "🛒"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{product.name}</p>
                            <p className="text-[10px] text-muted-foreground">₹{product.price} × {qty}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => removeFromCart(product)} className="h-5 w-5 rounded-full bg-secondary flex items-center justify-center"><Minus className="h-2.5 w-2.5" /></button>
                            <span className="text-xs font-bold w-4 text-center">{qty}</span>
                            <button onClick={() => addToCart(product)} className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center"><Plus className="h-2.5 w-2.5" /></button>
                          </div>
                          <span className="text-xs font-bold text-primary w-14 text-right">₹{product.price * qty}</span>
                          <button onClick={() => setCart(prev => prev.filter(c => c.product.id !== product.id))} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <div className="border-t border-border pt-3 mb-4 space-y-2">
                    {/* Discount */}
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Discount</p>
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => setDiscountType("percent")}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${discountType === "percent" ? "bg-primary/20 text-primary" : "bg-secondary/50 text-muted-foreground"}`}>%</button>
                        <button onClick={() => setDiscountType("flat")}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${discountType === "flat" ? "bg-primary/20 text-primary" : "bg-secondary/50 text-muted-foreground"}`}>₹</button>
                      </div>
                    </div>
                    <Input type="number" placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 50"}
                      value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                      className="h-8 text-xs bg-background border-border" />
                    {discountAmount > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Subtotal</span><span>₹{cartTotal}</span>
                      </div>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex items-center justify-between text-xs text-emerald-400">
                        <span>Discount ({discountType === "percent" ? `${discountNumeric}%` : `₹${discountNumeric}`})</span>
                        <span>-₹{discountAmount}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">Total</span>
                      <span className="text-xl font-display font-black text-primary">₹{finalTotal}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Payment</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PAYMENT_METHODS.map(m => (
                        <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                          className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-bold transition-all ${paymentMethod === m.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                          data-testid={`pay-${m.id}`}>
                          <m.icon className={`h-4 w-4 ${paymentMethod === m.id ? "text-primary" : m.color}`} />
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 space-y-2">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Customer (optional)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Name" value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        className="h-8 text-xs bg-background border-border" />
                      <Input placeholder="Phone" value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        className="h-8 text-xs bg-background border-border" type="tel" />
                    </div>
                  </div>

                  <Button className="w-full bg-primary text-primary-foreground font-black h-12 text-base" onClick={handleCharge} disabled={charging} data-testid="charge-btn">
                    {charging ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><IndianRupee className="h-5 w-5 mr-1" />Charge ₹{finalTotal}</>}
                  </Button>
                  {!isOnline && <p className="text-[10px] text-amber-400 text-center mt-2">📴 Offline — sale will sync when connected</p>}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Products Management ─── */}
      {activeView === "products" && (
        <div className="space-y-4">
          {!selectedVenue && (
            <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/10 p-4 text-center">
              <p className="text-sm font-bold text-amber-400">No venue selected</p>
              <p className="text-xs text-muted-foreground mt-1">You need at least one venue to manage POS products. Add a venue from your dashboard first.</p>
            </div>
          )}
          {lowStockProducts.length > 0 && (
            <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-400">Low Stock Alert</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lowStockProducts.map(p => `${p.name} (${p.stock} left)`).join(", ")}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base">Products Catalog</h2>
            <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8" onClick={openCreateProduct} disabled={!selectedVenue} data-testid="add-product-btn">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Product
            </Button>
          </div>
          {products.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm">No products yet. Add your first item!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map(p => (
                <div key={p.id} className={`glass-card rounded-lg p-3 flex items-center gap-3 ${p.is_active === false ? "opacity-50" : ""} ${p.stock >= 0 && p.stock <= LOW_STOCK_THRESHOLD && p.is_active !== false ? "border-amber-500/50 bg-amber-500/5" : ""}`} data-testid={`manage-product-${p.id}`}>
                  <span className="text-2xl">{p.emoji || CAT_EMOJI[p.category] || "🛒"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <Badge variant="secondary" className="text-[10px] capitalize">{p.category}</Badge>
                      {p.stock >= 0 && p.stock <= LOW_STOCK_THRESHOLD && p.is_active !== false && (
                        <Badge className="text-[9px] bg-amber-500/15 text-amber-400">Low Stock</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">₹{p.price} · {p.stock < 0 ? "Unlimited" : `${p.stock} left`}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleToggleProduct(p)}
                      className={`w-9 h-5 rounded-full transition-all relative ${p.is_active !== false ? "bg-primary" : "bg-secondary"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${p.is_active !== false ? "left-4" : "left-0.5"}`} />
                    </button>
                    <button onClick={() => openEditProduct(p)} className="h-7 w-7 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDeleteProduct(p.id)} className="h-7 w-7 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Today Summary ─── */}
      {activeView === "summary" && (
        summary ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">Today's Summary <span className="text-muted-foreground font-normal text-sm ml-2">{summary.today}</span></h2>
              <Button size="sm" variant="outline" className="text-xs font-bold h-8" onClick={handleExportCSV}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Revenue", value: `₹${summary.total_revenue}`, color: "text-primary" },
                { label: "Sales", value: summary.total_sales, color: "text-foreground" },
                { label: "Items Sold", value: summary.total_items_sold, color: "text-sky-400" },
              ].map(s => (
                <div key={s.label} className="glass-card rounded-lg p-4 text-center">
                  <div className={`text-2xl font-display font-black ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            {Object.entries(summary.by_payment_method).length > 0 && (
              <div className="glass-card rounded-lg p-4">
                <p className="text-xs font-bold mb-3">By Payment Method</p>
                <div className="space-y-2">
                  {Object.entries(summary.by_payment_method).map(([method, amount]) => (
                    <div key={method} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-muted-foreground">{method}</span>
                      <span className="font-bold text-primary">₹{amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        )
      )}

      {/* ─── History ─── */}
      {activeView === "history" && (
        <div className="space-y-3">
          <h2 className="font-bold text-base">Recent Sales</h2>
          {recentSales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-3 text-muted-foreground" /><p className="text-sm">No sales yet</p>
            </div>
          ) : (
            recentSales.map(sale => (
              <div key={sale.id} className="glass-card rounded-lg p-3" data-testid={`sale-row-${sale.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-primary">₹{sale.total}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">{sale.payment_method}</Badge>
                      {sale.offline_at && <Badge className="text-[9px] bg-amber-500/15 text-amber-400">📴 Offline</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{sale.items?.map(i => `${i.name} ×${i.qty}`).join(", ")}</p>
                    {sale.discount_amount > 0 && (
                      <span className="text-[10px] text-emerald-400">Discount: -₹{sale.discount_amount}</span>
                    )}
                    {(sale.customer_name || sale.customer_phone) && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        <User className="h-2.5 w-2.5 inline mr-0.5" />
                        {[sale.customer_name, sale.customer_phone].filter(Boolean).join(" — ")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(sale.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setLastSale(sale); setShowReceipt(true); }}
                        className="h-6 w-6 rounded-md bg-secondary/60 hover:bg-secondary flex items-center justify-center transition-colors"
                        title="View Receipt">
                        <Printer className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button onClick={() => {
                        const lines = [
                          `*Receipt — ${selectedVenue?.name || "Venue"}*`,
                          `Date: ${new Date(sale.created_at || sale.offline_at).toLocaleString("en-IN")}`,
                          "",
                          ...(sale.items || []).map(i => `${i.name} x${i.qty} — ₹${i.price * i.qty}`),
                          "",
                        ];
                        if (sale.discount_amount > 0) {
                          lines.push(`Subtotal: ₹${sale.subtotal}`);
                          lines.push(`Discount: -₹${sale.discount_amount}`);
                        }
                        lines.push(`*Total: ₹${sale.total}*`);
                        lines.push(`Payment: ${sale.payment_method}`);
                        if (sale.customer_name) lines.push(`Customer: ${sale.customer_name}`);
                        if (sale.customer_phone) lines.push(`Phone: ${sale.customer_phone}`);
                        window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
                      }}
                        className="h-6 w-6 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 flex items-center justify-center transition-colors"
                        title="Share via WhatsApp">
                        <Share2 className="h-3 w-3 text-emerald-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Product Dialog ─── */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-display">{editingProduct ? "Edit" : "New"} Product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Mineral Water" className="mt-1 bg-background border-border" data-testid="product-name-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Category</Label>
                <select value={productForm.category}
                  onChange={e => setProductForm(p => ({ ...p, category: e.target.value, emoji: p.emoji || CAT_EMOJI[e.target.value] }))}
                  className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm" data-testid="product-category-select">
                  {CATEGORIES.filter(c => c.id !== "all").map(c => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Emoji</Label>
                <Input value={productForm.emoji} onChange={e => setProductForm(p => ({ ...p, emoji: e.target.value }))}
                  placeholder="🥤" maxLength={2} className="mt-1 bg-background border-border text-center text-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Price (₹)</Label>
                <Input type="number" value={productForm.price} onChange={e => setProductForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="50" className="mt-1 bg-background border-border" data-testid="product-price-input" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Stock (-1 = ∞)</Label>
                <Input type="number" value={productForm.stock} onChange={e => setProductForm(p => ({ ...p, stock: e.target.value }))}
                  placeholder="-1" className="mt-1 bg-background border-border" data-testid="product-stock-input" />
              </div>
            </div>
            <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleSaveProduct} disabled={savingProduct} data-testid="save-product-btn">
              {savingProduct ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : editingProduct ? "Update Product" : "Add Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Receipt Dialog ─── */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader className="print:hidden">
            <DialogTitle className="font-display flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" /> Sale Complete
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div className="space-y-4">
              {/* Printable receipt */}
              <div id="pos-receipt" ref={receiptRef} className="glass-card rounded-lg p-4 space-y-2">
                <div className="receipt-header text-center">
                  <p className="font-display font-black text-sm">{selectedVenue?.name || "Venue"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(lastSale.created_at || lastSale.offline_at).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="receipt-divider border-t border-dashed border-border my-2" />
                {lastSale.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.name} × {item.qty}</span>
                    <span className="font-bold">₹{item.price * item.qty}</span>
                  </div>
                ))}
                <div className="receipt-divider border-t border-dashed border-border my-2" />
                {lastSale.discount_amount > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Subtotal</span><span>₹{lastSale.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-400">
                      <span>Discount</span><span>-₹{lastSale.discount_amount}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between pt-1">
                  <span className="font-bold">Total</span>
                  <span className="font-display font-black text-xl text-primary">₹{lastSale.total}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Payment</span>
                  <span className="capitalize font-medium">{lastSale.payment_method}</span>
                </div>
                {(lastSale.customer_name || lastSale.customer_phone) && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Customer</span>
                    <span className="font-medium">{[lastSale.customer_name, lastSale.customer_phone].filter(Boolean).join(" — ")}</span>
                  </div>
                )}
                {lastSale.offline && <div className="text-xs text-amber-400 text-center mt-2">📴 Saved offline — will sync automatically</div>}
                <p className="text-[10px] text-muted-foreground/50 text-center mt-2">Thank you!</p>
              </div>
              {/* Action buttons */}
              <div className="flex gap-2 print:hidden">
                <Button className="flex-1 bg-secondary text-foreground font-bold text-xs" onClick={handlePrintReceipt}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
                <Button className="flex-1 bg-emerald-600 text-white font-bold text-xs" onClick={handleShareWhatsApp}>
                  <Share2 className="h-4 w-4 mr-1" /> WhatsApp
                </Button>
              </div>
              <Button className="w-full bg-primary text-primary-foreground font-bold print:hidden" onClick={() => setShowReceipt(false)} data-testid="new-sale-btn">
                New Sale
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
