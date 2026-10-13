/**
 * AccuEngine v1.0 - Production Safe Cache & Firestore Engine (Offline Outbox Enabled)
 * MM Islamic English School ERP
 */

(function (window) {
  "use strict";

  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 2; // Incremented for sync_queue store
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
    "daily_claims",
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

  async function idbSet(storeName, key, value) {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(value, String(key));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) { return false; }
  }

  const AccuEngine = {
    init: function (config) {
      modules = config;
      console.log("[AccuEngine] Engine Online (Offline Outbox Ready).");
      window.addEventListener("online", () => this.processSyncQueue());
      if (navigator.onLine) {
        setTimeout(() => this.processSyncQueue(), 2000);
      }
    },

    // 1. Data Fetcher (IndexedDB First -> Firestore -> RTDB Fallback)
    fetch: async function (path) {
      if (!path || !modules) return null;
      const parts = path.split("/");
      const root = parts[0];
      const { fsDb, db, doc, getDoc, collection, getDocs, ref, get, child } = modules;

      if (root === "students") {
        if (parts[1]) {
          const admn = parts[1];
          const cached = await idbGet("students", admn);
          if (cached) return cached;
          if (fsDb && getDoc && doc) {
            const snap = await getDoc(doc(fsDb, "students", String(admn))).catch(() => null);
            if (snap && snap.exists()) {
              const data = snap.data();
              await idbSet("students", admn, data);
              return data;
            }
          }
        } else if (fsDb && getDocs && collection) {
          const snap = await getDocs(collection(fsDb, "students")).catch(() => null);
          if (snap && !snap.empty) {
            const allS = {};
            snap.forEach((d) => {
              allS[d.id] = d.data();
              idbSet("students", d.id, d.data());
            });
            return allS;
          }
        }
      }

      if (root === "teachers") {
        if (parts[1]) {
          const user = parts[1];
          const cached = await idbGet("teachers", user);
          if (cached) return cached;
          if (fsDb && getDoc && doc) {
            const snap = await getDoc(doc(fsDb, "teachers", String(user))).catch(() => null);
            if (snap && snap.exists()) {
              const data = snap.data();
              await idbSet("teachers", user, data);
              return data;
            }
          }
        } else if (fsDb && getDocs && collection) {
          const snap = await getDocs(collection(fsDb, "teachers")).catch(() => null);
          if (snap && !snap.empty) {
            const allT = {};
            snap.forEach((d) => {
              allT[d.id] = d.data();
              idbSet("teachers", d.id, d.data());
            });
            return allT;
          }
        }
      }

      if (root === "daily_claims" && parts[1]) {
        const admn = parts[1];
        if (fsDb && getDoc && doc) {
          const snap = await getDoc(doc(fsDb, "daily_claims", String(admn))).catch(() => null);
          if (snap && snap.exists()) return snap.data().claims || snap.data();
        }
        if (db && ref && get && child) {
          const snap = await get(child(ref(db), path)).catch(() => null);
          if (snap && snap.exists()) return snap.val();
        }
        return {};
      }

      if (root === "teacher_daily_claims" && parts[1]) {
        if (db && ref && get && child) {
          const snap = await get(child(ref(db), path)).catch(() => null);
          if (snap && snap.exists()) return snap.val();
        }
        return {};
      }

      if (root === "users" && parts[1]) {
        const uid = parts[1];
        const cached = await idbGet("users", uid);
        if (cached) return cached;
        if (fsDb && getDoc && doc) {
          const snap = await getDoc(doc(fsDb, "users", String(uid))).catch(() => null);
          if (snap && snap.exists()) {
            const data = snap.data();
            await idbSet("users", uid, data);
            return data;
          }
        }
      }

      if (root === "fees_matrix") {
        if (parts[1]) {
          const admn = parts[1];
          const cached = await idbGet("fees_matrix", admn);
          if (cached) return cached;
          if (fsDb && getDoc && doc) {
            const snap = await getDoc(doc(fsDb, "fees_matrix", String(admn))).catch(() => null);
            if (snap && snap.exists()) {
              const res = snap.data().matrix || snap.data();
              await idbSet("fees_matrix", admn, res);
              return res;
            }
          }
        } else if (fsDb && getDocs && collection) {
          const snap = await getDocs(collection(fsDb, "fees_matrix")).catch(() => null);
          if (snap && !snap.empty) {
            const allMatrix = {};
            snap.forEach((d) => {
              allMatrix[d.id] = d.data().matrix || d.data();
              idbSet("fees_matrix", d.id, allMatrix[d.id]);
            });
            return allMatrix;
          }
        }
      }

      if (root === "attendance") {
        if (parts[1] && parts[2]) {
          const admn = parts[1];
          const month = parts[2];
          const key = `${admn}_${month}`;
          const cached = await idbGet("attendance", key);
          if (cached) return cached;
          if (fsDb && getDoc && doc) {
            const snap = await getDoc(doc(fsDb, "attendance", key)).catch(() => null);
            if (snap && snap.exists()) {
              const res = snap.data().days || snap.data();
              await idbSet("attendance", key, res);
              return res;
            }
          }
        } else if (!parts[1] && fsDb && getDocs && collection) {
          const snap = await getDocs(collection(fsDb, "attendance")).catch(() => null);
          if (snap && !snap.empty) {
            const fullAtt = {};
            snap.forEach((d) => {
              const docData = d.data();
              const admn = docData.admn || d.id.split("_")[0];
              const month = docData.month || d.id.split("_")[1];
              if (!fullAtt[admn]) fullAtt[admn] = {};
              fullAtt[admn][month] = docData.days || docData;
            });
            return fullAtt;
          }
        }
      }

      if (root === "tests" && parts[1]) {
        const admn = parts[1];
        const cached = await idbGet("tests", admn);
        if (cached) return cached;
        if (fsDb && getDocs && collection) {
          const snap = await getDocs(collection(fsDb, "tests")).catch(() => null);
          if (!snap.empty) {
            const testsObj = {};
            snap.forEach((d) => {
              const data = d.data();
              if (String(data.admn) === String(admn)) {
                testsObj[data.testId || d.id] = data;
              }
            });
            if (Object.keys(testsObj).length > 0) {
              await idbSet("tests", admn, testsObj);
              return testsObj;
            }
          }
        }
      }

      if (root === "fees_entries") {
        if (parts[1]) {
          const admn = parts[1];
          const cached = await idbGet("fees_entries", admn);
          if (cached) return cached;
          if (fsDb && getDocs && collection) {
            const snap = await getDocs(collection(fsDb, "fees_entries")).catch(() => null);
            if (!snap.empty) {
              const entriesObj = {};
              snap.forEach((d) => {
                const data = d.data();
                if (String(data.admn) === String(admn)) {
                  entriesObj[data.entryId || d.id] = data;
                }
              });
              if (Object.keys(entriesObj).length > 0) {
                await idbSet("fees_entries", admn, entriesObj);
                return entriesObj;
              }
            }
          }
        }
      }

      // RTDB Fallback for small configs (Timetable, Subjects)
      if (db && ref && get && child) {
        try {
          const snap = await get(child(ref(db), path));
          return snap.exists() ? snap.val() : null;
        } catch (e) { return null; }
      }

      return null;
    },

    // 2. Local Storage Direct Set/Invalidate Helpers
    setLocal: async function (storeName, key, value) {
      await idbSet(storeName, key, value);
    },

    invalidate: async function (storeName, key) {
      await idbSet(storeName, key, null);
    },

    // 3. Offline Action Queue (Agar net na ho toh yahan save hoga)
    queueOfflineAction: async function (actionType, payload) {
      const db = await openIDB();
      const item = {
        id: Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        actionType: actionType,
        payload: payload,
        timestamp: Date.now()
      };
      return new Promise((resolve) => {
        const tx = db.transaction("sync_queue", "readwrite");
        tx.objectStore("sync_queue").put(item, item.id);
        tx.oncomplete = () => {
          console.log("[AccuEngine] Queued offline action:", actionType);
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      });
    },

    // 4. Background Sync Processor (Internet aate hi Firestore push karega)
    processSyncQueue: async function () {
      if (!navigator.onLine || !modules) return;
      const db = await openIDB();
      const items = await new Promise((resolve) => {
        const tx = db.transaction("sync_queue", "readonly");
        const req = tx.objectStore("sync_queue").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      if (items.length === 0) return;
      console.log(`[AccuEngine] Processing ${items.length} queued offline actions...`);

      const { fsDb, doc, setDoc } = modules;
      for (const item of items) {
        try {
          if (item.actionType === "attendance_batch") {
            for (const attItem of item.payload) {
              await setDoc(doc(fsDb, "attendance", attItem.key), {
                admn: String(attItem.admn),
                month: attItem.month,
                days: attItem.daysData,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            }
          } else if (item.actionType === "fee_entry") {
            const { entryDocId, entryData, matrixDocId, matrixData } = item.payload;
            await setDoc(doc(fsDb, "fees_entries", entryDocId), entryData, { merge: true });
            await setDoc(doc(fsDb, "fees_matrix", matrixDocId), matrixData, { merge: true });
          }

          // Successfully pushed, remove from sync queue
          const delTx = db.transaction("sync_queue", "readwrite");
          delTx.objectStore("sync_queue").delete(item.id);
        } catch (err) {
          console.warn("[AccuEngine] Sync failed for item:", item.id, err);
          break; // Net unstable ho toh wait karega
        }
      }
      console.log("[AccuEngine] Offline queue sync completed.");
    }
  };

  window.AccuEngine = AccuEngine;
})(window);
