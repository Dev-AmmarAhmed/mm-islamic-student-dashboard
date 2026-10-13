/**
 * AccuEngine v1.0 - High Performance Cache & Security Engine
 * MM Islamic English School ERP
 */

(function (window) {
  "use strict";

  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 1;
  const STORES = ["users", "fees_matrix", "fees_entries", "attendance", "tests", "online_tests", "test_attempts"];

  let idbInstance = null;
  let fsDb = null;
  let rtdb = null;

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
    init: function (firebaseFirestore, firebaseRtdb) {
      fsDb = firebaseFirestore;
      rtdb = firebaseRtdb;
      console.log("[AccuEngine] Data Adapter & Cache Engine Online.");
    },

    // Smart Multi-Path Router (Firestore + IndexedDB Cache + RTDB Fallback)
    fetch: async function (path) {
      if (!path) return null;
      const parts = path.split("/");
      const root = parts[0];

      // A. USERS
      if (root === "users" && parts[1]) {
        const uid = parts[1];
        const cached = await idbGet("users", uid);
        if (cached) return cached;
        if (fsDb) {
          const docSnap = await fsDb.collection("users").doc(uid).get().catch(() => null);
          if (docSnap && docSnap.exists) {
            const data = docSnap.data();
            await idbSet("users", uid, data);
            return data;
          }
        }
      }

      // B. FEES MATRIX (Single Student ya All)
      if (root === "fees_matrix") {
        if (parts[1]) {
          const admn = parts[1];
          const cached = await idbGet("fees_matrix", admn);
          if (cached) return cached;
          if (fsDb) {
            const docSnap = await fsDb.collection("fees_matrix").doc(admn).get().catch(() => null);
            if (docSnap && docSnap.exists) {
              const res = docSnap.data().matrix || docSnap.data();
              await idbSet("fees_matrix", admn, res);
              return res;
            }
          }
        } else {
          // All students fees matrix
          if (fsDb) {
            const snap = await fsDb.collection("fees_matrix").get().catch(() => null);
            if (snap && !snap.empty) {
              const allMatrix = {};
              snap.forEach((d) => {
                const data = d.data();
                allMatrix[d.id] = data.matrix || data;
                idbSet("fees_matrix", d.id, allMatrix[d.id]);
              });
              return allMatrix;
            }
          }
        }
      }

      // C. ATTENDANCE (Student + Month, ya All)
      if (root === "attendance") {
        if (parts[1] && parts[2]) {
          const admn = parts[1];
          const month = parts[2];
          const key = `${admn}_${month}`;
          const cached = await idbGet("attendance", key);
          if (cached) return cached;
          if (fsDb) {
            const docSnap = await fsDb.collection("attendance").doc(key).get().catch(() => null);
            if (docSnap && docSnap.exists) {
              const res = docSnap.data().days || docSnap.data();
              await idbSet("attendance", key, res);
              return res;
            }
          }
        } else if (!parts[1] && fsDb) {
          // All Attendance
          const snap = await fsDb.collection("attendance").get().catch(() => null);
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

      // D. TESTS (Offline Marks)
      if (root === "tests" && parts[1]) {
        const admn = parts[1];
        const cached = await idbGet("tests", admn);
        if (cached) return cached;
        if (fsDb) {
          const snap = await fsDb.collection("tests").where("admn", "==", String(admn)).get().catch(() => null);
          if (snap && !snap.empty) {
            const testsObj = {};
            snap.forEach((d) => {
              testsObj[d.data().testId || d.id] = d.data();
            });
            await idbSet("tests", admn, testsObj);
            return testsObj;
          }
        }
      }

      // E. FEES ENTRIES (Receipts)
      if (root === "fees_entries") {
        if (parts[1]) {
          const admn = parts[1];
          const cached = await idbGet("fees_entries", admn);
          if (cached) return cached;
          if (fsDb) {
            const snap = await fsDb.collection("fees_entries").where("admn", "==", String(admn)).get().catch(() => null);
            if (snap && !snap.empty) {
              const entriesObj = {};
              snap.forEach((d) => {
                entriesObj[d.data().entryId || d.id] = d.data();
              });
              await idbSet("fees_entries", admn, entriesObj);
              return entriesObj;
            }
          }
        } else if (fsDb) {
          // All fees entries
          const snap = await fsDb.collection("fees_entries").get().catch(() => null);
          if (snap && !snap.empty) {
            const allEntries = {};
            snap.forEach((d) => {
              const entry = d.data();
              const a = entry.admn || "unknown";
              if (!allEntries[a]) allEntries[a] = {};
              allEntries[a][entry.entryId || d.id] = entry;
            });
            return allEntries;
          }
        }
      }

      // F. ONLINE TESTS & ATTEMPTS
      if (root === "online_tests") {
        const classKey = parts[1];
        const testId = parts[2];
        if (testId && fsDb) {
          const docSnap = await fsDb.collection("online_tests").doc(testId).get().catch(() => null);
          return docSnap && docSnap.exists ? docSnap.data() : null;
        } else if (classKey && fsDb) {
          const snap = await fsDb.collection("online_tests").where("class", "==", String(classKey)).get().catch(() => null);
          if (snap && !snap.empty) {
            const tests = {};
            snap.forEach((d) => { tests[d.id] = d.data(); });
            return tests;
          }
        }
      }

      if (root === "test_attempts" && parts[1] && fsDb) {
        const testId = parts[1];
        const snap = await fsDb.collection("test_attempts").where("testId", "==", String(testId)).get().catch(() => null);
        if (snap && !snap.empty) {
          const attempts = {};
          snap.forEach((d) => {
            const data = d.data();
            attempts[data.admn || d.id] = data;
          });
          return attempts;
        }
      }

      // Fallback to RTDB for other configurations (Subjects, Timetables, Settings)
      if (rtdb) {
        try {
          const snap = await rtdb.ref(path).once("value");
          return snap.exists() ? snap.val() : null;
        } catch (e) { return null; }
      }
      return null;
    },

    // Cache Write Invalidation Helper
    invalidate: async function (storeName, key) {
      await idbSet(storeName, key, null);
    }
  };

  window.AccuEngine = AccuEngine;
})(window);
