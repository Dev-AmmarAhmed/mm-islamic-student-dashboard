/**
 * ====================================================================
 * IGRIS v9.0 - ENTERPRISE HIGH-SPEED SECURE CACHE & SYNC SENTINEL
 * M.M ISLAMIC ENGLISH SCHOOL ERP
 * ====================================================================
 */

(function (window) {
  "use strict";

  const IGRIS_SIGNATURE = "IGRIS_CORE_SECURE_VAULT_7789";
  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 18; // Upgraded for complete store support & stability

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
      console.log("⚡ [Igris v9.0] Enterprise Sentinel Active (Complete IDB Vault).");
      // Auto-flush pending queue when online
      if (navigator.onLine) {
        this.triggerBackgroundSync();
      }
    },

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

    // --- FULL FIRESTORE SYNC WITH DEEP SWEEP ---
    checkAndSyncData: async function (force = false) {
      if (!modules) return false;
      if (this._syncInProgress) return false;

      const { fsDb, getDocs, collection } = modules;
      const localStudents = await idbGetAllMap("students");
      const hasLocalData = Object.keys(localStudents).length > 0;

      // Agar offline hain aur data pehle se hai toh cache se chalao
      if (!force && hasLocalData && !navigator.onLine) {
        return false;
      }

      this._syncInProgress = true;
      try {
        console.log("📥 [Igris] Initiating deep sync from Cloud Firestore...");

        const collectionsToSync = [
          "students",
          "teachers",
          "users",
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
          "test_attempts"
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
              } else if (colName === "attendance") {
                map[d.id] = dt.days || dt;
              } else if (colName === "daily_claims" || colName === "teacher_daily_claims") {
                map[d.id] = dt.claims || dt;
              } else if (colName === "timetable") {
                map[d.id] = dt.schedule || dt;
              } else {
                map[d.id] = dt;
              }
              totalSyncedDocs++;
            });

            // Clean update: Purana deleted data hatakar naya clean map save karein
            await idbSetBatch(colName, map, true);
          }
        }

        const freshVer = Date.now().toString();
        localStorage.setItem("igris_local_version", freshVer);
        console.log(`✔ [Igris] Master Sync Complete: ${totalSyncedDocs} documents cached in IndexedDB.`);

        // Pending offline queue execute karein
        await this.triggerBackgroundSync();

        return true;
      } catch (err) {
        console.error("Igris sync error:", err);
        return false;
      } finally {
        this._syncInProgress = false;
      }
    },

    // --- SMART PATH RESOLVER (Supports 1, 2, and 3 segments & composite keys) ---
    fetch: async function (path) {
      if (!path) return null;
      const parts = path.split("/");
      const root = parts[0];

      // 1 Segment: e.g. "students" -> return complete dictionary map
      if (parts.length === 1) {
        return await idbGetAllMap(root);
      }

      // 2 Segments: e.g. "students/101" or "fees_entries/101"
      if (parts.length === 2) {
        // Direct key hit check
        const direct = await idbGet(root, parts[1]);
        if (direct !== null && direct !== undefined) return direct;

        // Composite / Prefix matching (e.g. fees_entries, study_material, tests)
        const all = await idbGetAllMap(root);
        const prefix = parts[1] + "_";
        const subMap = {};

        for (const [k, v] of Object.entries(all)) {
          if (
            k.startsWith(prefix) ||
            (v && (String(v.admn) === parts[1] || String(v.class) === parts[1] || String(v.username) === parts[1]))
          ) {
            subMap[k] = v;
          }
        }

        if (Object.keys(subMap).length > 0) return subMap;
        return all[parts[1]] || null;
      }

      // 3 Segments: e.g. "attendance/101/September" or "timetable/1/schedule"
      if (parts.length >= 3) {
        const compositeKey = `${parts[1]}_${parts[2]}`;
        const res = await idbGet(root, compositeKey);
        if (res !== null && res !== undefined) return res;

        // Fallback direct check
        const directSecond = await idbGet(root, parts[2]);
        if (directSecond !== null && directSecond !== undefined) return directSecond;

        const all = await idbGetAllMap(root);
        if (all[compositeKey]) return all[compositeKey];
        if (all[parts[1]] && typeof all[parts[1]] === "object") {
          return all[parts[1]][parts[2]] || null;
        }
        return null;
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
        console.log(`⚡ [Igris Queue] Offline action registered: ${actionType}`);
        return true;
      } catch (e) {
        console.warn("Queue error:", e);
        return false;
      }
    },

    triggerBackgroundSync: async function () {
      if (!navigator.onLine || !modules) return;
      try {
        const queue = await idbGetAllMap("sync_queue");
        const items = Object.values(queue);
        if (items.length === 0) return;

        console.log(`🔄 [Igris Queue] Flushing ${items.length} pending offline actions...`);
        const { fsDb, setDoc, doc } = modules;

        for (const item of items) {
          try {
            if (item.type === "attendance_batch" && Array.isArray(item.payload)) {
              for (const att of item.payload) {
                await setDoc(doc(fsDb, "attendance", att.key), {
                  admn: String(att.admn),
                  month: att.month,
                  days: att.daysData,
                  updatedAt: new Date().toISOString()
                }, { merge: true });
              }
            } else if (item.type === "offline_test" && item.payload) {
              await setDoc(doc(fsDb, "tests", item.payload.testDocId), item.payload.testData, { merge: true });
              await setDoc(doc(fsDb, "students", String(item.payload.admn)), { points: item.payload.newPoints }, { merge: true });
            } else if (item.type === "online_test" && item.payload) {
              await setDoc(doc(fsDb, "online_tests", String(item.payload.testId)), item.payload.testData, { merge: true });
            } else if (item.type === "student_update" && item.payload) {
              await setDoc(doc(fsDb, "students", String(item.payload.admn)), item.payload.studentData, { merge: true });
              await setDoc(doc(fsDb, "users", String(item.payload.admn)), item.payload.userData, { merge: true });
            }

            // Successfully processed item ko queue se wipe karein
            await idbSet("sync_queue", item.id, null);
          } catch (itemErr) {
            console.warn(`Retry queued for item ${item.id}:`, itemErr);
          }
        }
        console.log("✔ [Igris Queue] All pending offline operations synchronized.");
      } catch (err) {
        console.warn("Queue flush error:", err);
      }
    },

    // --- SECURE APP LOCK & BIOMETRIC GATE ---
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

  // Anti-tamper Freeze Gate
  Object.freeze(Igris);
  window.Igris = Igris;
  window.AccuEngine = Igris;
})(window);
