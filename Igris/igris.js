/**
 * ====================================================================
 * IGRIS v8.0 - DIRECT HIGH-SPEED ENGINE (ZERO-OVERHEAD NATIVE IDB)
 * M.M ISLAMIC ENGLISH SCHOOL ERP
 * ====================================================================
 */

(function (window) {
  "use strict";

  const IGRIS_SIGNATURE = "IGRIS_CORE_SECURE_VAULT_7789";
   const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 16; // Upgraded for complete store support
  const STORES = [
    "users",
    "students",
    "teachers",
    "fees_matrix",
    "fees_entries",
    "attendance",
    "study_material",
    "homework",
    "timetable",
    "leaves",
    "leave_applications",
    "subjects",
    "syllabus_config",
    "syllabus_chapters",
    "syllabus_progress",
    "muster",
    "expenses",
    "daily_claims",
    "teacher_daily_claims",
    "email_lookup",
    "tests",
    "online_tests",
    "test_attempts",
    "sync_queue",
    "secure_keys"
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
          if (db.objectStoreNames.contains(store)) {
            db.deleteObjectStore(store); // Purana corrupt encrypted data saaf
          }
          db.createObjectStore(store);
        });
      };
      request.onsuccess = (e) => {
        idbInstance = e.target.result;
        resolve(idbInstance);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // --- NATIVE DIRECT IDB GET ---
  async function idbGet(storeName, key) {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(String(key));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  // --- NATIVE DIRECT IDB SET ---
  async function idbSet(storeName, key, value) {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        if (value === null || value === undefined) {
          store.delete(String(key));
        } else {
          store.put(value, String(key));
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  // --- BATCH SET (Direct memory injection) ---
  async function idbSetBatch(storeName, entriesMap) {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        for (const [k, v] of Object.entries(entriesMap)) {
          if (v === null || v === undefined) {
            store.delete(String(k));
          } else {
            store.put(v, String(k));
          }
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  // --- DIRECT GET ALL MAP ---
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
    } catch (e) {
      return {};
    }
  }

  const Igris = {
    isAlive: true,
    signature: IGRIS_SIGNATURE,

    init: function (config) {
      modules = config;
      console.log("⚡ [Igris v8.0] Direct Native IndexedDB Active (Zero Encryption Lag).");
    },

    _syncInProgress: false,

    bumpSyncVersion: async function () {
      if (!navigator.onLine || !modules) return;
      try {
        const { db: rtdb, ref, set } = modules;
        if (typeof set !== "function") return;
        const newVer = Date.now().toString();
        await set(ref(rtdb, "sync_triggers/version"), newVer);
        localStorage.setItem("igris_local_version", newVer);
      } catch (e) {}
    },


      checkAndSyncData: async function (force = false) {
    if (!modules) return false;
    if (this._syncInProgress) return false;

    const { fsDb, getDocs, collection } = modules;
    const localStudents = await idbGetAllMap("students");
    const hasLocalData = Object.keys(localStudents).length > 0;

    if (!force && hasLocalData && !navigator.onLine) {
      return false;
    }

    this._syncInProgress = true;
    try {
      console.log("📥 [Igris] Fetching fresh data directly from Firestore...");

      const collectionsToSync = [
        "students", "teachers", "users", "fees_matrix", "fees_entries",
        "attendance", "study_material", "homework", "timetable", "leaves",
        "leave_applications", "subjects", "syllabus_config", "syllabus_chapters",
        "syllabus_progress", "muster", "expenses", "daily_claims",
        "teacher_daily_claims", "email_lookup", "tests", "online_tests", "test_attempts"
      ];

      const results = await Promise.allSettled(
        collectionsToSync.map(colName => getDocs(collection(fsDb, colName)))
      );

      for (let i = 0; i < collectionsToSync.length; i++) {
        const colName = collectionsToSync[i];
        const res = results[i];

        if (res.status === "fulfilled" && res.value) {
          const map = {};
          res.value.forEach(d => {
            const dt = d.data();
            if (colName === "fees_matrix") {
              map[d.id] = dt.matrix || dt;
            } else if (colName === "attendance") {
              map[d.id] = dt.days || dt;
            } else if (colName === "daily_claims" || colName === "teacher_daily_claims") {
              map[d.id] = dt.claims || dt;
            } else if (colName === "timetable") {
              map[d.id] = dt.schedule || dt;
            } else {
              map[d.id] = dt;
            }
          });

          if (Object.keys(map).length > 0) {
            await idbSetBatch(colName, map);
          }
        }
      }

      const freshVer = Date.now().toString();
      localStorage.setItem("igris_local_version", freshVer);
      console.log("✔ [Igris] All available Firestore collections synced successfully.");
      return true;
    } catch (err) {
      console.error("Igris sync error:", err);
      return false;
    } finally {
      this._syncInProgress = false;
    }
  },


    fetch: async function (path) {
      if (!path) return null;
      const parts = path.split("/");
      const root = parts[0];

      if (parts.length === 1) {
        return await idbGetAllMap(root);
      } else if (parts.length === 2) {
        return await idbGet(root, parts[1]);
      } else {
        const docKey = parts.slice(1).join("_");
        const res = await idbGet(root, docKey);
        if (res !== null && res !== undefined) return res;
        const all = await idbGetAllMap(root);
        return all[parts[1]] || null;
      }
    },

    setLocal: async function (storeName, key, value) {
      if (arguments.length === 2) {
        await idbSetBatch(storeName, key);
      } else {
        await idbSet(storeName, key, value);
      }
    },

    invalidate: async function (storeName, key) {
      await idbSet(storeName, key, null);
    },

    setAppLock: async function (userId, pin, enableBiometrics) {
      if (!userId || !pin || pin.length !== 4) return false;
      const lockConfig = {
        enabled: true,
        userId: String(userId),
        pin: pin,
        biometricEnabled: !!enableBiometrics,
        updatedAt: Date.now()
      };
      await idbSet("secure_keys", `app_lock_${userId}`, lockConfig);
      localStorage.setItem(`lock_active_${userId}`, "true");
      return true;
    },

    getAppLockConfig: async function (userId) {
      if (!userId) return null;
      return await idbGet("secure_keys", `app_lock_${userId}`);
    },

    verifyPin: async function (userId, enteredPin) {
      const cfg = await this.getAppLockConfig(userId);
      if (!cfg || !cfg.enabled) return false;
      return String(cfg.pin) === String(enteredPin);
    },

    promptBiometrics: async function (userId) {
      if (!window.PublicKeyCredential) {
        throw new Error("Biometrics not supported on this device.");
      }
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      return await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: "required"
        }
      });
    }
  };

  Object.freeze(Igris);
  window.Igris = Igris;
  window.AccuEngine = Igris;
})(window);
