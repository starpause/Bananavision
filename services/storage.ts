import { GeneratedImage, GenerationSettings } from '../types';

const DB_NAME = 'BananaVisionDB';
const DB_VERSION = 1;
const STORE_KEYVAL = 'keyval';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_KEYVAL)) {
        db.createObjectStore(STORE_KEYVAL);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function setDBItem<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_KEYVAL, 'readwrite');
      const store = tx.objectStore(STORE_KEYVAL);
      const req = store.put(value, key);

      // If writing non-empty images, also keep a redundant backup copy
      if (key === 'saved_images' && Array.isArray(value) && value.length > 0) {
        try {
          store.put(value, 'saved_images_backup');
        } catch (_) {}
      }

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to write key ${key} to IndexedDB:`, err);
  }
}

export async function getDBItem<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_KEYVAL, 'readonly');
      const store = tx.objectStore(STORE_KEYVAL);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to read key ${key} from IndexedDB:`, err);
    return null;
  }
}

export async function loadSavedData(): Promise<{
  images: GeneratedImage[];
  settings: Partial<GenerationSettings> | null;
}> {
  let images: GeneratedImage[] = [];
  let settings: Partial<GenerationSettings> | null = null;

  // First try IndexedDB
  let dbImages = await getDBItem<GeneratedImage[]>('saved_images');
  const dbSettings = await getDBItem<Partial<GenerationSettings>>('saved_settings');

  // If primary is empty or null, check the backup store
  if (!dbImages || dbImages.length === 0) {
    const backupImages = await getDBItem<GeneratedImage[]>('saved_images_backup');
    if (backupImages && backupImages.length > 0) {
      dbImages = backupImages;
      // Re-persist to primary store
      await setDBItem('saved_images', backupImages);
    }
  }

  if (dbImages && dbImages.length > 0) {
    images = dbImages;
  }
  if (dbSettings) {
    settings = dbSettings;
  }

  // Migrate legacy data from localStorage if present
  try {
    const legacyImgStr = localStorage.getItem('bananavision_saved_images');
    if (legacyImgStr) {
      const legacyImages = JSON.parse(legacyImgStr);
      if (Array.isArray(legacyImages) && legacyImages.length > 0) {
        images = [...images, ...legacyImages].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        await setDBItem('saved_images', images);
      }
      localStorage.removeItem('bananavision_saved_images');
    }
  } catch (err) {
    console.warn('Error migrating legacy localStorage images:', err);
    try { localStorage.removeItem('bananavision_saved_images'); } catch (_) {}
  }

  try {
    const legacySetStr = localStorage.getItem('bananavision_saved_settings');
    if (legacySetStr) {
      const legacySettings = JSON.parse(legacySetStr);
      if (legacySettings && !settings) {
        settings = legacySettings;
        await setDBItem('saved_settings', settings);
      }
      localStorage.removeItem('bananavision_saved_settings');
    }
  } catch (err) {
    console.warn('Error migrating legacy localStorage settings:', err);
    try { localStorage.removeItem('bananavision_saved_settings'); } catch (_) {}
  }

  return { images, settings };
}
