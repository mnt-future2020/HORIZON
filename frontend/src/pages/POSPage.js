import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { venueAPI, posAPI } from "@/lib/api";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Wifi,
  WifiOff,
  RefreshCw,
  Package,
  IndianRupee,
  CheckCircle,
  X,
  Pencil,
  BarChart3,
  Banknote,
  CreditCard,
  Smartphone,
  History,
  ShieldAlert,
  Printer,
  Share2,
  Download,
  User,
  AlertTriangle,
} from "lucide-react";

// --- Offline queue helpers (IndexedDB with localStorage fallback) -------
import {
  addToOfflineQueue,
  getOfflineQueue,
  clearOfflineQueue,
  getOfflineQueueCount,
  getCachedProducts as idbGetCachedProducts,
  cacheProducts as idbCacheProducts,
  logSyncEvent,
  registerBackgroundSync,
  migrateFromLocalStorage,
} from "@/lib/offline-store";

// Async wrappers for IndexedDB operations
const getQueueAsync = () => getOfflineQueue().catch(() => []);
const addToQueueAsync = (sale) => addToOfflineQueue(sale).catch(() => {});
const clearQueueAsync = () => clearOfflineQueue().catch(() => {});
const getQueueCountAsync = () => getOfflineQueueCount().catch(() => 0);
const getCachedProductsAsync = (venueId) =>
  idbGetCachedProducts(venueId).catch(() => null);
const cacheProductsAsync = (venueId, products) =>
  idbCacheProducts(venueId, products).catch(() => {});

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
  { id: "cash", label: "Cash", icon: Banknote, color: "text-brand-400" },
  { id: "card", label: "Card", icon: CreditCard, color: "text-sky-400" },
  { id: "upi", label: "UPI", icon: Smartphone, color: "text-brand-400" },
];

const CAT_EMOJI = {
  beverages: "🥤",
  snacks: "🍿",
  equipment: "⚽",
  apparel: "👕",
  other: "🛒",
};
const LOW_STOCK_THRESHOLD = 5;

