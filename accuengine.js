/**
 * AccuEngine v1.0 - High Performance Cache & Security Engine
 * MM Islamic English School ERP (v10 Modular Compatible)
 */

(function (window) {
  "use strict";

  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 1;
  const STORES = ["users", "students", "fees_matrix", "fees_entries", "attendance", "tests", "online_tests", "test_attempts"];

  let idbInstance = null;
  let modules = null;

  // 1. Permanent IndexedDB
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
      console.log("[AccuEngine] Data Adapter & Cache Engine Online (v10 Modular Active).");
    },

    // Smart Multi-Path Router
    fetch: async function (path) {
      if (!path || !modules) return null;
      const parts = path.split("/");
      const root = parts[0];
      const { fsDb, db, doc, getDoc, collection, getDocs, ref, get, child } = modules;

      // A. USERS
      if (root === "users" && parts[1]) {
        const uid = parts[1];
        const cached = await idbGet("users", uid);
        if (cached) return cached;
        if (fsDb && getDoc && doc) {
          try {
            const snap = await getDoc(doc(fsDb, "users", String(uid)));
            if (snap.exists()) {
              const data = snap.data();
              await idbSet("users", uid, data);
              return data;
            }
          } catch (e) {}
        }
      }

      // B. STUDENTS (Single Student Profile / Name / Class)
      if (root === "students" && parts[1]) {
        const admn = parts[1];
        const cached = await idbGet("students", admn);
        if (cached) return cached;
        // Fallback to RTDB where students profiles live
        if (db && ref && get && child) {
          try {
            const snap = await get(child(ref(db), path));
            if (snap.exists()) {
              const data = snap.val();
              await idbSet("students", admn, data);
              return data;
            }
          } catch (e) {}
        }
      }

      // C. FEES MATRIX (Single Student ya All)
      if (root === "fees_matrix") {
        if (parts[1]) {
          const admn = parts[1];
          const cached = await idbGet("fees_matrix", admn);
          if (cached) return cached;
          if (fsDb && getDoc && doc) {
            try {
              const snap = await getDoc(doc(fsDb, "fees_matrix", String(admn)));
              if (snap.exists()) {
                const res = snap.data().matrix || snap.data();
                await idbSet("fees_matrix", admn, res);
                return res;
              }
            } catch (e) {}
          }
        } else {
          if (fsDb && getDocs && collection) {
            try {
              const snap = await getDocs(collection(fsDb, "fees_matrix"));
              if (!snap.empty) {
                const allMatrix = {};
                snap.forEach((d) => {
                  const data = d.data();
                  allMatrix[d.id] = data.matrix || data;
                  idbSet("fees_matrix", d.id, allMatrix[d.id]);
                });
                return allMatrix;
              }
            } catch (e) {}
          }
        }
      }

      // D. ATTENDANCE (Student + Month, ya All)
      if (root === "attendance") {
        if (parts[1] && parts[2]) {
          const admn = parts[1];
          const month = parts[2];
          const key = `${admn}_${month}`;
          const cached = await idbGet("attendance", key);
          if (cached) return cached;
          if (fsDb && getDoc && doc) {
            try {
              const snap = await getDoc(doc(fsDb, "attendance", key));
              if (snap.exists()) {
                const res = snap.data().days || snap.data();
                await idbSet("attendance", key, res);
                return res;
              }
            } catch (e) {}
          }
        } else if (!parts[1] && fsDb && getDocs && collection) {
          try {
            const snap = await getDocs(collection(fsDb, "attendance"));
            if (!snap.empty) {
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
          } catch (e) {}
        }
      }

      // E. TESTS (Offline Marks)
      if (root === "tests" && parts[1]) {
        const admn = parts[1];
        const cached = await idbGet("tests", admn);
        if (cached) return cached;
        if (fsDb && getDocs && collection) {
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
      }

      // F. FEES ENTRIES (Receipts)
      if (root === "fees_entries") {
        if (parts[1]) {
          const admn = parts[1];
          const cached = await idbGet("fees_entries", admn);
          if (cached) return cached;
          if (fsDb && getDocs && collection) {
            try {
              const snap = await getDocs(collection(fsDb, "fees_entries"));
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
            } catch (e) {}
          }
        } else if (fsDb && getDocs && collection) {
          try {
            const snap = await getDocs(collection(fsDb, "fees_entries"));
            const allEntries = {};
            snap.forEach((d) => {
              const entry = d.data();
              const a = entry.admn || "unknown";
              if (!allEntries[a]) allEntries[a] = {};
              allEntries[a][entry.entryId || d.id] = entry;
            });
            return allEntries;
          } catch (e) {}
        }
      }

      // G. RTDB Fallback (students, teachers, subjects, timetable, settings)
      if (db && ref && get && child) {
        try {
          const snap = await get(child(ref(db), path));
          return snap.exists() ? snap.val() : null;
        } catch (e) { return null; }
      }
      return null;
    },

    invalidate: async function (storeName, key) {
      await idbSet(storeName, key, null);
    }
  };

  window.AccuEngine = AccuEngine;
})(window);
