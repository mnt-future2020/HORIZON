/**
 * Enhanced Offline POS Store using IndexedDB (via idb-keyval pattern)
 * Provides:
 * - IndexedDB-backed offline sale queue (larger capacity than localStorage)
 * - Product cache with TTL
 * - Conflict resolution (last-write-wins with timestamps)
 * - Background sync via Service Worker registration
 * - Sync status tracking
 */

const DB_NAME = "horizon_pos";
const DB_VERSION = 1;
const STORE_QUEUE = "offline_queue";
const STORE_PRODUCTS = "products_cache";
const STORE_SYNC_LOG = "sync_log";

// ─── IndexedDB Helpers ───────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: "offline_id" });
        queueStore.createIndex("venue_id", "venue_id", { unique: false });
        queueStore.createIndex("created_at", "created_at", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS, { keyPath: "cache_key" });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_LOG)) {
        const syncStore = db.createObjectStore(STORE_SYNC_LOG, { keyPath: "id", autoIncrement: true });
        syncStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore(storeName, mode, callback) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = callback(store);

      tx.oncomplete = () => resolve(result.result || result);
      tx.onerror = () => reject(tx.error);

      // Handle IDBRequest
      if (result instanceof IDBRequest) {
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error);
      }
    });
  });
}

// ─── Offline Queue Operations ────────────────────────────────────────────────

/**
 * Add a sale to the offline queue (IndexedDB).
 */
export async function addToOfflineQueue(sale) {
  const entry = {
    ...sale,
    offline_id: sale.offline_id || `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    offline_at: sale.offline_at || new Date().toISOString(),
    sync_status: "pending", // pending, syncing, synced, failed
    retry_count: 0,
  };

  await withStore(STORE_QUEUE, "readwrite", (store) => store.put(entry));
  return entry;
}

/**
 * Get all pending sales from the offline queue.
 */
export async function getOfflineQueue() {
  return withStore(STORE_QUEUE, "readonly", (store) => store.getAll());
}

/**
 * Get count of pending sales.
 */
export async function getOfflineQueueCount() {
  return withStore(STORE_QUEUE, "readonly", (store) => store.count());
}

/**
 * Remove a sale from the queue (after successful sync).
 */
export async function removeFromQueue(offlineId) {
  return withStore(STORE_QUEUE, "readwrite", (store) => store.delete(offlineId));
}

/**
 * Clear the entire offline queue.
 */
export async function clearOfflineQueue() {
  return withStore(STORE_QUEUE, "readwrite", (store) => store.clear());
}

/**
 * Mark a sale's sync status.
 */
export async function updateSyncStatus(offlineId, status) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_QUEUE);
    const getReq = store.get(offlineId);

    getReq.onsuccess = () => {
      const entry = getReq.result;
      if (entry) {
        entry.sync_status = status;
        if (status === "failed") {
          entry.retry_count = (entry.retry_count || 0) + 1;
        }
        store.put(entry);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ─── Product Cache Operations ────────────────────────────────────────────────

/**
 * Cache products for a venue (with timestamp for TTL).
 */
export async function cacheProducts(venueId, products) {
  const entry = {
    cache_key: `products_${venueId}`,
    venue_id: venueId,
    products,
    cached_at: new Date().toISOString(),
  };
  return withStore(STORE_PRODUCTS, "readwrite", (store) => store.put(entry));
}

/**
 * Get cached products for a venue. Returns null if expired (TTL: 24h).
 */
export async function getCachedProducts(venueId, ttlMs = 86400000) {
  try {
    const entry = await withStore(STORE_PRODUCTS, "readonly", (store) =>
      store.get(`products_${venueId}`)
    );
    if (!entry) return null;

    const age = Date.now() - new Date(entry.cached_at).getTime();
    if (age > ttlMs) return null; // Expired

    return entry.products;
  } catch {
    return null;
  }
}

// ─── Sync Log Operations ─────────────────────────────────────────────────────

/**
 * Record a sync event in the log.
 */
export async function logSyncEvent(event) {
  const entry = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  return withStore(STORE_SYNC_LOG, "readwrite", (store) => store.add(entry));
}

/**
 * Get recent sync events.
 */
export async function getRecentSyncLogs(limit = 20) {
  const all = await withStore(STORE_SYNC_LOG, "readonly", (store) => store.getAll());
  return (all || []).slice(-limit).reverse();
}

// ─── Migration from localStorage ─────────────────────────────────────────────

/**
 * One-time migration from localStorage to IndexedDB.
 */
export async function migrateFromLocalStorage() {
  const LEGACY_KEY = "horizon_pos_offline_queue";
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return 0;

    const legacyQueue = JSON.parse(raw);
    if (!Array.isArray(legacyQueue) || legacyQueue.length === 0) return 0;

    let migrated = 0;
    for (const sale of legacyQueue) {
      await addToOfflineQueue(sale);
      migrated++;
    }

    // Clear localStorage after successful migration
    localStorage.removeItem(LEGACY_KEY);

    await logSyncEvent({
      type: "migration",
      message: `Migrated ${migrated} sales from localStorage to IndexedDB`,
      count: migrated,
    });

    return migrated;
  } catch {
    return 0;
  }
}

// ─── Conflict Resolution ─────────────────────────────────────────────────────

/**
 * Last-write-wins conflict resolution.
 * Compares timestamps and keeps the most recent version.
 */
export function resolveConflict(localEntry, serverEntry) {
  const localTime = new Date(localEntry.offline_at || localEntry.created_at).getTime();
  const serverTime = new Date(serverEntry.created_at).getTime();

  if (localTime >= serverTime) {
    return { winner: "local", entry: localEntry };
  }
  return { winner: "server", entry: serverEntry };
}

// ─── Background Sync Registration ────────────────────────────────────────────

/**
 * Register for background sync (if supported).
 * This allows sales to sync even when the app tab is closed.
 */
export async function registerBackgroundSync() {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register("pos-offline-sync");
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// ─── Sync Status Summary ─────────────────────────────────────────────────────

/**
 * Get a summary of the current offline state.
 */
export async function getOfflineSummary() {
  try {
    const queue = await getOfflineQueue();
    const pending = queue.filter((s) => s.sync_status === "pending").length;
    const failed = queue.filter((s) => s.sync_status === "failed").length;
    const syncing = queue.filter((s) => s.sync_status === "syncing").length;

    return {
      total: queue.length,
      pending,
      failed,
      syncing,
      isClean: queue.length === 0,
      hasFailures: failed > 0,
    };
  } catch {
    return { total: 0, pending: 0, failed: 0, syncing: 0, isClean: true, hasFailures: false };
  }
}
