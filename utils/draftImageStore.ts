const DB_NAME = 'haccp_draft_images';
const STORE_NAME = 'images';
const DB_VERSION = 1;

interface DraftImageRecord {
  imageId: string;
  draftId: string;
  base64: string;
  createdAt: number;
  syncedToDb?: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'imageId' });
        store.createIndex('draftId', 'draftId', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveImageToStore(draftId: string, imageId: string, base64: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const record: DraftImageRecord = { imageId, draftId, base64, createdAt: Date.now(), syncedToDb: false };
      const req = tx.objectStore(STORE_NAME).put(record);
      req.onsuccess = () => { db.close(); resolve(); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {}
}

export async function getImagesForDraft(draftId: string): Promise<DraftImageRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const index = tx.objectStore(STORE_NAME).index('draftId');
      const req = index.getAll(draftId);
      req.onsuccess = () => { db.close(); resolve(req.result || []); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {
    return [];
  }
}

export async function getAllUnsyncedImages(): Promise<DraftImageRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        db.close();
        resolve((req.result || []).filter((r: DraftImageRecord) => !r.syncedToDb));
      };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {
    return [];
  }
}

export async function markImageSynced(imageId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(imageId);
      getReq.onsuccess = () => {
        const record = getReq.result as DraftImageRecord | undefined;
        if (record) {
          record.syncedToDb = true;
          store.put(record);
        }
        db.close();
        resolve();
      };
      getReq.onerror = () => { db.close(); reject(getReq.error); };
    });
  } catch {}
}

export async function removeImageFromStore(imageId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(imageId);
      req.onsuccess = () => { db.close(); resolve(); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {}
}

export async function clearDraftImages(draftId: string): Promise<void> {
  try {
    const images = await getImagesForDraft(draftId);
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      let remaining = images.length;
      if (remaining === 0) { db.close(); resolve(); return; }
      for (const img of images) {
        const req = store.delete(img.imageId);
        req.onsuccess = () => { remaining--; if (remaining === 0) { db.close(); resolve(); } };
        req.onerror = () => { remaining--; if (remaining === 0) { db.close(); resolve(); } };
      }
    });
  } catch {}
}

export function generateImageId(draftId: string): string {
  return `dimg-${draftId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
