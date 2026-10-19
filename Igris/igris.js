/**
 * ====================================================================
 * IGRIS v10.0 - ENTERPRISE REALTIME SYNC & LOCAL CACHE SENTINEL
 * M.M ISLAMIC ENGLISH SCHOOL ERP
 * ====================================================================
 */

(function (window) {
  "use strict";

  const IGRIS_SIGNATURE = "IGRIS_CORE_SECURE_VAULT_7789";
  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 20; // Upgraded for user_muster & cross-device realtime pipe

  const STORES = [
    "users",
    "user_muster", // Added for new sub-collection cache
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
    "teacher_leave_applications",
    "subjects",
    "syllabus_config",
    "syllabus_chapters",
    "syllabus_progress",
    "muster",
    "expenses",
    "daily_claims",
    "teacher_daily_claims",
    "teacher_permissions",
    "teacher_points_logs",
    "email_lookup",
    "tests",
    "online_tests",
    "test_attempts",
    "sync_queue",
    "secure_keys"
  ];

  let idbInstance = null;
  let modules = null;
  let rtdbListenerAttached = false;

  // --- SAFE IDB OPEN WITH MIGRATION ---
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

  // --- NATIVE DIRECT IDB GET ---
  async function idbGet(storeName, key) {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(storeName)) return resolve(null);
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(String(key));
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
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
        if (!db.objectStoreNames.contains(storeName)) return resolve(false);
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

  // --- CLEAR A STORE ---
  async function idbClear(storeName) {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(storeName)) return resolve(false);
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  // --- BATCH SET (Atomic IDB Injection) ---
  async function idbSetBatch(storeName, entriesMap, clearFirst = false) {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(storeName)) return resolve(false);
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);

        if (clearFirst) {
          store.clear();
        }

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
        if (!db.objectStoreNames.contains(storeName)) return resolve({});
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

  // ==========================================
  // IGRIS CORE INSTANCE
  // ==========================================
  const Igris = {
    isAlive: true,
    signature: IGRIS_SIGNATURE,
    _syncInProgress: false,

    init: function (config) {
      modules = config;
      console.log("⚡ [Igris v10.0] Realtime Sync Engine Initialized.");

      // 1. Flush offline queue if connected
      if (navigator.onLine) {
        this.triggerBackgroundSync();
      }

      // 2. Attach Cross-Device Realtime Listener
      this.attachCrossDeviceLiveListener();
    },

    // 📡 Global Version Broadcaster (Bumps when any device writes)
    bumpSyncVersion: async function () {
      if (!navigator.onLine || !modules) return;
      try {
        const { db: rtdb, ref, set } = modules;
        if (typeof set !== "function") return;
        const newVer = Date.now().toString();
        localStorage.setItem("igris_local_version", newVer);
        await set(ref(rtdb, "sync_triggers/version"), newVer);
      } catch (e) {}
    },

    // 🛰️ Cross-Device Realtime Sentinel (Detects updates from other devices)
    attachCrossDeviceLiveListener: function () {
      if (rtdbListenerAttached || !modules) return;
      const { db: rtdb, ref, onValue } = modules;
      if (!rtdb || typeof onValue !== "function") return;

      rtdbListenerAttached = true;
      let isInitialListenerLoad = true;

      onValue(ref(rtdb, "sync_triggers/version"), async (snap) => {
        const cloudVersion = snap.val();
        if (!cloudVersion) return;

        const localVersion = localStorage.getItem("igris_local_version");

        if (isInitialListenerLoad) {
          isInitialListenerLoad = false;
          if (!localVersion) localStorage.setItem("igris_local_version", String(cloudVersion));
          return;
        }

        // Agar cloud par naya version aaya hai jo is device ka nahi hai:
        if (String(cloudVersion) !== String(localVersion)) {
          console.log(`🔔 [Igris Remote Sync] New update detected from another device (${cloudVersion}). Pulling...`);
          localStorage.setItem("igris_local_version", String(cloudVersion));
          
          const didSync = await Igris.checkAndSyncData(true);
          if (didSync) {
            // Screen ko bina refresh kiye naye data ke sath render karein
            const currentRole = localStorage.getItem("loggedRole");
            if (currentRole && typeof window.hydrateRoleDashboard === "function") {
              await window.hydrateRoleDashboard(currentRole, false);
            }
          }
        }
      });
    },

    // --- FULL FIRESTORE SYNC WITH SUB-COLLECTION MUSTER ---
    checkAndSyncData: async function (force = false) {
      if (!modules) return false;
      if (this._syncInProgress) return false;

      const { fsDb, getDocs, collection } = modules;
      this._syncInProgress = true;

      try {
        console.log("📥 [Igris] Running live sync sweep from Cloud Firestore...");

        const collectionsToSync = [
          "users",
          "fees_matrix",
          "fees_entries",
          "subjects",
          "syllabus_config",
          "syllabus_chapters",
          "syllabus_progress",
          "expenses",
          "leaves",
          "daily_claims",
          "teacher_daily_claims",
          "teacher_permissions",
          "teacher_points_logs",
          "study_material",
          "homework",
          "timetable",
          "tests"
        ];

        const results = await Promise.allSettled(
          collectionsToSync.map((colName) => getDocs(collection(fsDb, colName)))
        );

        let totalSyncedDocs = 0;

        for (let i = 0; i < collectionsToSync.length; i++) {
          const colName = collectionsToSync[i];
          const res = results[i];

          if (res.status === "fulfilled" && res.value) {
            const map = {};
            res.value.forEach((d) => {
              const dt = d.data();
              if (colName === "fees_matrix") {
                map[d.id] = dt.matrix || dt;
              } else if (colName === "daily_claims" || colName === "teacher_daily_claims") {
                map[d.id] = dt.claims || dt;
              } else if (colName === "timetable") {
                map[d.id] = dt.schedule || dt;
              } else {
                map[d.id] = dt;
              }
              totalSyncedDocs++;
            });

            await idbSetBatch(colName, map, true);

            // Memory store MM_STORE ko bhi update karein
            if (window.MM_STORE && colName in window.MM_STORE) {
              window.MM_STORE[colName] = map;
            }
          }
        }

        // Sub-collection muster sync for current active month
        const now = new Date();
        const activeMonth = now.toISOString().slice(0, 7);
        const usersMap = await idbGetAllMap("users");
        const musterStoreMap = {};

        for (const uid of Object.keys(usersMap)) {
          try {
            const mSnap = await getDocs(collection(fsDb, "users", uid, "muster"));
            mSnap.forEach((mDoc) => {
              musterStoreMap[`${uid}_${mDoc.id}`] = mDoc.data();
            });
          } catch (e) {}
        }

        if (Object.keys(musterStoreMap).length > 0) {
          await idbSetBatch("user_muster", musterStoreMap, false);
        }

        console.log(`✔ [Igris] Sync Finished: ${totalSyncedDocs} core docs and muster records updated locally.`);
        await this.triggerBackgroundSync();
        return true;
      } catch (err) {
        console.error("Igris sync error:", err);
        return false;
      } finally {
        this._syncInProgress = false;
      }
    },

    // --- SMART PATH RESOLVER ---
    fetch: async function (path) {
      if (!path) return null;
      const parts = path.split("/");
      const root = parts[0];

      // 1 Segment: e.g. "users" -> complete map
      if (parts.length === 1) {
        return await idbGetAllMap(root);
      }

      // 2 Segments: e.g. "users/101" or "fees_entries/101"
      if (parts.length === 2) {
        const direct = await idbGet(root, parts[1]);
        if (direct !== null && direct !== undefined) return direct;

        const all = await idbGetAllMap(root);
        const prefix = parts[1] + "_";
        const subMap = {};

        for (const [k, v] of Object.entries(all)) {
          if (
            k.startsWith(prefix) ||
            (v && (String(v.admn) === parts[1] || String(v.userId) === parts[1] || String(v.class) === parts[1] || String(v.username) === parts[1]))
          ) {
            subMap[k] = v;
          }
        }

        if (Object.keys(subMap).length > 0) return subMap;
        return all[parts[1]] || null;
      }

      // 3 Segments: e.g. "users/101/muster" or "muster/2026-10"
      if (parts.length >= 3) {
        if (parts[2] === "muster" || root === "muster") {
          const compKey = `${parts[1]}_${parts[2]}`;
          const res = await idbGet("user_muster", compKey);
          if (res) return res;
        }

        const compositeKey = `${parts[1]}_${parts[2]}`;
        const res = await idbGet(root, compositeKey);
        if (res !== null && res !== undefined) return res;

        const directSecond = await idbGet(root, parts[2]);
        if (directSecond !== null && directSecond !== undefined) return directSecond;

        const all = await idbGetAllMap(root);
        return all[compositeKey] || (all[parts[1]] && all[parts[1]][parts[2]]) || null;
      }

      return null;
    },

    // --- LOCAL MUTATIONS ---
    setLocal: async function (storeName, key, value) {
      if (arguments.length === 2 && typeof key === "object") {
        await idbSetBatch(storeName, key, false);
      } else {
        await idbSet(storeName, key, value);
      }
    },

    invalidate: async function (storeName, key) {
      await idbSet(storeName, key, null);
    },

    clearStore: async function (storeName) {
      await idbClear(storeName);
    },

    // --- OFFLINE QUEUE & AUTO-FLUSH ENGINE ---
    queueOfflineAction: async function (actionType, payload) {
      try {
        const actionId = `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const actionItem = {
          id: actionId,
          type: actionType,
          payload: payload,
          timestamp: Date.now()
        };
        await idbSet("sync_queue", actionId, actionItem);
        return true;
      } catch (e) {
        return false;
      }
    },

    triggerBackgroundSync: async function () {
      if (!navigator.onLine || !modules) return;
      try {
        const queue = await idbGetAllMap("sync_queue");
        const items = Object.values(queue);
        if (items.length === 0) return;

        const { fsDb, setDoc, doc } = modules;

        for (const item of items) {
          try {
            if (item.type === "attendance_batch" && Array.isArray(item.payload)) {
              for (const att of item.payload) {
                await setDoc(doc(fsDb, "users", String(att.admn), "muster", att.month), {
                  userId: String(att.admn),
                  month: att.month,
                  Days: att.daysData,
                  updatedAt: new Date().toISOString()
                }, { merge: true });
              }
            }
            await idbSet("sync_queue", item.id, null);
          } catch (itemErr) {
            console.warn(`Retry queued for ${item.id}:`, itemErr);
          }
        }
      } catch (err) {}
    },

    // --- SECURE APP LOCK ---
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
