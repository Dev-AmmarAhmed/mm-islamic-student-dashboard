/**
 * AccuEngine v2.0 - Heavy Offline Persistent Engine
 * MM Islamic English School ERP
 * IndexedDB Cache-First with Firestore Auto-Sync
 */

(function (window) {
  "use strict";

  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 3;
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
      console.log("[AccuEngine] Persistent Offline Engine Active.");
      window.addEventListener("online", () => this.processSyncQueue());
      if (navigator.onLine) {
        setTimeout(() => this.processSyncQueue(), 2500);
      }
    },

    // 🚀 CACHE-FIRST FETCH: Pehle hamesha IndexedDB check karega, offline me 0ms response
    fetch: async function (path) {
      if (!path || !modules) return null;
      const parts = path.split("/");
      const root = parts[0];
      const { fsDb, db, doc, getDoc, collection, getDocs, ref, get, child } = modules;

      // 1. STUDENTS (Attendance, Directory, Leaderboard)
      if (root === "students") {
        if (parts[1]) {
          const admn = parts[1];
          const cached = await idbGet("students", admn);
          if (cached) return cached;
          if (navigator.onLine && fsDb && getDoc && doc) {
            try {
              const snap = await getDoc(doc(fsDb, "students", String(admn)));
              if (snap && snap.exists()) {
                const data = snap.data();
                await idbSet("students", admn, data);
                return data;
              }
            } catch (e) {}
          }
          return null;
        } else {
          // All Students
          const localMap = await idbGetAllMap("students");
          const hasLocal = Object.keys(localMap).length > 0;

          // Agar online hai, background me Firestore se sync karke local update karein
          if (navigator.onLine && fsDb && getDocs && collection) {
            getDocs(collection(fsDb, "students")).then((snap) => {
              if (snap && !snap.empty) {
                snap.forEach((d) => {
                  idbSet("students", d.id, d.data());
                });
              }
            }).catch(() => {});
          }

          // Offline ya fast response ke liye local map dein
          if (hasLocal) return localMap;

          // Agar first time hai aur online hai
          if (navigator.onLine && fsDb && getDocs && collection) {
            try {
              const snap = await getDocs(collection(fsDb, "students"));
              if (snap && !snap.empty) {
                const allS = {};
                snap.forEach((d) => {
                  allS[d.id] = d.data();
                  idbSet("students", d.id, d.data());
                });
                return allS;
              }
            } catch (e) {}
          }
          return {};
        }
      }

      // 2. TEACHERS
      if (root === "teachers") {
        if (parts[1]) {
          const user = parts[1];
          const cached = await idbGet("teachers", user);
          if (cached) return cached;
          if (navigator.onLine && fsDb && getDoc && doc) {
            try {
              const snap = await getDoc(doc(fsDb, "teachers", String(user)));
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
              if (snap && !snap.empty) {
                const allT = {};
                snap.forEach((d) => {
                  allT[d.id] = d.data();
                  idbSet("teachers", d.id, d.data());
                });
                return allT;
              }
            } catch (e) {}
          }
          return {};
        }
      }

      // 3. ATTENDANCE
      if (root === "attendance") {
        if (parts[1] && parts[2]) {
          const key = `${parts[1]}_${parts[2]}`;
          const cached = await idbGet("attendance", key);
          if (cached) return cached;
          if (navigator.onLine && fsDb && getDoc && doc) {
            try {
              const snap = await getDoc(doc(fsDb, "attendance", key));
              if (snap && snap.exists()) {
                const res = snap.data().days || snap.data();
                await idbSet("attendance", key, res);
                return res;
              }
            } catch (e) {}
          }
          return {};
        } else {
          const localMap = await idbGetAllMap("attendance");
          if (Object.keys(localMap).length > 0) {
            const fullAtt = {};
            Object.entries(localMap).forEach(([k, val]) => {
              const p = k.split("_");
              if (!fullAtt[p[0]]) fullAtt[p[0]] = {};
              fullAtt[p[0]][p[1]] = val;
            });
            return fullAtt;
          }
          if (navigator.onLine && fsDb && getDocs && collection) {
            try {
              const snap = await getDocs(collection(fsDb, "attendance"));
              const fullAtt = {};
              snap.forEach((d) => {
                const docData = d.data();
                const admn = docData.admn || d.id.split("_")[0];
                const month = docData.month || d.id.split("_")[1];
                if (!fullAtt[admn]) fullAtt[admn] = {};
                fullAtt[admn][month] = docData.days || docData;
                idbSet("attendance", `${admn}_${month}`, docData.days || docData);
              });
              return fullAtt;
            } catch (e) {}
          }
          return {};
        }
      }

      // 4. DAILY CLAIMS
      if (root === "daily_claims" && parts[1]) {
        const admn = parts[1];
        const cached = await idbGet("daily_claims", admn);
        if (cached) return cached;
        if (navigator.onLine && fsDb && getDoc && doc) {
          try {
            const snap = await getDoc(doc(fsDb, "daily_claims", String(admn)));
            if (snap && snap.exists()) {
              const res = snap.data().claims || snap.data();
              await idbSet("daily_claims", admn, res);
              return res;
            }
          } catch (e) {}
        }
        if (db && ref && get && child) {
          try {
            const snap = await get(child(ref(db), path));
            if (snap && snap.exists()) return snap.val();
          } catch (e) {}
        }
        return {};
      }

      // 5. FEES MATRIX
      if (root === "fees_matrix") {
        if (parts[1]) {
          const admn = parts[1];
          const cached = await idbGet("fees_matrix", admn);
          if (cached) return cached;
          if (navigator.onLine && fsDb && getDoc && doc) {
            try {
              const snap = await getDoc(doc(fsDb, "fees_matrix", String(admn)));
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
                idbSet("fees_matrix", d.id, allMatrix[d.id]);
              });
              return allMatrix;
            } catch (e) {}
          }
          return {};
        }
      }

      // 6. TESTS (Offline Marks)
      if (root === "tests" && parts[1]) {
        const admn = parts[1];
        const cached = await idbGet("tests", admn);
        if (cached) return cached;
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

      // 7. ONLINE TESTS
      if (root === "online_tests") {
        const classKey = parts[1];
        const localMap = await idbGetAllMap("online_tests");
        const classTests = {};
        Object.entries(localMap).forEach(([id, t]) => {
          if (!classKey || String(t.class) === String(classKey)) {
            classTests[id] = t;
          }
        });
        if (Object.keys(classTests).length > 0) return classTests;

        if (navigator.onLine && fsDb && getDocs && collection) {
          try {
            const snap = await getDocs(collection(fsDb, "online_tests"));
            const tests = {};
            snap.forEach((d) => {
              tests[d.id] = d.data();
              idbSet("online_tests", d.id, d.data());
            });
            return tests;
          } catch (e) {}
        }
        return {};
      }

      // Small fallback for settings, timetables
      if (db && ref && get && child) {
        try {
          const snap = await get(child(ref(db), path));
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
          } else if (item.actionType === "fee_entry") {
            const { entryDocId, entryData, matrixDocId, matrixData } = item.payload;
            await setDoc(doc(fsDb, "fees_entries", entryDocId), entryData, { merge: true });
            await setDoc(doc(fsDb, "fees_matrix", matrixDocId), matrixData, { merge: true });
          }
          const delTx = db.transaction("sync_queue", "readwrite");
          delTx.objectStore("sync_queue").delete(item.id);
        } catch (err) {
          break;
        }
      }
    }
  };

  window.AccuEngine = AccuEngine;
})(window);
