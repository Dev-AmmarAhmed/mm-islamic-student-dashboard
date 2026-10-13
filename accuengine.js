/**
 * AccuEngine v1.0 - Production Safe Cache & Firestore Engine
 * MM Islamic English School ERP
 */

(function (window) {
  "use strict";

  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 1;
  const STORES = ["users", "students", "teachers", "fees_matrix", "fees_entries", "attendance", "tests", "online_tests", "test_attempts", "daily_claims"];

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
      console.log("[AccuEngine] Engine Online.");
    },

    fetch: async function (path) {
      if (!path || !modules) return null;
      const parts = path.split("/");
      const root = parts[0];
      const { fsDb, db, doc, getDoc, collection, getDocs, ref, get, child } = modules;

      // 1. STUDENTS (Name, Photo, Class, Points)
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

      // 2. TEACHERS
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

      // 3. DAILY CLAIMS (Unlimited Points Bug Fix)
      if (root === "daily_claims" && parts[1]) {
        const admn = parts[1];
        if (fsDb && getDoc && doc) {
          const snap = await getDoc(doc(fsDb, "daily_claims", String(admn))).catch(() => null);
          if (snap && snap.exists()) {
            return snap.data().claims || snap.data();
          }
        }
        // Fallback to RTDB so check never returns fake null
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

      // 4. USERS (Credentials)
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

      // 5. FEES MATRIX
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

      // 6. ATTENDANCE
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

      // 7. TESTS (Offline Marks)
      if (root === "tests" && parts[1]) {
        const admn = parts[1];
        const cached = await idbGet("tests", admn);
        if (cached) return cached;
        if (fsDb && getDocs && collection) {
          const snap = await getDocs(collection(fsDb, "tests")).catch(() => null);
          if (snap && !snap.empty) {
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

      // 8. FEES ENTRIES
      if (root === "fees_entries") {
        if (parts[1]) {
          const admn = parts[1];
          const cached = await idbGet("fees_entries", admn);
          if (cached) return cached;
          if (fsDb && getDocs && collection) {
            const snap = await getDocs(collection(fsDb, "fees_entries")).catch(() => null);
            if (snap && !snap.empty) {
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

      // 9. Lightweight Realtime Metadata Fallback (Timetable, Subjects, Permissions, Leaves)
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
