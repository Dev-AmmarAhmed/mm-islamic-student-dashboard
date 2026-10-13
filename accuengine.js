/**
 * AccuEngine v3.6 - Production Grade Unified Router
 * MM Islamic English School ERP
 * Fully Fixed: Attendance Multi-Month Parsing, Zero-Freeze IndexedDB
 */

(function (window) {
  "use strict";

  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 7; // Bumped version for clean attendance store upgrade
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
    "student_test_attempts",
    "daily_claims",
    "sync_queue",
    "subjects",
    "timetable",
    "study_material",
    "homework",
    "syllabus"
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
        idbInstance.onversionchange = () => {
          idbInstance.close();
          idbInstance = null;
        };
        resolve(idbInstance);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async function idbGet(storeName, key) {
    try {
      const db = await openIDB();
      if (!db.objectStoreNames.contains(storeName)) return null;
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
      if (!db.objectStoreNames.contains(storeName)) return false;
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readwrite");
        if (value === null) {
          tx.objectStore(storeName).delete(String(key));
        } else {
          tx.objectStore(storeName).put(value, String(key));
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) { return false; }
  }

  async function idbSetBatch(storeName, entriesMap) {
    try {
      const db = await openIDB();
      if (!db.objectStoreNames.contains(storeName)) return false;
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        Object.entries(entriesMap).forEach(([k, v]) => {
          if (v === null) {
            store.delete(String(k));
          } else {
            store.put(v, String(k));
          }
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) { return false; }
  }

  // 🚀 Fixed: Zero-Freeze Fast Modern Key-Value Reader
  async function idbGetAllMap(storeName) {
    try {
      const db = await openIDB();
      if (!db.objectStoreNames.contains(storeName)) return {};
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const map = {};
        const reqKeys = store.getAllKeys();
        const reqVals = store.getAll();
        tx.oncomplete = () => {
          const keys = reqKeys.result || [];
          const vals = reqVals.result || [];
          for (let i = 0; i < keys.length; i++) {
            map[keys[i]] = vals[i];
          }
          resolve(map);
        };
        tx.onerror = () => resolve({});
      });
    } catch (e) { return {}; }
  }

  const AccuEngine = {
    init: function (config) {
      modules = config;
      console.log("[AccuEngine v3.6] Initialized with Live Sync Bridge.");
      window.addEventListener("online", () => this.processSyncQueue());
      if (navigator.onLine) {
        setTimeout(() => this.processSyncQueue(), 2500);
      }
    },

    fetch: async function (path) {
      if (!path) return null;
      const parts = path.split("/");
      const root = parts[0];
      const { fsDb, db: rtdb, doc, getDoc, collection, getDocs, ref, get, child } = (modules || {});

      // 1. STUDENTS
      if (root === "students") {
        if (parts[1]) {
          const admn = String(parts[1]);
          const cached = await idbGet("students", admn);
          if (cached && Object.keys(cached).length > 0) return cached;
          if (navigator.onLine && fsDb && getDoc && doc) {
            try {
              const snap = await getDoc(doc(fsDb, "students", admn));
              if (snap && snap.exists()) {
                const data = snap.data();
                await idbSet("students", admn, data);
                return data;
              }
            } catch (e) {}
          }
          return null;
        } else {
          const localMap = await idbGetAllMap("students");
          if (Object.keys(localMap).length > 0) return localMap;

          if (navigator.onLine && fsDb && getDocs && collection) {
            try {
              const snap = await getDocs(collection(fsDb, "students"));
              if (!snap.empty) {
                const allS = {};
                snap.forEach((d) => { allS[d.id] = d.data(); });
                await idbSetBatch("students", allS);
                return allS;
              }
            } catch (e) {}
          }
          return {};
        }
      }

      // 2. USERS
      if (root === "users") {
        if (parts[1]) {
          const uid = String(parts[1]);
          const cached = await idbGet("users", uid);
          if (cached && Object.keys(cached).length > 0) return cached;
          if (navigator.onLine && fsDb && getDoc && doc) {
            try {
              const snap = await getDoc(doc(fsDb, "users", uid));
              if (snap && snap.exists()) {
                const data = snap.data();
                await idbSet("users", uid, data);
                return data;
              }
            } catch (e) {}
          }
          return null;
        } else {
          const localMap = await idbGetAllMap("users");
          if (Object.keys(localMap).length > 0) return localMap;

          if (navigator.onLine && fsDb && getDocs && collection) {
            try {
              const snap = await getDocs(collection(fsDb, "users"));
              if (!snap.empty) {
                const allUsers = {};
                snap.forEach((d) => { allUsers[d.id] = d.data(); });
                await idbSetBatch("users", allUsers);
                return allUsers;
              }
            } catch (e) {}
          }
          return {};
        }
      }

      // 3. TEACHERS
      if (root === "teachers") {
        if (parts[1]) {
          const user = String(parts[1]);
          const cached = await idbGet("teachers", user);
          if (cached && Object.keys(cached).length > 0) return cached;
          if (navigator.onLine && fsDb && getDoc && doc) {
            try {
              const snap = await getDoc(doc(fsDb, "teachers", user));
              if (snap && snap.exists()) {
                const data = snap.data();
                await idbSet("teachers", user, data);
                return data;
              }
            } catch (e) {}
          }
          return null;
        } else {
          const localMap = await idbGetAllMap("teachers");
          if (Object.keys(localMap).length > 0) return localMap;

          if (navigator.onLine && fsDb && getDocs && collection) {
            try {
              const snap = await getDocs(collection(fsDb, "teachers"));
              if (!snap.empty) {
                const allT = {};
                snap.forEach((d) => { allT[d.id] = d.data(); });
                await idbSetBatch("teachers", allT);
                return allT;
              }
            } catch (e) {}
          }
          return {};
        }
      }

      // 4. FEES MATRIX
      if (root === "fees_matrix") {
        if (parts[1]) {
          const admn = String(parts[1]);
          const cached = await idbGet("fees_matrix", admn);
          if (cached && Object.keys(cached).length > 0) return cached;
          if (navigator.onLine && fsDb && getDoc && doc) {
            try {
              const snap = await getDoc(doc(fsDb, "fees_matrix", admn));
              if (snap && snap.exists()) {
                const res = snap.data().matrix || snap.data();
                await idbSet("fees_matrix", admn, res);
                return res;
              }
            } catch (e) {}
          }
          return {};
        } else {
          const localMap = await idbGetAllMap("fees_matrix");
          if (Object.keys(localMap).length > 0) return localMap;

          if (navigator.onLine && fsDb && getDocs && collection) {
            try {
              const snap = await getDocs(collection(fsDb, "fees_matrix"));
              const allMatrix = {};
              snap.forEach((d) => {
                const data = d.data();
                allMatrix[d.id] = data.matrix || data;
              });
              await idbSetBatch("fees_matrix", allMatrix);
              return allMatrix;
            } catch (e) {}
          }
          return {};
        }
      }

      // 5. FEES ENTRIES
      if (root === "fees_entries") {
        const localMap = await idbGetAllMap("fees_entries");
        if (Object.keys(localMap).length > 0) {
          const nested = {};
          Object.values(localMap).forEach((item) => {
            if (item && item.admn) {
              if (!nested[item.admn]) nested[item.admn] = {};
              nested[item.admn][item.id || item.entryId || Math.random()] = item;
            }
          });
          return nested;
        }

        if (navigator.onLine && fsDb && getDocs && collection) {
          try {
            const snap = await getDocs(collection(fsDb, "fees_entries"));
            const nested = {};
            const batchMap = {};
            snap.forEach((d) => {
              const data = d.data();
              batchMap[d.id] = data;
              if (data && data.admn) {
                if (!nested[data.admn]) nested[data.admn] = {};
                nested[data.admn][data.id || d.id] = data;
              }
            });
            idbSetBatch("fees_entries", batchMap);
            return nested;
          } catch (e) {}
        }
        return {};
      }

      // 6. ATTENDANCE (ROCK-SOLID RELIABILITY ENGINE)
      if (root === "attendance") {
        // Case A: Single Student + Specific Month (`attendance/{admn}/{month}`)
        if (parts[1] && parts[2]) {
          const admn = String(parts[1]);
          const month = String(parts[2]);
          const key = `${admn}_${month}`;

          const cached = await idbGet("attendance", key);
          if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
            return cached;
          }

          if (navigator.onLine && fsDb && getDoc && doc) {
            try {
              const snap = await getDoc(doc(fsDb, "attendance", key));
              if (snap && snap.exists()) {
                const docData = snap.data();
                const res = docData.days || docData;
                await idbSet("attendance", key, res);
                return res;
              }
            } catch (e) {}
          }
          return {};
        }
        
        // Case B: Entire School / Class Attendance (`attendance`)
        else {
          const localMap = await idbGetAllMap("attendance");

          // Agar phone mein 30 se zyada records pehle se saved hain toh direct use karo
          if (Object.keys(localMap).length > 30) {
            const fullAtt = {};
            Object.entries(localMap).forEach(([k, val]) => {
              const idx = k.lastIndexOf("_");
              if (idx !== -1) {
                const sAdmn = k.slice(0, idx);
                const sMonth = k.slice(idx + 1);
                if (!fullAtt[sAdmn]) fullAtt[sAdmn] = {};
                fullAtt[sAdmn][sMonth] = val;
              }
            });
            return fullAtt;
          }

          // Warna seedha Firestore se saare 310 documents live load karo aur phone mein cache karo
          if (navigator.onLine && fsDb && getDocs && collection) {
            try {
              const snap = await getDocs(collection(fsDb, "attendance"));
              const fullAtt = {};
              const batchMap = {};

              snap.forEach((d) => {
                const docData = d.data();
                const docId = d.id;
                const idx = docId.lastIndexOf("_");
                const sAdmn = docData.admn || (idx !== -1 ? docId.slice(0, idx) : docId);
                const sMonth = docData.month || (idx !== -1 ? docId.slice(idx + 1) : "");
                const daysObj = docData.days || docData;

                if (!fullAtt[sAdmn]) fullAtt[sAdmn] = {};
                fullAtt[sAdmn][sMonth] = daysObj;
                batchMap[`${sAdmn}_${sMonth}`] = daysObj;
              });

              if (Object.keys(batchMap).length > 0) {
                await idbSetBatch("attendance", batchMap);
              }
              return fullAtt;
            } catch (e) {
              console.warn("[AccuEngine] Firestore Attendance fetch error:", e);
            }
          }
          return {};
        }
      }

      // 7. TESTS (Offline Tests)
      if (root === "tests") {
        const admn = parts[1];
        if (admn) {
          const cached = await idbGet("tests", admn);
          if (cached && Object.keys(cached).length > 0) return cached;
          if (navigator.onLine && fsDb && getDocs && collection) {
            try {
              const snap = await getDocs(collection(fsDb, "tests"));
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
            } catch (e) {}
          }
          return {};
        }
      }

      // 8. RTDB Fallback
      if (navigator.onLine && rtdb && ref && get && child) {
        try {
          const snap = await get(child(ref(rtdb), path));
          return snap.exists() ? snap.val() : null;
        } catch (e) { return null; }
      }

      return null;
    },

    setLocal: async function (storeName, key, value) {
      await idbSet(storeName, key, value);
    },

    invalidate: async function (storeName, key) {
      await idbSet(storeName, key, null);
    },

    triggerBackgroundSync: function () {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then((reg) => {
          return reg.sync.register('accuengine-sync-queue');
        }).catch(() => {});
      }
    },

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
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    },

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
          }
          const delTx = db.transaction("sync_queue", "readwrite");
          delTx.objectStore("sync_queue").delete(item.id);
        } catch (err) { break; }
      }
    }
  };

  window.AccuEngine = AccuEngine;
})(window);