// --- AppSheet & FormField --------------------------------------------------
function AppSheet({ open, onClose, title, children }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        hideClose
        className="
          !fixed !bottom-0 !top-auto !translate-y-0 !translate-x-0 !left-0 !right-0
          w-full max-w-full rounded-t-[24px] rounded-b-none bg-card p-0 shadow-2xl border-border/40
          max-h-[92vh] overflow-y-auto
          sm:!top-[50%] sm:!bottom-auto sm:!left-[50%] sm:!right-auto sm:!translate-x-[-50%] sm:!translate-y-[-50%]
          sm:!w-full sm:!max-w-[480px] sm:!rounded-[24px]
        "
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <DialogTitle className="text-base font-bold text-foreground">
            {title}
          </DialogTitle>
          <button
            onClick={() => onClose(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-secondary/50 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">{children}</div>
        <div style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
      </DialogContent>
    </Dialog>
  );
}

function FormField({ label, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

// --- Product Card -------------------------------------------------------
function ProductCard({ product, cartQty, onAdd, onRemove }) {
  const outOfStock = product.stock === 0;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-[20px] bg-card border border-border/40 shadow-sm p-3 flex flex-col gap-2 transition-all select-none
        ${outOfStock ? "opacity-50" : "hover:border-brand-600/40 cursor-pointer"}
        ${cartQty > 0 ? "border-brand-600/50 bg-brand-600/5" : ""}`}
      onClick={() => !outOfStock && onAdd(product)}
      data-testid={`product-card-${product.id}`}
    >
      <div className="text-3xl text-center">
        {product.emoji || CAT_EMOJI[product.category] || "🛒"}
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">
          {product.name}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
          {product.category}
        </p>
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-semibold text-brand-600">
          ₹{product.price}
        </span>
        {outOfStock ? (
          <span className="admin-badge text-[10px] text-destructive">Out</span>
        ) : (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {cartQty > 0 && (
              <button
                onClick={() => onRemove(product)}
                className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            )}
            {cartQty > 0 && (
              <span className="text-xs font-semibold w-5 text-center">
                {cartQty}
              </span>
            )}
            <button
              onClick={() => onAdd(product)}
              className="h-8 w-8 rounded-full bg-brand-600/20 flex items-center justify-center hover:bg-brand-600/40 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {product.stock > 0 && (
        <div
          className={`text-[10px] ${product.stock <= LOW_STOCK_THRESHOLD ? "text-amber-400 font-medium" : "text-muted-foreground/60"}`}
        >
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
        <div className="bg-card rounded-[24px] border border-border/40 shadow-sm p-4 sm:p-20 text-center flex flex-col items-center justify-center min-h-[300px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="p-6 rounded-[24px] bg-destructive/10 mb-4 inline-block">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="admin-heading mb-2">Access Denied</h1>
            <p className="text-sm text-muted-foreground">
              POS is only available to venue owners.
            </p>
          </motion.div>
        </div>
      </div>
    );
  }
  return <POSTerminal user={user} />;
}

function POSTerminal({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const pendingVenueIdRef = useRef(searchParams.get("venue") || null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState(
    searchParams.get("cat") || "all",
  );
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [charging, setCharging] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [activeView, setActiveView] = useState(
    searchParams.get("view") || "pos",
  );
  const [summary, setSummary] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "beverages",
    price: "",
    stock: "-1",
    emoji: "",
  });
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
    const onOnline = () => {
      setIsOnline(true);
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Init: migrate localStorage to IndexedDB, then load count
    migrateFromLocalStorage()
      .then(() => getQueueCountAsync())
      .then(setPendingCount);
    // Register POS Service Worker ONLY in production (dev uses hot reload, SW would cache stale bundles)
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/pos-sw.js", { scope: "/pos" })
        .then((reg) => {
          registerBackgroundSync();
          // Auto-update: check for new SW every 5 minutes
          setInterval(() => reg.update(), 5 * 60 * 1000);
        })
        .catch(() => {});
    } else if (
      process.env.NODE_ENV !== "production" &&
      "serviceWorker" in navigator
    ) {
      // Dev mode: unregister any existing SW to prevent caching issues
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()));
    }
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Sync queue when back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && selectedVenue) syncQueue();
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load venues (with offline cache fallback)
  useEffect(() => {
    venueAPI
      .getOwnerVenues()
      .then((r) => {
        const v = r.data || [];
        setVenues(v);
        if (v.length > 0) {
          const pendingId = pendingVenueIdRef.current;
          pendingVenueIdRef.current = null;
          const restored = pendingId
            ? v.find((x) => String(x.id) === String(pendingId))
            : null;
          setSelectedVenue(restored || v[0]);
        }
        try {
          localStorage.setItem("pos_venues", JSON.stringify(v));
        } catch {}
      })
      .catch((err) => {
        // Offline — load cached venues
        if (!err.response) {
          try {
            const cached = JSON.parse(localStorage.getItem("pos_venues"));
            if (cached?.length) {
              setVenues(cached);
              const pendingId = pendingVenueIdRef.current;
              pendingVenueIdRef.current = null;
              const restored = pendingId
                ? cached.find((x) => String(x.id) === String(pendingId))
                : null;
              setSelectedVenue(restored || cached[0]);
              return;
            }
          } catch {}
        }
        toast.error("Failed to load venues");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load products when venue changes (IndexedDB cache)
  useEffect(() => {
    if (!selectedVenue) return;
    getCachedProductsAsync(selectedVenue.id).then((cached) => {
      if (cached) setProducts(cached);
    });
    posAPI
      .listProducts(selectedVenue.id)
      .then((r) => {
        setProducts(r.data || []);
        cacheProductsAsync(selectedVenue.id, r.data || []);
      })
      .catch(() => {});
  }, [selectedVenue]);

  // Cart ops
  const addToCart = (product) =>
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === product.id);
      if (ex)
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c,
        );
      return [...prev, { product, qty: 1 }];
    });

  const removeFromCart = (product) =>
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === product.id);
      if (!ex) return prev;
      if (ex.qty <= 1) return prev.filter((c) => c.product.id !== product.id);
      return prev.map((c) =>
        c.product.id === product.id ? { ...c, qty: c.qty - 1 } : c,
      );
    });

  const clearCart = () => {
    setCart([]);
    setDiscountValue("");
    setCustomerName("");
    setCustomerPhone("");
  };
  const cartTotal = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  const cartQty = (id) => cart.find((c) => c.product.id === id)?.qty || 0;

  // Discount computed values
  const discountNumeric = parseFloat(discountValue) || 0;
  const discountAmount =
    discountType === "percent"
      ? Math.round(((cartTotal * Math.min(discountNumeric, 100)) / 100) * 100) /
        100
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
      await logSyncEvent({
        type: "sync_success",
        count: queue.length,
        venue_id: selectedVenue.id,
      });
      toast.success(
        `${queue.length} offline sale${queue.length > 1 ? "s" : ""} synced!`,
      );
      loadSummary();
    } catch {
      await logSyncEvent({
        type: "sync_failed",
        count: queue.length,
        venue_id: selectedVenue.id,
      });
      toast.error("Sync failed — will retry when reconnected");
    } finally {
      setSyncing(false);
    }
  }, [selectedVenue]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSummary = useCallback(() => {
    if (!selectedVenue) return;
    posAPI
      .summary(selectedVenue.id)
      .then((r) => setSummary(r.data))
      .catch(() => {});
  }, [selectedVenue]);

  const loadRecentSales = useCallback(() => {
    if (!selectedVenue) return;
    posAPI
      .listSales(selectedVenue.id, 30)
      .then((r) => setRecentSales(r.data || []))
      .catch(() => {});
  }, [selectedVenue]);

  // Receipt handlers
  const handlePrintReceipt = () => {
    if (!lastSale) return;
    const items = (lastSale.items || [])
      .map(
        (i) =>
          `<tr><td>${i.name} x${i.qty}</td><td style="text-align:right;font-weight:bold">₹${i.price * i.qty}</td></tr>`,
      )
      .join("");
    const discount =
      lastSale.discount_amount > 0
        ? `
      <tr><td>Subtotal</td><td style="text-align:right">₹${lastSale.subtotal}</td></tr>
      <tr><td>Discount</td><td style="text-align:right">-₹${lastSale.discount_amount}</td></tr>`
        : "";
    const customer =
      lastSale.customer_name || lastSale.customer_phone
        ? `<tr><td>Customer</td><td style="text-align:right">${[lastSale.customer_name, lastSale.customer_phone].filter(Boolean).join(" — ")}</td></tr>`
        : "";
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
      ...(lastSale.items || []).map(
        (i) => `${i.name} x${i.qty} — ₹${i.price * i.qty}`,
      ),
      "",
    ];
    if (lastSale.discount_amount > 0) {
      lines.push(`Subtotal: ₹${lastSale.subtotal}`);
      lines.push(`Discount: -₹${lastSale.discount_amount}`);
    }
    lines.push(`*Total: ₹${lastSale.total}*`);
    lines.push(`Payment: ${lastSale.payment_method}`);
    if (lastSale.customer_name)
      lines.push(`Customer: ${lastSale.customer_name}`);
    if (lastSale.customer_phone)
      lines.push(`Phone: ${lastSale.customer_phone}`);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank",
    );
  };

  // CSV export
  const handleExportCSV = async () => {
    if (!selectedVenue) return;
    const today = new Date().toISOString().split("T")[0];
    try {
      const res = await posAPI.report(selectedVenue.id, today);
      const sales = res.data.sales || [];
      if (!sales.length) {
        toast("No sales to export");
        return;
      }
      const headers = [
        "Time",
        "Items",
        "Qty",
        "Payment",
        "Subtotal",
        "Discount",
        "Total",
        "Customer Name",
        "Customer Phone",
      ];
      const rows = sales.map((s) => [
        new Date(s.created_at).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        (s.items || []).map((i) => i.name).join("; "),
        (s.items || []).reduce((sum, i) => sum + (i.qty || 1), 0),
        s.payment_method || "cash",
        s.subtotal || s.total || 0,
        s.discount_amount || 0,
        s.total || 0,
        s.customer_name || "",
        s.customer_phone || "",
      ]);
      const csv = [headers, ...rows]
        .map((r) =>
          r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
        )
        .join("\n");
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
  const lowStockProducts = products.filter(
    (p) =>
      p.stock >= 0 && p.stock <= LOW_STOCK_THRESHOLD && p.is_active !== false,
  );

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);
  useEffect(() => {
    if (activeView === "history") loadRecentSales();
    if (activeView === "summary") loadSummary();
  }, [activeView, loadRecentSales, loadSummary]);

  // Sync view + category + venue → URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeView !== "pos") params.set("view", activeView);
    if (activeCategory !== "all") params.set("cat", activeCategory);
    if (selectedVenue) params.set("venue", String(selectedVenue.id));
    setSearchParams(params, { replace: true });
  }, [activeView, activeCategory, selectedVenue, setSearchParams]);

  // Charge
  const handleCharge = async () => {
    if (!cart.length || !selectedVenue) return;
    setCharging(true);
    const saleData = {
      venue_id: selectedVenue.id,
      items: cart.map((c) => ({
        product_id: c.product.id,
        name: c.product.name,
        price: c.product.price,
        qty: c.qty,
      })),
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
        result = {
          ...saleData,
          created_at: saleData.offline_at,
          offline: true,
        };
        toast("Sale saved offline — will sync when connected", { icon: "📴" });
      }
      setLastSale(result);
      setShowReceipt(true);
      // Low stock check before clearing cart
      const lowAfterSale = cart.filter((c) => {
        const p = products.find((pr) => pr.id === c.product.id);
        if (!p || p.stock < 0) return false;
        const remaining = p.stock - c.qty;
        return remaining >= 0 && remaining <= LOW_STOCK_THRESHOLD;
      });
      if (lowAfterSale.length > 0) {
        toast.warning(
          `Low stock: ${lowAfterSale.map((c) => c.product.name).join(", ")}`,
        );
      }
      clearCart();
      setProducts((prev) =>
        prev.map((p) => {
          const item = cart.find((c) => c.product.id === p.id);
          if (!item || p.stock < 0) return p;
          return { ...p, stock: Math.max(0, p.stock - item.qty) };
        }),
      );
    } catch (err) {
      // Network error (no response) → fallback to offline IndexedDB
      if (!err.response) {
        try {
          saleData.offline_at = saleData.offline_at || new Date().toISOString();
          await addToQueueAsync(saleData);
          const count = await getQueueCountAsync();
          setPendingCount(count);
          setIsOnline(false);
          const offlineResult = {
            ...saleData,
            created_at: saleData.offline_at,
            offline: true,
          };
          setLastSale(offlineResult);
          setShowReceipt(true);
          const lowAfterSale = cart.filter((c) => {
            const p = products.find((pr) => pr.id === c.product.id);
            if (!p || p.stock < 0) return false;
            return (
              p.stock - c.qty >= 0 && p.stock - c.qty <= LOW_STOCK_THRESHOLD
            );
          });
          if (lowAfterSale.length > 0)
            toast.warning(
              `Low stock: ${lowAfterSale.map((c) => c.product.name).join(", ")}`,
            );
          clearCart();
          setProducts((prev) =>
            prev.map((p) => {
              const item = cart.find((c) => c.product.id === p.id);
              if (!item || p.stock < 0) return p;
              return { ...p, stock: Math.max(0, p.stock - item.qty) };
            }),
          );
          toast("Network unreachable — sale saved offline", { icon: "📴" });
          return;
        } catch (offlineErr) {
          toast.error("Failed to save sale offline");
          return;
        }
      }
      toast.error(err?.response?.data?.detail || "Charge failed");
    } finally {
      setCharging(false);
    }
  };

  // Product CRUD
  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: "",
      category: "beverages",
      price: "",
      stock: "-1",
      emoji: "",
    });
    setProductDialogOpen(true);
  };
  const openEditProduct = (p) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      category: p.category,
      price: String(p.price),
      stock: String(p.stock),
      emoji: p.emoji || "",
    });
    setProductDialogOpen(true);
  };
  const [savingProduct, setSavingProduct] = useState(false);
  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!productForm.price || parseFloat(productForm.price) < 0) {
      toast.error("Valid price is required");
      return;
    }
    if (!selectedVenue) {
      toast.error("No venue selected. Please add a venue first.");
      return;
    }
    setSavingProduct(true);
    const payload = {
      venue_id: selectedVenue.id,
      name: productForm.name.trim(),
      category: productForm.category,
      price: parseFloat(productForm.price),
      stock: parseInt(productForm.stock, 10),
      emoji: productForm.emoji || CAT_EMOJI[productForm.category],
    };
    try {
      if (editingProduct) {
        const res = await posAPI.updateProduct(editingProduct.id, payload);
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? res.data : p)),
        );
        toast.success("Product updated");
      } else {
        const res = await posAPI.createProduct(payload);
        setProducts((prev) => [...prev, res.data]);
        toast.success("Product added");
      }
      setProductDialogOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save product");
    } finally {
      setSavingProduct(false);
    }
  };
  const handleDeleteProduct = async (id) => {
    try {
      await posAPI.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Product removed");
    } catch {
      toast.error("Failed to delete");
    }
  };
  const handleToggleProduct = async (p) => {
    try {
      const res = await posAPI.updateProduct(p.id, { is_active: !p.is_active });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? res.data : x)));
    } catch {
      toast.error("Failed");
    }
  };

  const filteredProducts =
    activeCategory === "all"
      ? products.filter((p) => p.is_active !== false)
      : products.filter(
          (p) => p.is_active !== false && p.category === activeCategory,
        );

  const VIEWS = [
    { id: "pos", icon: ShoppingCart, label: "POS" },
    { id: "products", icon: Package, label: "Products" },
    { id: "summary", icon: BarChart3, label: "Today" },
    { id: "history", icon: History, label: "History" },
  ];

  return (
    <div
      className="min-h-screen bg-transparent pb-20 md:pb-8"
      data-testid="pos-page"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6 items-start">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="admin-page-title mb-1">Point of Sale</h1>
              <p className="text-sm text-muted-foreground">
                Manage sales, products & transactions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full admin-badge ${isOnline ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}
              >
                {isOnline ? (
                  <Wifi className="h-3 w-3" />
                ) : (
                  <WifiOff className="h-3 w-3" />
                )}
                {isOnline ? "Online" : "Offline"}
              </div>
              {pendingCount > 0 && (
                <button
                  onClick={syncQueue}
                  disabled={!isOnline || syncing}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full admin-btn bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                  data-testid="sync-btn"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`}
                  />
                  Sync {pendingCount}
                </button>
              )}
            </div>
          </div>

          {/* Venue selector */}
          {venues.length > 1 && (
            <div className="-mx-4 sm:mx-0 px-4 sm:px-0 mb-6 font-semibold">
              <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                {venues.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVenue(v)}
                    className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] tracking-wide whitespace-nowrap transition-all shadow-sm active:scale-95 ${
                      selectedVenue?.id === v.id
                        ? "bg-foreground text-background font-bold"
                        : "bg-card border border-border/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* View tabs — scrollable pills */}
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 mb-6 font-semibold">
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {VIEWS.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveView(id)}
                  className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] tracking-wide whitespace-nowrap transition-all shadow-sm active:scale-95 ${
                    activeView === id
                      ? "bg-foreground text-background font-bold"
                      : "bg-card border border-border/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                  data-testid={`pos-tab-${id}`}
                >
                  <Icon
                    className={`w-4 h-4 ${activeView === id ? "text-background opacity-80" : "text-muted-foreground/70"}`}
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── POS Terminal View ─── */}
          {activeView === "pos" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Products */}
              <div className="lg:col-span-2 space-y-4">
                {/* Category filter pills */}
                <div className="-mx-4 sm:mx-0 px-4 sm:px-0 mb-4">
                  <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold tracking-wide transition-all shadow-sm active:scale-95 whitespace-nowrap ${
                          activeCategory === cat.id
                            ? "bg-brand-600/10 text-brand-600 border border-brand-600/30"
                            : "bg-card border border-border/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                        }`}
                        data-testid={`cat-${cat.id}`}
                      >
                        <span className="text-base">{cat.emoji}</span>{" "}
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="bg-card border border-border/40 rounded-[24px] p-20 text-center flex flex-col items-center justify-center min-h-[300px]">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <div className="p-6 rounded-3xl bg-secondary/30 mb-4">
                        <Package className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                      <p className="text-muted-foreground text-sm font-medium mb-3">
                        No products yet
                      </p>
                      <button
                        className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-9 px-4 shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
                        onClick={() => setActiveView("products")}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1 inline" /> Add
                        Products
                      </button>
                    </motion.div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    <AnimatePresence>
                      {filteredProducts.map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          cartQty={cartQty(p.id)}
                          onAdd={addToCart}
                          onRemove={removeFromCart}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Cart */}
              <div className="lg:col-span-1">
                <div
                  className="rounded-[24px] bg-card border border-border/40 shadow-sm p-4 sm:p-6 sticky top-20"
                  data-testid="pos-cart"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-2xl bg-brand-600/10 border border-border/40">
                        <ShoppingCart className="h-4 w-4 text-brand-600" />
                      </div>
                      <h2 className="admin-heading text-base">Cart</h2>
                      {cart.length > 0 && (
                        <span className="admin-badge px-2.5 py-0.5 rounded-full border-none bg-brand-600/10 text-brand-600">
                          {cart.reduce((s, c) => s + c.qty, 0)}
                        </span>
                      )}
                    </div>
                    {cart.length > 0 && (
                      <button
                        onClick={clearCart}
                        className="admin-btn text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {cart.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <div className="p-4 rounded-3xl bg-secondary/30 inline-block mb-3">
                        <ShoppingCart className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Tap products to add
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-4">
                        <AnimatePresence>
                          {cart.map(({ product, qty }) => (
                            <motion.div
                              key={product.id}
                              layout
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-xl transition-colors"
                              data-testid={`cart-item-${product.id}`}
                            >
                              <span className="text-lg">
                                {product.emoji || "🛒"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {product.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  ₹{product.price} × {qty}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => removeFromCart(product)}
                                  className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="text-xs font-semibold w-5 text-center">
                                  {qty}
                                </span>
                                <button
                                  onClick={() => addToCart(product)}
                                  className="h-7 w-7 rounded-full bg-brand-600/10 flex items-center justify-center hover:bg-brand-600/20 transition-colors"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              <span className="text-xs font-semibold text-brand-600 w-14 text-right">
                                ₹{product.price * qty}
                              </span>
                              <button
                                onClick={() =>
                                  setCart((prev) =>
                                    prev.filter(
                                      (c) => c.product.id !== product.id,
                                    ),
                                  )
                                }
                                className="text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>

                      <div className="border-t border-border/40 pt-4 mb-4 space-y-3">
                        {/* Discount */}
                        <div className="flex items-center gap-2">
                          <p className="admin-section-label">Discount</p>
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              onClick={() => setDiscountType("percent")}
                              className={`px-2.5 py-0.5 rounded-full admin-btn transition-all ${discountType === "percent" ? "bg-brand-600/10 text-brand-600" : "bg-secondary/30 text-muted-foreground"}`}
                            >
                              %
                            </button>
                            <button
                              onClick={() => setDiscountType("flat")}
                              className={`px-2.5 py-0.5 rounded-full admin-btn transition-all ${discountType === "flat" ? "bg-brand-600/10 text-brand-600" : "bg-secondary/30 text-muted-foreground"}`}
                            >
                              ₹
                            </button>
                          </div>
                        </div>
                        <Input
                          type="number"
                          placeholder={
                            discountType === "percent" ? "e.g. 10" : "e.g. 50"
                          }
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          className="h-9 text-xs rounded-xl bg-secondary/20 border-border/40"
                        />
                        {discountAmount > 0 && (
                          <div className="bg-secondary/30 rounded-2xl p-3 space-y-1.5 text-sm">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                Subtotal
                              </span>
                              <span className="font-medium">₹{cartTotal}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-brand-600">
                                Discount (
                                {discountType === "percent"
                                  ? `${discountNumeric}%`
                                  : `₹${discountNumeric}`}
                                )
                              </span>
                              <span className="text-brand-600 font-medium">
                                -₹{discountAmount}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="admin-heading text-sm">Total</span>
                          <span className="admin-value text-xl">
                            ₹{finalTotal}
                          </span>
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="admin-section-label mb-2">Payment</p>
                        <div className="grid grid-cols-3 gap-2">
                          {PAYMENT_METHODS.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setPaymentMethod(m.id)}
                              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl admin-btn transition-all ${
                                paymentMethod === m.id
                                  ? "border border-brand-600 bg-brand-600/10 text-brand-600"
                                  : "border border-border/40 text-muted-foreground hover:border-brand-600/50 hover:text-foreground"
                              }`}
                              data-testid={`pay-${m.id}`}
                            >
                              <m.icon
                                className={`h-4 w-4 ${paymentMethod === m.id ? "text-brand-600" : m.color}`}
                              />
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mb-4 space-y-2">
                        <p className="admin-section-label">
                          Customer (optional)
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Name"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="h-9 text-xs rounded-xl bg-secondary/20 border-border/40"
                          />
                          <Input
                            placeholder="Phone"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="h-9 text-xs rounded-xl bg-secondary/20 border-border/40"
                            type="tel"
                          />
                        </div>
                      </div>

                      <button
                        className="w-full h-12 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all text-base flex items-center justify-center gap-1"
                        onClick={handleCharge}
                        disabled={charging}
                        data-testid="charge-btn"
                      >
                        {charging ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <IndianRupee className="h-5 w-5" />
                            Charge ₹{finalTotal}
                          </>
                        )}
                      </button>
                      {!isOnline && (
                        <p className="text-[10px] text-amber-500 text-center mt-2">
                          Offline — sale will sync when connected
                        </p>
                      )}
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
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    No venue selected
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You need at least one venue to manage POS products. Add a
                    venue from your dashboard first.
                  </p>
                </div>
              )}
              {lowStockProducts.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Low Stock Alert
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lowStockProducts
                      .map((p) => `${p.name} (${p.stock} left)`)
                      .join(", ")}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <h2 className="admin-heading">Products Catalog</h2>
                <button
                  className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-9 px-4 shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"
                  onClick={openCreateProduct}
                  disabled={!selectedVenue}
                  data-testid="add-product-btn"
                >
                  <Plus className="h-3.5 w-3.5 mr-1 inline" /> Add Product
                </button>
              </div>
              {products.length === 0 ? (
                <div className="bg-card border border-border/40 rounded-[24px] p-20 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="p-6 rounded-3xl bg-secondary/30 mb-4">
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">
                      No products yet. Add your first item!
                    </p>
                  </motion.div>
                </div>
              ) : (
                <div className="bg-card border border-border/40 rounded-[24px] overflow-hidden shadow-sm">
                  <div className="divide-y divide-border/20">
                    {products.map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-center gap-4 p-4 hover:bg-white/5 transition-colors ${p.is_active === false ? "opacity-50" : ""} ${p.stock >= 0 && p.stock <= LOW_STOCK_THRESHOLD && p.is_active !== false ? "bg-amber-500/5" : ""}`}
                        data-testid={`manage-product-${p.id}`}
                      >
                        <span className="text-2xl">
                          {p.emoji || CAT_EMOJI[p.category] || "🛒"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="admin-name truncate">{p.name}</p>
                            <span className="admin-badge px-2.5 py-0.5 rounded-full border-none bg-secondary/50 text-muted-foreground capitalize">
                              {p.category}
                            </span>
                            {p.stock >= 0 &&
                              p.stock <= LOW_STOCK_THRESHOLD &&
                              p.is_active !== false && (
                                <span className="admin-badge px-2.5 py-0.5 rounded-full border-none bg-amber-500/10 text-amber-600">
                                  Low Stock
                                </span>
                              )}
                          </div>
                          <p className="admin-label text-xs mt-0.5">
                            ₹{p.price} ·{" "}
                            {p.stock < 0 ? "Unlimited" : `${p.stock} left`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleToggleProduct(p)}
                            className={`w-9 h-5 rounded-full transition-all relative ${p.is_active !== false ? "bg-brand-600" : "bg-secondary"}`}
                          >
                            <div
                              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${p.is_active !== false ? "left-4" : "left-0.5"}`}
                            />
                          </button>
                          <button
                            onClick={() => openEditProduct(p)}
                            className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id)}
                            className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Today Summary ─── */}
          {activeView === "summary" &&
            (summary ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="admin-heading">Today's Summary</h2>
                    <p className="admin-label mt-0.5">{summary.today}</p>
                  </div>
                  <button
                    className="admin-btn rounded-xl h-11 border border-border/40 bg-card text-foreground hover:bg-secondary px-5 flex items-center gap-1.5 transition-all"
                    onClick={handleExportCSV}
                  >
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    {
                      label: "Revenue",
                      value: `₹${summary.total_revenue}`,
                      icon: IndianRupee,
                      colorClass: "text-brand-600",
                      bgClass: "bg-brand-600/10",
                    },
                    {
                      label: "Sales",
                      value: summary.total_sales,
                      icon: ShoppingCart,
                      colorClass: "text-green-600",
                      bgClass: "bg-green-500/10",
                    },
                    {
                      label: "Items Sold",
                      value: summary.total_items_sold,
                      icon: Package,
                      colorClass: "text-purple-600",
                      bgClass: "bg-purple-500/10",
                    },
                  ].map((s, idx) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: idx * 0.08,
                        duration: 0.4,
                        ease: "easeOut",
                      }}
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      className="bg-card rounded-[24px] p-7 border border-border/40 shadow-sm overflow-hidden relative group h-full flex flex-col justify-between transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="admin-label">{s.label}</div>
                        <div
                          className={`p-3 rounded-2xl ${s.bgClass} flex items-center justify-center border border-border/40`}
                        >
                          <s.icon className={`h-5 w-5 ${s.colorClass}`} />
                        </div>
                      </div>
                      <div className="admin-value">{s.value}</div>
                    </motion.div>
                  ))}
                </div>
                {Object.entries(summary.by_payment_method).length > 0 && (
                  <div className="bg-card rounded-[24px] p-7 border border-border/40 shadow-sm">
                    <h3 className="admin-heading mb-4">By Payment Method</h3>
                    <div className="bg-secondary/30 rounded-2xl p-4 space-y-3">
                      {Object.entries(summary.by_payment_method).map(
                        ([method, amount]) => (
                          <div
                            key={method}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground capitalize">
                              {method}
                            </span>
                            <span className="font-medium text-brand-600">
                              ₹{amount}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex items-center justify-center min-h-[200px]">
                <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ))}

          {/* ─── History ─── */}
          {activeView === "history" && (
            <div className="space-y-4">
              <h2 className="admin-heading">Recent Sales</h2>
              {recentSales.length === 0 ? (
                <div className="bg-card border border-border/40 rounded-[24px] p-20 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="p-6 rounded-3xl bg-secondary/30 mb-4">
                      <History className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">
                      No sales yet
                    </p>
                  </motion.div>
                </div>
              ) : (
                <div className="bg-card border border-border/40 rounded-[24px] overflow-hidden shadow-sm">
                  <div className="divide-y divide-border/20">
                    {recentSales.map((sale, i) => (
                      <motion.div
                        key={sale.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="p-4 hover:bg-white/5 transition-colors"
                        data-testid={`sale-row-${sale.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-brand-600">
                                ₹{sale.total}
                              </span>
                              <span className="admin-badge px-2.5 py-0.5 rounded-full border-none bg-secondary/50 text-muted-foreground capitalize">
                                {sale.payment_method}
                              </span>
                              {sale.offline_at && (
                                <span className="admin-badge px-2.5 py-0.5 rounded-full border-none bg-amber-500/10 text-amber-600">
                                  Offline
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {sale.items
                                ?.map((i) => `${i.name} ×${i.qty}`)
                                .join(", ")}
                            </p>
                            {sale.discount_amount > 0 && (
                              <span className="text-[10px] text-brand-600">
                                Discount: -₹{sale.discount_amount}
                              </span>
                            )}
                            {(sale.customer_name || sale.customer_phone) && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                <User className="h-2.5 w-2.5 inline mr-0.5" />
                                {[sale.customer_name, sale.customer_phone]
                                  .filter(Boolean)
                                  .join(" — ")}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="admin-label text-[10px]">
                              {new Date(sale.created_at).toLocaleTimeString(
                                "en-IN",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setLastSale(sale);
                                  setShowReceipt(true);
                                }}
                                className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all"
                                title="View Receipt"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  const lines = [
                                    `*Receipt — ${selectedVenue?.name || "Venue"}*`,
                                    `Date: ${new Date(sale.created_at || sale.offline_at).toLocaleString("en-IN")}`,
                                    "",
                                    ...(sale.items || []).map(
                                      (i) =>
                                        `${i.name} x${i.qty} — ₹${i.price * i.qty}`,
                                    ),
                                    "",
                                  ];
                                  if (sale.discount_amount > 0) {
                                    lines.push(`Subtotal: ₹${sale.subtotal}`);
                                    lines.push(
                                      `Discount: -₹${sale.discount_amount}`,
                                    );
                                  }
                                  lines.push(`*Total: ₹${sale.total}*`);
                                  lines.push(`Payment: ${sale.payment_method}`);
                                  if (sale.customer_name)
                                    lines.push(
                                      `Customer: ${sale.customer_name}`,
                                    );
                                  if (sale.customer_phone)
                                    lines.push(`Phone: ${sale.customer_phone}`);
                                  window.open(
                                    `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`,
                                    "_blank",
                                  );
                                }}
                                className="h-8 w-8 rounded-xl flex items-center justify-center text-brand-600 hover:bg-brand-600/10 transition-all"
                                title="Share via WhatsApp"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Product Dialog ─── */}
          <AppSheet
            open={productDialogOpen}
            onClose={setProductDialogOpen}
            title={editingProduct ? "Edit Product" : "New Product"}
          >
            <FormField label="Name">
              <Input
                value={productForm.name}
                onChange={(e) =>
                  setProductForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. Mineral Water"
                className="h-11 rounded-xl bg-secondary/20 border-border/40 text-sm"
                data-testid="product-name-input"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Category">
                <select
                  value={productForm.category}
                  onChange={(e) =>
                    setProductForm((p) => ({
                      ...p,
                      category: e.target.value,
                      emoji: p.emoji || CAT_EMOJI[e.target.value],
                    }))
                  }
                  className="w-full h-11 rounded-xl bg-secondary/20 border border-border/40 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-600"
                  data-testid="product-category-select"
                >
                  {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                      className="text-foreground bg-card"
                    >
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Emoji">
                <Input
                  value={productForm.emoji}
                  onChange={(e) =>
                    setProductForm((p) => ({ ...p, emoji: e.target.value }))
                  }
                  placeholder="🥤"
                  maxLength={2}
                  className="h-11 rounded-xl bg-secondary/20 border-border/40 text-center text-xl"
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Price (₹)">
                <Input
                  type="number"
                  value={productForm.price}
                  onChange={(e) =>
                    setProductForm((p) => ({ ...p, price: e.target.value }))
                  }
                  placeholder="50"
                  className="h-11 rounded-xl bg-secondary/20 border-border/40 text-sm"
                  data-testid="product-price-input"
                />
              </FormField>
              <FormField label="Stock (-1 = ∞)">
                <Input
                  type="number"
                  value={productForm.stock}
                  onChange={(e) =>
                    setProductForm((p) => ({ ...p, stock: e.target.value }))
                  }
                  placeholder="-1"
                  className="h-11 rounded-xl bg-secondary/20 border-border/40 text-sm"
                  data-testid="product-stock-input"
                />
              </FormField>
            </div>
            <div className="pt-2 flex gap-3">
              <button
                className="flex-1 py-3.5 rounded-xl border border-border/40 bg-card text-foreground font-bold hover:bg-secondary/50 transition-all text-sm"
                onClick={() => setProductDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl py-3.5 shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all text-sm flex items-center justify-center"
                onClick={handleSaveProduct}
                disabled={savingProduct}
                data-testid="save-product-btn"
              >
                {savingProduct ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : editingProduct ? (
                  "Update Product"
                ) : (
                  "Add Product"
                )}
              </button>
            </div>
          </AppSheet>

          {/* ─── Receipt Dialog ─── */}
          <AppSheet
            open={showReceipt}
            onClose={setShowReceipt}
            title="Sale Complete"
          >
            {lastSale && (
              <div className="space-y-4">
                {/* Printable receipt */}
                <div
                  id="pos-receipt"
                  ref={receiptRef}
                  className="bg-secondary/30 rounded-2xl p-4 space-y-2"
                >
                  <div className="receipt-header text-center">
                    <p className="font-bold text-sm text-foreground">
                      {selectedVenue?.name || "Venue"}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1">
                      {new Date(
                        lastSale.created_at || lastSale.offline_at,
                      ).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="receipt-divider border-t border-dashed border-border/60 my-3" />
                  {lastSale.items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="font-medium text-muted-foreground">
                        {item.name}{" "}
                        <span className="text-foreground">× {item.qty}</span>
                      </span>
                      <span className="font-bold text-foreground">
                        ₹{item.price * item.qty}
                      </span>
                    </div>
                  ))}
                  <div className="receipt-divider border-t border-dashed border-border/60 my-3" />
                  {lastSale.discount_amount > 0 && (
                    <>
                      <div className="flex justify-between text-xs font-bold text-muted-foreground">
                        <span>Subtotal</span>
                        <span>₹{lastSale.subtotal}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-brand-600">
                        <span>Discount</span>
                        <span>-₹{lastSale.discount_amount}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between pt-2">
                    <span className="font-black text-base text-foreground uppercase tracking-widest">
                      Total
                    </span>
                    <span className="font-black text-xl tabular-nums text-foreground">
                      ₹{lastSale.total}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border/40 mt-2 text-[11px] uppercase font-bold text-muted-foreground tracking-wide">
                    <span>Payment</span>
                    <span className="text-foreground">
                      {lastSale.payment_method}
                    </span>
                  </div>
                  {(lastSale.customer_name || lastSale.customer_phone) && (
                    <div className="flex justify-between text-[11px] uppercase font-bold text-muted-foreground tracking-wide">
                      <span>Customer</span>
                      <span className="text-foreground">
                        {[lastSale.customer_name, lastSale.customer_phone]
                          .filter(Boolean)
                          .join(" — ")}
                      </span>
                    </div>
                  )}
                  {lastSale.offline && (
                    <div className="text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded text-center mt-3">
                      Saved offline — will sync automatically
                    </div>
                  )}
                  <p className="text-[10px] uppercase font-bold text-muted-foreground/50 text-center mt-4 tracking-widest">
                    Thank you!
                  </p>
                </div>
                {/* Action buttons */}
                <div className="flex gap-3 print:hidden">
                  <button
                    className="flex-1 py-3 bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs shadow-sm"
                    onClick={handlePrintReceipt}
                  >
                    <Printer className="w-4 h-4" /> Print
                  </button>
                  <button
                    className="flex-1 py-3 bg-green-500/10 hover:bg-green-500/20 text-green-600 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs shadow-sm"
                    onClick={handleShareWhatsApp}
                  >
                    <Share2 className="w-4 h-4" /> WhatsApp
                  </button>
                </div>
                <button
                  className="w-full mt-2 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all text-sm print:hidden"
                  onClick={() => setShowReceipt(false)}
                  data-testid="new-sale-btn"
                >
                  New Sale
                </button>
              </div>
            )}
          </AppSheet>
        </motion.div>
      </div>
    </div>
  );
}
