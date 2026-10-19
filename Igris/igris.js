/**
 * ====================================================================
 * IGRIS v11.0 - UNIFIED USER SUB-COLLECTIONS & LOCAL CACHE SENTINEL
 * M.M ISLAMIC ENGLISH SCHOOL ERP
 * ====================================================================
 */

(function (window) {
  "use strict";

  const IGRIS_SIGNATURE = "IGRIS_CORE_SECURE_VAULT_8890";
  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 25; // Upgraded for unified users & nested sub-collection vaults

  // Stores optimized for Unified Root Users + Specific Sub-Collection Caches
  const STORES = [
    "users",                  // Root User profile docs (Admin, Teacher, Student)
    "user_muster",           // Composite: {userId}_{YYYY-MM}
    "user_leaves",           // Composite: {userId}_{leaveId}
    "user_tests",            // Composite: {userId}_{testId}
    "user_fees_matrix",      // Composite: {userId}_current
    "user_fees_entries",     // Composite: {userId}_{entryId}
    "user_daily_claims",     // Composite: {userId}_{todayKey}
    "user_syllabus_progress",// Composite: {userId}_{subject}
    "subjects",              // Root Collection
    "syllabus_config",       // Root Collection
    "syllabus_chapters",     // Root Collection
    "study_material",        // Root Collection
    "homework",              // Root Collection
    "timetable",             // Root Collection
    "expenses",              // Root Collection
    "teacher_points_logs",   // Root Collection
    "teacher_permissions",   // Root Collection
    "student_permissions",   // Root Collection
    "sync_queue",            // Offline Operations Queue
    "secure_keys"            // App Lock & Biometric Vault
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

  // --- SUB-COLLECTION TO IDB STORE MAPPER ---
  function getSubCollectionStoreName(subCol) {
    switch (subCol) {
      case "muster": return "user_muster";
      case "leaves": return "user_leaves";
      case "tests": return "user_tests";
      case "fees_matrix": return "user_fees_matrix";
      case "fees_entries": return "user_fees_entries";
      case "daily_claims": return "user_daily_claims";
      case "syllabus_progress": return "user_syllabus_progress";
      default: return `user_${subCol}`;
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
      console.log("⚡ [Igris v11.0] Unified Architecture Sentinel Online.");

      // 1. Flush offline queue if connected
      if (navigator.onLine) {
        this.triggerBackgroundSync();
      }

      // 2. Attach Cross-Device Realtime Sentinel
      this.attachCrossDeviceLiveListener();
    },

    // 📡 Global Version Broadcaster (Bumps when any device writes)
    bumpSyncVersion: async function () {
      if (!navigator.onLine || !modules) return;
      try {
        const { db: rtdb, ref, set } = modules;
        if (typeof set !== "function" || !rtdb) return;
        const newVer = Date.now().toString();
        localStorage.setItem("igris_local_version", newVer);
        await set(ref(rtdb, "sync_triggers/version"), newVer);
      } catch (e) {}
    },

    // 🛰️ Cross-Device Realtime Listener
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

        if (String(cloudVersion) !== String(localVersion)) {
          console.log(`🔔 [Igris Remote Sync] New cloud version detected (${cloudVersion}). Pulling...`);
          localStorage.setItem("igris_local_version", String(cloudVersion));
          
          const didSync = await Igris.checkAndSyncData(true);
          if (didSync) {
            const currentRole = localStorage.getItem("loggedRole");
            if (currentRole && typeof window.hydrateRoleDashboard === "function") {
              await window.hydrateRoleDashboard(currentRole, false);
            }
          }
        }
      });
    },

    // --- FULL FIRESTORE SYNC (USERS & SUB-COLLECTIONS) ---
    checkAndSyncData: async function (force = false) {
      if (!modules) return false;
      if (this._syncInProgress) return false;

      const { fsDb, getDocs, collection } = modules;
      this._syncInProgress = true;

      try {
        console.log("📥 [Igris] Running live sync sweep for Unified Architecture...");

        // 1. Sync Root Shared Collections
        const rootCollections = [
          "users",
          "subjects",
          "syllabus_config",
          "syllabus_chapters",
          "expenses",
          "teacher_points_logs",
          "teacher_permissions",
          "student_permissions",
          "study_material",
          "homework",
          "timetable"
        ];

        const results = await Promise.allSettled(
          rootCollections.map((colName) => getDocs(collection(fsDb, colName)))
        );

        let totalSyncedDocs = 0;
        const usersMap = {};

        for (let i = 0; i < rootCollections.length; i++) {
          const colName = rootCollections[i];
          const res = results[i];

          if (res.status === "fulfilled" && res.value) {
            const map = {};
            res.value.forEach((d) => {
              const dt = d.data();
              if (colName === "users") {
                const norm = window.normalizeUserData ? window.normalizeUserData(dt, d.id) : dt;
                map[d.id] = norm;
                usersMap[d.id] = norm;
              } else if (colName === "timetable") {
                map[d.id] = dt.schedule || dt;
              } else {
                map[d.id] = dt;
              }
              totalSyncedDocs++;
            });

            await idbSetBatch(colName, map, true);

            if (window.MM_STORE && colName in window.MM_STORE) {
              window.MM_STORE[colName] = map;
            }
          }
        }

        // 2. Active User Sub-collection Sync (Logged User / Selected Role Context)
        const loggedUser = localStorage.getItem("loggedUser");
        const loggedRole = localStorage.getItem("loggedRole");
        const currentStudentAdmn = localStorage.getItem("studentAdmn");

        const targetUserIds = new Set();
        if (loggedUser) targetUserIds.add(String(loggedUser));
        if (currentStudentAdmn) targetUserIds.add(String(currentStudentAdmn));

        // If admin is syncing, sweep all users' active month muster & active leaves
        if (loggedRole === "admin") {
          Object.keys(usersMap).forEach(uid => targetUserIds.add(uid));
        }

        const subCols = ["muster", "fees_matrix", "fees_entries", "leaves", "tests", "daily_claims", "syllabus_progress"];
        const nowMonth = new Date().toISOString().slice(0, 7);

        for (const uid of targetUserIds) {
          for (const sub of subCols) {
            try {
              const storeName = getSubCollectionStoreName(sub);
              const subSnap = await getDocs(collection(fsDb, "users", uid, sub));
              const subBatch = {};
              subSnap.forEach(d => {
                const compKey = `${uid}_${d.id}`;
                subBatch[compKey] = d.data();
              });
              if (Object.keys(subBatch).length > 0) {
                await idbSetBatch(storeName, subBatch, false);
              }
            } catch (subErr) {}
          }
        }

        console.log(`✔ [Igris v11.0] Sweep complete: ${totalSyncedDocs} root documents & user vaults synchronized.`);
        await this.triggerBackgroundSync();
        return true;
      } catch (err) {
        console.error("Igris sync error:", err);
        return false;
      } finally {
        this._syncInProgress = false;
      }
    },

    // --- SMART PATH RESOLVER (SUPPORTS 1, 2, 3, AND 4 SEGMENT PATHS) ---
    fetch: async function (path) {
      if (!path) return null;
      const parts = path.split("/").map(p => p.trim()).filter(Boolean);
      const root = parts[0];

      // Segment 1: e.g. "users" -> returns entire users map
      if (parts.length === 1) {
        return await idbGetAllMap(root);
      }

      // Segment 2: e.g. "users/101" or "timetable/1"
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

      // Segment 3: e.g. "users/101/muster" or "users/101/leaves"
      if (parts.length === 3) {
        const [rootCol, uid, subCol] = parts;
        if (rootCol === "users") {
          const storeName = getSubCollectionStoreName(subCol);
          const allSubDocs = await idbGetAllMap(storeName);
          const prefix = `${uid}_`;
          const result = {};

          for (const [k, v] of Object.entries(allSubDocs)) {
            if (k.startsWith(prefix)) {
              const docId = k.replace(prefix, "");
              result[docId] = v;
            }
          }
          return Object.keys(result).length > 0 ? result : null;
        }

        // Generic composite fallback for 3-part custom path
        const compKey = `${parts[1]}_${parts[2]}`;
        const res = await idbGet(root, compKey);
        if (res !== null && res !== undefined) return res;
        return null;
      }

      // Segment 4: e.g. "users/101/muster/2026-10" or "users/101/fees_matrix/current"
      if (parts.length === 4) {
        const [rootCol, uid, subCol, subDocId] = parts;
        if (rootCol === "users") {
          const storeName = getSubCollectionStoreName(subCol);
          const compKey = `${uid}_${subDocId}`;
          const res = await idbGet(storeName, compKey);
          if (res !== null && res !== undefined) return res;
        }

        const compKey = `${parts[1]}_${parts[3]}`;
        const res = await idbGet(root, compKey);
        if (res !== null && res !== undefined) return res;
        return null;
      }

      return null;
    },

    // --- LOCAL MUTATIONS ---
    setLocal: async function (storeName, key, value) {
      let resolvedStore = storeName;

      // Map dynamic sub-collection prefixes from safeDataFetch/MasterUserEngine
      if (storeName.startsWith("users_")) {
        const parts = storeName.split("_");
        const subCol = parts[parts.length - 1];
        resolvedStore = getSubCollectionStoreName(subCol);
        const uid = parts[1];
        key = `${uid}_${key}`;
      }

      if (arguments.length === 2 && typeof key === "object" && key !== null) {
        await idbSetBatch(resolvedStore, key, false);
      } else {
        await idbSet(resolvedStore, key, value);
      }
    },

    invalidate: async function (storeName, key) {
      let resolvedStore = storeName;
      if (storeName.startsWith("users_")) {
        const parts = storeName.split("_");
        const subCol = parts[parts.length - 1];
        resolvedStore = getSubCollectionStoreName(subCol);
        const uid = parts[1];
        key = `${uid}_${key}`;
      }
      await idbSet(resolvedStore, key, null);
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

    // --- SECURE APP LOCK & BIOMETRICS ---
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
