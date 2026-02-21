import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { venueAPI, posAPI } from '../../api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import TabBar from '../../components/common/TabBar';
import FilterChips from '../../components/common/FilterChips';
import ModalSheet from '../../components/common/ModalSheet';
import EmptyState from '../../components/common/EmptyState';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const TABS = [
  { key: 'terminal', label: 'Terminal' },
  { key: 'products', label: 'Products' },
  { key: 'sales', label: 'Sales' },
];

const CATEGORIES = ['All', 'Beverages', 'Snacks', 'Equipment', 'Apparel'];
const PAYMENT_METHODS = ['Cash', 'Card', 'UPI'];

const OFFLINE_QUEUE_KEY = 'horizon_pos_offline_queue';

function ProductGridItem({ product, onAdd }) {
  return (
    <TouchableOpacity style={styles.productGridItem} onPress={onAdd} activeOpacity={0.75}>
      <Card style={styles.productGridCard}>
        <Text style={styles.productEmoji}>{product.emoji || '\uD83D\uDCE6'}</Text>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productPrice}>{'\u20B9'}{product.price}</Text>
        <Text style={styles.productStock}>Stock: {product.stock ?? '---'}</Text>
        <View style={styles.addBtnContainer}>
          <View style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ ADD</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function CartItem({ item, onRemove, onIncrement, onDecrement }) {
  return (
    <View style={styles.cartItem}>
      <Text style={styles.cartEmoji}>{item.emoji || '\uD83D\uDCE6'}</Text>
      <View style={{ flex: 1, marginHorizontal: Spacing.sm }}>
        <Text style={styles.cartName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cartPrice}>{'\u20B9'}{item.price} x {item.qty}</Text>
      </View>
      <View style={styles.cartQtyRow}>
        <TouchableOpacity style={styles.cartQtyBtn} onPress={onDecrement}>
          <Text style={styles.cartQtyBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.cartQtyCount}>{item.qty}</Text>
        <TouchableOpacity style={styles.cartQtyBtn} onPress={onIncrement}>
          <Text style={styles.cartQtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.cartItemTotal}>{'\u20B9'}{(item.price * item.qty).toLocaleString('en-IN')}</Text>
    </View>
  );
}

function ProductListItem({ product, onEdit, onDelete }) {
  return (
    <Card style={styles.productListCard}>
      <View style={styles.productListRow}>
        <Text style={{ fontSize: 24 }}>{product.emoji || '\uD83D\uDCE6'}</Text>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={styles.productListName}>{product.name}</Text>
          <Text style={styles.productListMeta}>
            {product.category || 'Uncategorized'} | {'\u20B9'}{product.price} | Stock: {product.stock ?? '---'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <TouchableOpacity onPress={onEdit}>
            <Text style={{ color: Colors.sky, fontSize: Typography.xs, fontFamily: Typography.fontBodyBold }}>EDIT</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete}>
            <Text style={{ color: Colors.destructive, fontSize: Typography.xs, fontFamily: Typography.fontBodyBold }}>DEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

function SaleRow({ sale }) {
  return (
    <Card style={styles.saleCard}>
      <View style={styles.saleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.saleAmount}>{'\u20B9'}{(sale.total || 0).toLocaleString('en-IN')}</Text>
          <Text style={styles.saleMeta}>
            {sale.payment_method || 'Cash'} | {sale.items?.length || 0} items
          </Text>
          <Text style={styles.saleDate}>
            {sale.created_at ? new Date(sale.created_at).toLocaleString() : ''}
          </Text>
        </View>
        <Badge variant={sale.payment_method === 'UPI' ? 'violet' : sale.payment_method === 'Card' ? 'sky' : 'default'}>
          {sale.payment_method || 'Cash'}
        </Badge>
      </View>
    </Card>
  );
}

export default function POSScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('terminal');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Venue
  const [venues, setVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);

  // Terminal
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [charging, setCharging] = useState(false);

  // Products tab
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', category: 'Beverages', emoji: '', price: '', stock: '' });
  const [productSaving, setProductSaving] = useState(false);

  // Sales tab
  const [salesSummary, setSalesSummary] = useState(null);
  const [recentSales, setRecentSales] = useState([]);

  // Offline
  const [isOffline, setIsOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState([]);

  const selectedVenue = venues.find(v => v.id === selectedVenueId);

  const loadVenues = async () => {
    try {
      const res = await venueAPI.getOwnerVenues();
      const v = res.data || [];
      setVenues(v);
      if (v.length > 0 && !selectedVenueId) {
        setSelectedVenueId(v[0].id);
      }
    } catch {
      setVenues([]);
    }
  };

  const loadProducts = useCallback(async () => {
    if (!selectedVenueId) return;
    try {
      const res = await posAPI.listProducts(selectedVenueId);
      setProducts(res.data || []);
    } catch {
      setProducts([]);
    }
  }, [selectedVenueId]);

  const loadSales = useCallback(async () => {
    if (!selectedVenueId) return;
    try {
      const [sumRes, salesRes] = await Promise.all([
        posAPI.summary(selectedVenueId).catch(() => ({ data: null })),
        posAPI.listSales(selectedVenueId, 20).catch(() => ({ data: [] })),
      ]);
      setSalesSummary(sumRes.data);
      setRecentSales(salesRes.data || []);
    } catch {
      // silently fail
    }
  }, [selectedVenueId]);

  const loadOfflineQueue = async () => {
    try {
      const stored = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (stored) setOfflineQueue(JSON.parse(stored));
    } catch {
      // ignore
    }
  };

  const loadData = async () => {
    try {
      await loadVenues();
      await loadOfflineQueue();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedVenueId) {
      loadProducts();
      loadSales();
    }
  }, [selectedVenueId, loadProducts, loadSales]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData().then(() => {
      loadProducts();
      loadSales();
    });
  };

  // Cart logic
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === product.id);
      if (existing) {
        return prev.map(c => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const incrementItem = (productId) => {
    setCart(prev => prev.map(c => c.id === productId ? { ...c, qty: c.qty + 1 } : c));
  };

  const decrementItem = (productId) => {
    setCart(prev => {
      const item = prev.find(c => c.id === productId);
      if (item && item.qty <= 1) return prev.filter(c => c.id !== productId);
      return prev.map(c => c.id === productId ? { ...c, qty: c.qty - 1 } : c);
    });
  };

  const removeItem = (productId) => {
    setCart(prev => prev.filter(c => c.id !== productId));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);

  const handleCharge = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Add products to the cart before charging.');
      return;
    }

    const saleData = {
      venue_id: selectedVenueId,
      items: cart.map(c => ({ product_id: c.id, name: c.name, qty: c.qty, price: c.price })),
      payment_method: paymentMethod,
      total: cartTotal,
    };

    if (isOffline) {
      const queue = [...offlineQueue, { ...saleData, offline_at: new Date().toISOString() }];
      setOfflineQueue(queue);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      Alert.alert('Queued Offline', 'Sale has been queued and will sync when you are back online.');
      setCart([]);
      return;
    }

    setCharging(true);
    try {
      await posAPI.recordSale(saleData);
      Alert.alert('Sale Recorded', `Total: \u20B9${cartTotal.toLocaleString('en-IN')} via ${paymentMethod}`);
      setCart([]);
      loadSales();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to record sale');
    } finally {
      setCharging(false);
    }
  };

  const handleSyncOffline = async () => {
    if (offlineQueue.length === 0) return;
    try {
      for (const sale of offlineQueue) {
        await posAPI.recordSale(sale);
      }
      setOfflineQueue([]);
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
      Alert.alert('Synced', 'All offline sales have been synced successfully.');
      loadSales();
    } catch (err) {
      Alert.alert('Sync Error', 'Some sales could not be synced. They remain in the queue.');
    }
  };

  // Product CRUD
  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: '', category: 'Beverages', emoji: '', price: '', stock: '' });
    setProductModalVisible(true);
  };

  const openEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || '',
      category: product.category || 'Beverages',
      emoji: product.emoji || '',
      price: String(product.price || ''),
      stock: String(product.stock ?? ''),
    });
    setProductModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.price) {
      Alert.alert('Validation', 'Name and price are required.');
      return;
    }
    setProductSaving(true);
    try {
      const payload = {
        venue_id: selectedVenueId,
        name: productForm.name,
        category: productForm.category,
        emoji: productForm.emoji || '\uD83D\uDCE6',
        price: parseFloat(productForm.price) || 0,
        stock: productForm.stock ? parseInt(productForm.stock, 10) : null,
      };
      if (editingProduct) {
        await posAPI.updateProduct(editingProduct.id, payload);
      } else {
        await posAPI.createProduct(payload);
      }
      setProductModalVisible(false);
      loadProducts();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to save product');
    } finally {
      setProductSaving(false);
    }
  };

  const handleDeleteProduct = (product) => {
    Alert.alert('Delete Product', `Delete "${product.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await posAPI.deleteProduct(product.id);
            loadProducts();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to delete');
          }
        },
      },
    ]);
  };

  // Filtered products
  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter(p => p.category === selectedCategory);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderTerminal = () => (
    <View>
      {/* Offline banner */}
      {(isOffline || offlineQueue.length > 0) && (
        <Card style={styles.offlineBanner}>
          <View style={styles.offlineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineText}>
                {isOffline ? 'You are offline' : `${offlineQueue.length} pending sale(s)`}
              </Text>
            </View>
            {!isOffline && offlineQueue.length > 0 && (
              <Button size="sm" onPress={handleSyncOffline}>Sync</Button>
            )}
          </View>
        </Card>
      )}

      {/* Category filter */}
      <FilterChips
        items={CATEGORIES}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
        style={{ marginBottom: Spacing.md }}
      />

      {/* Product grid */}
      {filteredProducts.length === 0 ? (
        <EmptyState icon={'\uD83D\uDCE6'} title="No products" subtitle="Add products in the Products tab to start selling." />
      ) : (
        <View style={styles.productGrid}>
          {filteredProducts.map((p) => (
            <ProductGridItem key={p.id} product={p} onAdd={() => addToCart(p)} />
          ))}
        </View>
      )}

      {/* Cart */}
      {cart.length > 0 && (
        <Card style={styles.cartCard}>
          <Text style={styles.cartTitle}>Cart ({cart.length} items)</Text>
          {cart.map(item => (
            <CartItem
              key={item.id}
              item={item}
              onRemove={() => removeItem(item.id)}
              onIncrement={() => incrementItem(item.id)}
              onDecrement={() => decrementItem(item.id)}
            />
          ))}
          <View style={styles.cartDivider} />
          <View style={styles.cartTotalRow}>
            <Text style={styles.cartTotalLabel}>Total</Text>
            <Text style={styles.cartTotalValue}>{'\u20B9'}{cartTotal.toLocaleString('en-IN')}</Text>
          </View>

          {/* Payment method */}
          <Text style={styles.paymentLabel}>PAYMENT METHOD</Text>
          <View style={styles.paymentRow}>
            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.paymentBtn, paymentMethod === m && styles.paymentBtnActive]}
                onPress={() => setPaymentMethod(m)}
              >
                <Text style={[styles.paymentBtnText, paymentMethod === m && styles.paymentBtnTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button onPress={handleCharge} loading={charging} style={{ marginTop: Spacing.md }}>
            Charge {'\u20B9'}{cartTotal.toLocaleString('en-IN')}
          </Button>
        </Card>
      )}
    </View>
  );

  const renderProducts = () => (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Products ({products.length})</Text>
        <Button size="sm" onPress={openAddProduct}>Add Product</Button>
      </View>
      {products.length === 0 ? (
        <EmptyState icon={'\uD83D\uDCE6'} title="No products" subtitle="Add products to your POS catalog." actionLabel="Add Product" onAction={openAddProduct} />
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {products.map(p => (
            <ProductListItem
              key={p.id}
              product={p}
              onEdit={() => openEditProduct(p)}
              onDelete={() => handleDeleteProduct(p)}
            />
          ))}
        </View>
      )}
    </View>
  );

  const renderSales = () => (
    <View>
      {/* Summary cards */}
      {salesSummary && (
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>TODAY'S REVENUE</Text>
            <Text style={[styles.statValue, { color: Colors.primary }]}>
              {'\u20B9'}{(salesSummary.today_revenue || 0).toLocaleString('en-IN')}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>SALES COUNT</Text>
            <Text style={[styles.statValue, { color: Colors.violet }]}>
              {salesSummary.today_sales_count || 0}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>ITEMS SOLD</Text>
            <Text style={[styles.statValue, { color: Colors.amber }]}>
              {salesSummary.today_items_sold || 0}
            </Text>
          </Card>
        </View>
      )}

      <Text style={styles.sectionTitle}>Recent Sales</Text>
      {recentSales.length === 0 ? (
        <EmptyState icon={'\uD83D\uDCB0'} title="No sales yet" subtitle="Sales will appear here after you record transactions." />
      ) : (
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          {recentSales.map((s, i) => (
            <SaleRow key={s.id || i} sale={s} />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerSub}>POINT OF SALE</Text>
          <Text style={styles.headerTitle}>POS Terminal</Text>
        </View>

        {/* Venue Selector */}
        {venues.length > 1 && (
          <TouchableOpacity
            style={styles.venuePicker}
            onPress={() => setVenuePickerOpen(true)}
            activeOpacity={0.75}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.venuePickerLabel}>VENUE</Text>
              <Text style={styles.venuePickerValue} numberOfLines={1}>
                {selectedVenue?.name || 'Select venue'}
              </Text>
            </View>
            <Text style={styles.venuePickerArrow}>{'\u25BC'}</Text>
          </TouchableOpacity>
        )}

        {/* Tabs */}
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'terminal' && renderTerminal()}
          {activeTab === 'products' && renderProducts()}
          {activeTab === 'sales' && renderSales()}
        </View>
      </ScrollView>

      {/* Venue Picker Modal */}
      <ModalSheet visible={venuePickerOpen} onClose={() => setVenuePickerOpen(false)} title="Select Venue">
        {venues.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[styles.venueOption, selectedVenueId === v.id && styles.venueOptionActive]}
            onPress={() => { setSelectedVenueId(v.id); setVenuePickerOpen(false); }}
          >
            <Text style={styles.venueOptionName}>{v.name}</Text>
            {selectedVenueId === v.id && <Text style={{ color: Colors.primary, fontSize: 18 }}>{'\u2713'}</Text>}
          </TouchableOpacity>
        ))}
      </ModalSheet>

      {/* Add/Edit Product Modal */}
      <ModalSheet
        visible={productModalVisible}
        onClose={() => setProductModalVisible(false)}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
      >
        <Input
          label="Product Name"
          value={productForm.name}
          onChangeText={(v) => setProductForm(prev => ({ ...prev, name: v }))}
          placeholder="e.g. Energy Drink"
        />

        <Text style={styles.formLabel}>Category</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.filter(c => c !== 'All').map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryBtn, productForm.category === cat && styles.categoryBtnActive]}
              onPress={() => setProductForm(prev => ({ ...prev, category: cat }))}
            >
              <Text style={[styles.categoryBtnText, productForm.category === cat && styles.categoryBtnTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Emoji Icon"
          value={productForm.emoji}
          onChangeText={(v) => setProductForm(prev => ({ ...prev, emoji: v }))}
          placeholder="e.g. \u26BD or \u2615"
        />
        <Input
          label="Price (INR)"
          value={productForm.price}
          onChangeText={(v) => setProductForm(prev => ({ ...prev, price: v }))}
          placeholder="100"
          keyboardType="numeric"
        />
        <Input
          label="Stock Quantity"
          value={productForm.stock}
          onChangeText={(v) => setProductForm(prev => ({ ...prev, stock: v }))}
          placeholder="50"
          keyboardType="numeric"
        />

        <Button onPress={handleSaveProduct} loading={productSaving} style={{ marginTop: Spacing.md }}>
          {editingProduct ? 'Update Product' : 'Add Product'}
        </Button>
      </ModalSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl * 3 },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { marginTop: Spacing.base, marginBottom: Spacing.lg },
  headerSub: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginTop: 4 },

  // Venue picker
  venuePicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Spacing.radiusLg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.md },
  venuePickerLabel: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5 },
  venuePickerValue: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginTop: 2 },
  venuePickerArrow: { fontSize: 12, color: Colors.mutedForeground, marginLeft: Spacing.sm },

  venueOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  venueOptionActive: { backgroundColor: Colors.primaryLight, marginHorizontal: -Spacing.xl, paddingHorizontal: Spacing.xl, borderRadius: Spacing.radiusMd },
  venueOptionName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },

  tabContent: { marginTop: Spacing.sm },

  // Offline banner
  offlineBanner: { padding: Spacing.md, marginBottom: Spacing.md, borderColor: Colors.amber },
  offlineRow: { flexDirection: 'row', alignItems: 'center' },
  offlineText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.amber },

  // Product grid
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  productGridItem: { width: '48%' },
  productGridCard: { padding: Spacing.md, alignItems: 'center' },
  productEmoji: { fontSize: 32, marginBottom: Spacing.sm },
  productName: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground, textAlign: 'center', minHeight: 36 },
  productPrice: { fontSize: Typography.base, fontFamily: Typography.fontDisplayBlack, color: Colors.primary, marginTop: Spacing.xs },
  productStock: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  addBtnContainer: { marginTop: Spacing.sm },
  addBtn: { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Spacing.radiusFull },
  addBtnText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.primary, letterSpacing: 0.5 },

  // Cart
  cartCard: { padding: Spacing.md, marginTop: Spacing.md },
  cartTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginBottom: Spacing.md },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  cartEmoji: { fontSize: 20 },
  cartName: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  cartPrice: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  cartQtyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cartQtyBtn: { width: 28, height: 28, borderRadius: Spacing.radiusSm, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cartQtyBtnText: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  cartQtyCount: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground, minWidth: 20, textAlign: 'center' },
  cartItemTotal: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginLeft: Spacing.sm, minWidth: 60, textAlign: 'right' },
  cartDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  cartTotalLabel: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  cartTotalValue: { fontSize: Typography.xl, fontFamily: Typography.fontDisplayBlack, color: Colors.primary },

  // Payment
  paymentLabel: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: Spacing.sm },
  paymentRow: { flexDirection: 'row', gap: Spacing.sm },
  paymentBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Spacing.radiusMd, backgroundColor: Colors.secondary, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  paymentBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  paymentBtnText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  paymentBtnTextActive: { color: Colors.primary },

  // Product list
  productListCard: { padding: Spacing.md },
  productListRow: { flexDirection: 'row', alignItems: 'center' },
  productListName: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  productListMeta: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },

  // Stats
  statsGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, padding: Spacing.md },
  statLabel: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: Spacing.xs },
  statValue: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },

  // Sales
  saleCard: { padding: Spacing.md },
  saleRow: { flexDirection: 'row', alignItems: 'center' },
  saleAmount: { fontSize: Typography.base, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  saleMeta: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  saleDate: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },

  // Form
  formLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.md },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  categoryBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Spacing.radiusFull, backgroundColor: Colors.secondary, borderWidth: 1, borderColor: Colors.border },
  categoryBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  categoryBtnText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  categoryBtnTextActive: { color: Colors.primary },
});
