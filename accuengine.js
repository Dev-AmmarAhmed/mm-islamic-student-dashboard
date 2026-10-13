/**
 * AccuEngine v4.0 - Smart Sentinel Cache & Sync Engine
 * MM Islamic English School ERP
 * 0-Network Reads when data is unchanged | Auto-sync on updates
 */

(function (window) {
  "use strict";

  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 7;
  const STORES = [
    "users",
    "students",
    "teachers",
    "fees_matrix",
    "fees_entries",
    "attendance",
    "tests",
    "online_tests",
    "test_attempts",
    "sync_queue"
  ];

  let idbInstance = null;
  let modules = null;

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

  async function idbGet(storeName, key) {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(String(key));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) { return null; }
  }

  async function idbSetBatch(storeName, entriesMap) {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        Object.entries(entriesMap).forEach(([k, v]) => {
          if (v === null) store.delete(String(k));
          else store.put(v, String(k));
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) { return false; }
  }

  async function idbGetAllMap(storeName) {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const map = {};
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            map[cursor.key] = cursor.value;
            cursor.continue();
          } else {
            resolve(map);
          }
        };
        req.onerror = () => resolve({});
      });
    } catch (e) { return {}; }
  }

  const AccuEngine = {
    init: function (config) {
      modules = config;
      console.log("⚡ [AccuEngine v4.0] Sentinel Active.");
    },

    // 🚀 BUMP VERSION (Jab bhi app mein koi data create/edit hoga yeh chalega)
    bumpSyncVersion: async function () {
      if (!navigator.onLine || !modules) return;
      try {
        const { db: rtdb, ref, set } = modules;
        const newVer = Date.now().toString();
        await set(ref(rtdb, "sync_triggers/version"), newVer);
        localStorage.setItem("accu_local_version", newVer);
        console.log("🚀 [AccuEngine] Data updated. New version published:", newVer);
      } catch (e) {
        console.warn("Version bump skipped:", e);
      }
    },

    // 🚀 MASTER SYNC & CHECK (Login aur App open par chalega)
    checkAndSyncData: async function (force = false) {
      if (!modules) return false;
      const { fsDb, db: rtdb, ref, get, child, getDocs, collection } = modules;

      let remoteVersion = null;
      const localVersion = localStorage.getItem("accu_local_version");

      // 1. RTDB se 10-byte ka version check karo
      if (navigator.onLine && rtdb) {
        try {
          const snap = await get(child(ref(rtdb), "sync_triggers/version"));
          if (snap.exists()) {
            remoteVersion = String(snap.val());
          }
        } catch (e) {
          console.warn("Could not check remote version:", e);
        }
      }

      const hasLocalData = Object.keys(await idbGetAllMap("students")).length > 0;

      // Agar data local memory mein hai aur version match hai -> NO DOWNLOAD!
      if (!force && hasLocalData && remoteVersion && remoteVersion === localVersion) {
        console.log("🎯 [AccuEngine] Zero Network Sync: Database has no changes. Loading from local memory!");
        return false; // No download needed
      }

      // 2. Naya data aaya hai ya first time login -> DOWNLOAD ALL ONCE
      console.log("📥 [AccuEngine] New updates detected or first load. Downloading fresh database from Firestore...");

      try {
        const [studentsSnap, teachersSnap, usersSnap, feesMatrixSnap] = await Promise.all([
          getDocs(collection(fsDb, "students")),
          getDocs(collection(fsDb, "teachers")),
          getDocs(collection(fsDb, "users")),
          getDocs(collection(fsDb, "fees_matrix"))
        ]);

        // Process Students
        const studentsMap = {};
        studentsSnap.forEach((d) => { studentsMap[d.id] = d.data(); });
        await idbSetBatch("students", studentsMap);

        // Process Teachers
        const teachersMap = {};
        teachersSnap.forEach((d) => { teachersMap[d.id] = d.data(); });
        await idbSetBatch("teachers", teachersMap);

        // Process Users
        const usersMap = {};
        usersSnap.forEach((d) => { usersMap[d.id] = d.data(); });
        await idbSetBatch("users", usersMap);

        // Process Fees Matrix
        const feesMap = {};
        feesMatrixSnap.forEach((d) => {
          const dt = d.data();
          feesMap[d.id] = dt.matrix || dt;
        });
        await idbSetBatch("fees_matrix", feesMap);

        // Save new version
        const finalVer = remoteVersion || Date.now().toString();
        localStorage.setItem("accu_local_version", finalVer);

        console.log(`🎉 [AccuEngine] Successfully downloaded: ${Object.keys(studentsMap).length} Students, ${Object.keys(teachersMap).length} Teachers.`);
        return true; // Fresh download completed
      } catch (err) {
        console.error("❌ [AccuEngine Sync Failed]:", err);
        return false;
      }
    },

    // 🚀 LOCAL FAST GETTER
    fetch: async function (path) {
      const parts = path.split("/");
      const root = parts[0];

      if (parts[1]) {
        return await idbGet(root, parts[1]);
      } else {
        return await idbGetAllMap(root);
      }
    },

    setLocal: async function (storeName, key, value) {
      const db = await openIDB();
      const tx = db.transaction(storeName, "readwrite");
      if (value === null) tx.objectStore(storeName).delete(String(key));
      else tx.objectStore(storeName).put(value, String(key));
    },

    invalidate: async function (storeName, key) {
      await this.setLocal(storeName, key, null);
    }
  };

  window.AccuEngine = AccuEngine;
})(window);
