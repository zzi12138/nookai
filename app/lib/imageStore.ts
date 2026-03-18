'use client';

const DB_NAME = 'nookai';
const STORE_NAME = 'images';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open DB'));
  });
}

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `img_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export type StoredResult = {
  original: string;
  generated: string;
  theme?: string;
  evaluation?: string;
  suggestions?: string;
  constraints?: string[];
  requirements?: string[];
  createdAt: number;
};

export async function saveResult(result: Omit<StoredResult, 'createdAt'>): Promise<string> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const id = generateId();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({ ...result, createdAt: Date.now() }, id);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error || new Error('Failed to save'));

    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
    tx.onabort = () => db.close();
  });
}

export async function loadResult(id: string): Promise<StoredResult | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result as StoredResult | undefined;
      resolve(result || null);
    };
    request.onerror = () => reject(request.error || new Error('Failed to load'));

    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
    tx.onabort = () => db.close();
  });
}
