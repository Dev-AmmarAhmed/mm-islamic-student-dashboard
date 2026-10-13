/**
 * AccuEngine v1.0 - High Performance Cache & Security Engine
 * MM Islamic English School ERP
 * Author: Dev Ammar Ahmed & Gemini Architecture
 */

(function (window) {
  "use strict";

  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 1;
  const STORES = ["users", "students", "fees_matrix", "fees_entries", "attendance", "tests", "online_tests", "versions"];

  let idbInstance = null;
  let fsDb = null;
  let rtdb = null;
  let currentUser = null;

  // 1. IndexedDB Initialization
  function openIDB() {
    if (idbInstance) return Promise.resolve(idbInstance);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        STORES.forEach((store) => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store);
          }
        });
      };
      request.onsuccess = (e) => {
        idbInstance = e.target.result;
        resolve(idbInstance);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // 2. Storage Helpers
  async function idbGet(storeName, key) {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(String(key));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async function idbSet(storeName, key, value) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.put(value, String(key));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGetAll(storeName) {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function idbClearAll() {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES, "readwrite");
      STORES.forEach((storeName) => {
        tx.objectStore(storeName).clear();
      });
      tx.oncomplete = () => resolve(true);
    });
  }

  // 3. Engine API
  const AccuEngine = {
    // Engine Initialize: Firebase instances attach karna
    init: function (firebaseFirestore, firebaseRtdb) {
      fsDb = firebaseFirestore;
      rtdb = firebaseRtdb;
      console.log("[AccuEngine] Core initialized successfully.");
    },

    // Session aur Security Guard
    attachKillSwitch: function (userId, onRevokedCallback) {
      currentUser = userId;
      if (!rtdb || !userId) return;

      const statusRef = rtdb.ref(`user_status/${userId}`);
      statusRef.on("value", async (snap) => {
        const val = snap.val();
        if (!snap.exists() || val === "deleted" || val === "inactive") {
          console.warn("[AccuEngine] KillSwitch Triggered: Purging local storage...");
          await idbClearAll();
          localStorage.clear();
          sessionStorage.clear();
          if (typeof onRevokedCallback === "function") {
            onRevokedCallback();
          }
        }
      });
    },

    // Smart Cache Fetch (IndexedDB First -> Background Version Check)
    get: async function (collectionName, docId) {
      // Step A: Phone memory se instant uthao
      const cached = await idbGet(collectionName, docId);
      if (cached) {
        return cached;
      }

      // Step B: Agar cache miss hua toh Firestore se pull karo aur store karo
      if (fsDb) {
        try {
          const docSnap = await fsDb.collection(collectionName).doc(String(docId)).get();
          if (docSnap.exists) {
            const data = docSnap.data();
            await idbSet(collectionName, docId, data);
            return data;
          }
        } catch (err) {
          console.error(`[AccuEngine] Fetch error for ${collectionName}/${docId}:`, err);
        }
      }
      return null;
    },

    // Collection Level Fetch (e.g., student ki saari fees ya attendance)
    getByStudent: async function (collectionName, admn) {
      const cached = await idbGet(collectionName, admn);
      if (cached) return cached;

      if (fsDb) {
        try {
          // Direct document ID check (${admn})
          const docSnap = await fsDb.collection(collectionName).doc(String(admn)).get();
          if (docSnap.exists) {
            const data = docSnap.data();
            await idbSet(collectionName, admn, data);
            return data;
          }
        } catch (err) {
          console.error(`[AccuEngine] getByStudent error for ${collectionName}/${admn}:`, err);
        }
      }
      return null;
    },

    // Smart Save: Firestore mein save karega, IndexedDB update karega, aur RTDB trigger increment karega
    save: async function (collectionName, docId, data, syncTriggerKey = null) {
      // 1. Local Cache Update
      await idbSet(collectionName, docId, data);

      // 2. Firestore Sync
      if (fsDb) {
        await fsDb.collection(collectionName).doc(String(docId)).set(data, { merge: true });
      }

      // 3. RTDB Trigger increment (Baaqi users ko notify karne ke liye)
      if (rtdb && syncTriggerKey) {
        const triggerRef = rtdb.ref(`sync_triggers/${syncTriggerKey}`);
        triggerRef.transaction((current) => (current || 0) + 1);
      }
      return true;
    },

    // Wipe storage on manual logout
    purgeCache: async function () {
      await idbClearAll();
      console.log("[AccuEngine] Local IndexedDB fully purged.");
    }
  };

  window.AccuEngine = AccuEngine;
})(window);
23
