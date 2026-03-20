/**
 * IndexedDB cache layer for indicator data persistence.
 * Provides stale-while-revalidate semantics: returns cached data immediately,
 * then revalidates in background.
 */

const DB_NAME = "aps-indicator-cache";
const DB_VERSION = 1;
const STORE_NAME = "indicator-results";

type CacheEntry<T = unknown> = {
  key: string;
  data: T;
  timestamp: number;
  referenceUploadId: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("referenceUploadId", "referenceUploadId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
};

export const idbGet = async <T>(key: string): Promise<CacheEntry<T> | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve((request.result as CacheEntry<T>) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
};

export const idbSet = async <T>(key: string, data: T, referenceUploadId: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const entry: CacheEntry<T> = { key, data, timestamp: Date.now(), referenceUploadId };
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // silently fail - cache is optional
  }
};

export const idbDelete = async (key: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // silently fail
  }
};

export const idbClearByUpload = async (referenceUploadId: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("referenceUploadId");
      const request = index.openCursor(IDBKeyRange.only(referenceUploadId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch {
    // silently fail
  }
};

/** Build a cache key for indicator section data */
export const indicatorCacheKey = (sectionKey: string, sheetName: string, referenceUploadId: string) =>
  `indicator:${sectionKey}:${referenceUploadId}:${sheetName}`;

/** Build a cache key for search results */
export const searchCacheKey = (sheetName: string, referenceUploadId: string) =>
  `search:${referenceUploadId}:${sheetName}`;

/** Max age for cached data (30 minutes) */
export const CACHE_MAX_AGE_MS = 30 * 60 * 1000;

export const isCacheStale = (timestamp: number) => Date.now() - timestamp > CACHE_MAX_AGE_MS;
