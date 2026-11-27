/**
 * Browser Neighborhood Pack Store (IndexedDB + localStorage active-pack pointer).
 *
 * Allows storing multiple full 256×256–512×512 custom neighborhoods locally
 * (well beyond localStorage's 5MB limit!) on iPad Safari and desktop browsers,
 * with a clean in-memory fallback for headless Node tests or private tabs.
 */

const DB_NAME = "neighborhood_explorer_packs_v1";
const DB_VERSION = 1;
const STORE_NAME = "packs";
const ACTIVE_PACK_STORAGE_KEY = "neighborhood_explorer_active_pack_id_v1";

export const BUILTIN_NEWTON_ID = "newton_centre";

const memoryStore = new Map();
let memoryActiveId = BUILTIN_NEWTON_ID;

function hasIndexedDB() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function openPackDb() {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
    } catch (err) {
      reject(err);
    }
  });
}

function makePackSummary(pack) {
  return {
    id: pack.meta?.id || "custom_neighborhood",
    townName: pack.meta?.townName || "Custom Neighborhood",
    cityShort: pack.meta?.cityShort || pack.meta?.townName || "Town",
    homeAddress: pack.meta?.homeAddress || pack.worldMap?.origin?.address || "Home Base",
    heroName: pack.meta?.heroName || "Explorer",
    width: pack.worldMap?.dimensions?.width || 0,
    height: pack.worldMap?.dimensions?.height || 0,
    buildingsCount: (pack.worldMap?.buildings || []).length,
    landmarksCount: (pack.landmarks || []).length,
    questsCount: (pack.quests || []).length,
    generatedAt: pack.meta?.generatedAt || new Date().toISOString(),
  };
}

export function getActiveNeighborhoodId() {
  if (typeof localStorage !== "undefined") {
    try {
      return localStorage.getItem(ACTIVE_PACK_STORAGE_KEY) || BUILTIN_NEWTON_ID;
    } catch {
      return memoryActiveId;
    }
  }
  return memoryActiveId;
}

export function setActiveNeighborhoodId(packId) {
  const next = packId && packId !== BUILTIN_NEWTON_ID ? String(packId) : BUILTIN_NEWTON_ID;
  memoryActiveId = next;
  if (typeof localStorage !== "undefined") {
    try {
      if (next === BUILTIN_NEWTON_ID) {
        localStorage.removeItem(ACTIVE_PACK_STORAGE_KEY);
      } else {
        localStorage.setItem(ACTIVE_PACK_STORAGE_KEY, next);
      }
    } catch {
      // ignore private mode storage errors
    }
  }
  return next;
}

export async function saveNeighborhoodPack(pack) {
  if (!pack || !pack.meta?.id) {
    throw new Error("Cannot save neighborhood pack without meta.id");
  }
  const summary = makePackSummary(pack);
  const record = { id: summary.id, summary, pack };

  const db = await openPackDb().catch(() => null);
  if (!db) {
    memoryStore.set(summary.id, record);
    return summary;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve(summary);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Failed to save neighborhood pack"));
    };
  });
}

export async function loadNeighborhoodPack(packId) {
  if (!packId || packId === BUILTIN_NEWTON_ID) return null;
  const db = await openPackDb().catch(() => null);
  if (!db) {
    return memoryStore.get(packId)?.pack || null;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(packId);
    req.onsuccess = () => {
      db.close();
      resolve(req.result?.pack || null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error("Failed to load neighborhood pack"));
    };
  });
}

export async function listNeighborhoodPacks() {
  const db = await openPackDb().catch(() => null);
  if (!db) {
    return Array.from(memoryStore.values())
      .map((r) => r.summary)
      .sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      db.close();
      const summaries = (req.result || [])
        .map((r) => r.summary || makePackSummary(r.pack))
        .sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
      resolve(summaries);
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error("Failed to list neighborhood packs"));
    };
  });
}

export async function deleteNeighborhoodPack(packId) {
  if (!packId || packId === BUILTIN_NEWTON_ID) return false;
  if (getActiveNeighborhoodId() === packId) {
    setActiveNeighborhoodId(BUILTIN_NEWTON_ID);
  }
  const db = await openPackDb().catch(() => null);
  if (!db) {
    return memoryStore.delete(packId);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(packId);
    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Failed to delete neighborhood pack"));
    };
  });
}
