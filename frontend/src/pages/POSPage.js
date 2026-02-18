import { useState, useEffect, useCallback } from "react";
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
  Banknote, CreditCard, Smartphone, History, ShieldAlert
} from "lucide-react";

// --- Offline queue helpers (localStorage) -----------------------------------------------
const QUEUE_KEY = "horizon_pos_offline_queue";
const PRODUCTS_CACHE_KEY = "horizon_pos_products_cache";

const getQueue = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; } };
const setQueue = (q) => localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
const addToQueue = (sale) => setQueue([...getQueue(), sale]);
const clearQueue = () => localStorage.removeItem(QUEUE_KEY);

const getCachedProducts = (venueId) => {
  try {
    const raw = localStorage.getItem(`${PRODUCTS_CACHE_KEY}_${venueId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const cacheProducts = (venueId, products) =>
  localStorage.setItem(`${PRODUCTS_CACHE_KEY}_${venueId}`, JSON.stringify(products));

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
        <div className="text-[9px] text-muted-foreground/60">{product.stock} left</div>
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
  const [pendingCount, setPendingCount] = useState(getQueue().length);
  const [syncing, setSyncing] = useState(false);
  const [activeView, setActiveView] = useState("pos");
  const [summary, setSummary] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: "", category: "beverages", price: "", stock: "-1", emoji: "" });

  // Online/offline listeners
  useEffect(() => {
    const onOnline = () => { setIsOnline(true); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  // Sync queue when back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && selectedVenue) syncQueue();
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load venues
  useEffect(() => {
    venueAPI.getOwnerVenues().then(r => {
      const v = r.data || [];
      setVenues(v);
      if (v.length > 0) setSelectedVenue(v[0]);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load products when venue changes
  useEffect(() => {
    if (!selectedVenue) return;
    const cached = getCachedProducts(selectedVenue.id);
    if (cached) setProducts(cached);
    posAPI.listProducts(selectedVenue.id)
      .then(r => { setProducts(r.data || []); cacheProducts(selectedVenue.id, r.data || []); })
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

  const clearCart = () => setCart([]);
  const cartTotal = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  const cartQty = (id) => cart.find(c => c.product.id === id)?.qty || 0;

  // Offline sync
  const syncQueue = useCallback(async () => {
    if (!selectedVenue) return;
    const queue = getQueue();
    if (!queue.length) return;
    setSyncing(true);
    try {
      await posAPI.syncBatch(selectedVenue.id, queue);
      clearQueue();
      setPendingCount(0);
      toast.success(`${queue.length} offline sale${queue.length > 1 ? "s" : ""} synced!`);
      loadSummary();
    } catch {
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
      total: cartTotal,
      payment_method: paymentMethod,
      offline_id: `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      offline_at: new Date().toISOString(),
    };
    try {
      let result;
      if (isOnline) {
        const res = await posAPI.recordSale(saleData);
        result = res.data;
        loadSummary();
      } else {
        addToQueue(saleData);
        setPendingCount(getQueue().length);
        result = { ...saleData, created_at: saleData.offline_at, offline: true };
        toast("Sale saved offline — will sync when connected", { icon: "📴" });
      }
      setLastSale(result);
      setShowReceipt(true);
      clearCart();
      setProducts(prev => prev.map(p => {
        const item = cart.find(c => c.product.id === p.id);
        if (!item || p.stock < 0) return p;
        return { ...p, stock: Math.max(0, p.stock - item.qty) };
      }));
    } catch (err) {
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
  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.price || !selectedVenue) return;
    const payload = {
      venue_id: selectedVenue.id, name: productForm.name, category: productForm.category,
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
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
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
                <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
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
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-20" />
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

                  <div className="border-t border-border pt-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">Total</span>
                      <span className="text-xl font-display font-black text-primary">₹{cartTotal}</span>
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

                  <Button className="w-full bg-primary text-primary-foreground font-black h-12 text-base" onClick={handleCharge} disabled={charging} data-testid="charge-btn">
                    {charging ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><IndianRupee className="h-5 w-5 mr-1" />Charge ₹{cartTotal}</>}
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
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base">Products Catalog</h2>
            <Button size="sm" className="bg-primary text-primary-foreground font-bold text-xs h-8" onClick={openCreateProduct} data-testid="add-product-btn">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Product
            </Button>
          </div>
          {products.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No products yet. Add your first item!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map(p => (
                <div key={p.id} className={`glass-card rounded-lg p-3 flex items-center gap-3 ${p.is_active === false ? "opacity-50" : ""}`} data-testid={`manage-product-${p.id}`}>
                  <span className="text-2xl">{p.emoji || CAT_EMOJI[p.category] || "🛒"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <Badge variant="secondary" className="text-[10px] capitalize">{p.category}</Badge>
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
            <h2 className="font-bold text-base">Today's Summary <span className="text-muted-foreground font-normal text-sm ml-2">{summary.today}</span></h2>
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
              <History className="h-8 w-8 mx-auto mb-3 opacity-30" /><p className="text-sm">No sales yet</p>
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
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(sale.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
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
            <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleSaveProduct} data-testid="save-product-btn">
              {editingProduct ? "Update Product" : "Add Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Receipt Dialog ─── */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" /> Sale Complete
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div className="space-y-4">
              <div className="glass-card rounded-lg p-4 space-y-2">
                {lastSale.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.name} × {item.qty}</span>
                    <span className="font-bold">₹{item.price * item.qty}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="font-bold">Total</span>
                  <span className="font-display font-black text-xl text-primary">₹{lastSale.total}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Payment</span>
                  <span className="capitalize font-medium">{lastSale.payment_method}</span>
                </div>
                {lastSale.offline && <div className="text-xs text-amber-400 text-center">📴 Saved offline — will sync automatically</div>}
              </div>
              <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={() => setShowReceipt(false)} data-testid="new-sale-btn">
                New Sale
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
