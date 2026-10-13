/**
 * AccuEngine v3.5 - Complete Unified Offline & Firestore Cache Engine
 * MM Islamic English School ERP
 * Fully Integrated with Cloud Firestore Collections & IndexedDB Persistent Outbox
 */

(function (window) {
  "use strict";

  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 6;
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

  async function idbGetAllMap(storeName) {
    try {
      const db = await openIDB();
      if (!db.objectStoreNames.contains(storeName)) return {};
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
      console.log("[AccuEngine v3.5] Active. Dual Firestore + IndexedDB Router.");
      window.addEventListener("online", () => this.processSyncQueue());
      if (navigator.onLine) {
        setTimeout(() => this.processSyncQueue(), 2500);
      }
    },

    // 🚀 CACHE-FIRST & FIRESTORE ROUTER
    fetch: async function (path) {
      if (!path) return null;
      const parts = path.split("/");
      const root = parts[0];
      const { fsDb, db: rtdb, doc, getDoc, collection, getDocs, ref, get, child } = (modules || {});

      // 1. STUDENTS (Firestore Primary)
      if (root === "students") {
        if (parts[1]) {
          const admn = String(parts[1]);
          const cached = await idbGet("students", admn);
          if (cached) return cached;
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
          const hasLocal = Object.keys(localMap).length > 0;

          if (navigator.onLine && fsDb && getDocs && collection) {
            getDocs(collection(fsDb, "students")).then((snap) => {
              if (snap && !snap.empty) {
                const batchMap = {};
                snap.forEach((d) => { batchMap[d.id] = d.data(); });
                idbSetBatch("students", batchMap);
              }
            }).catch(() => {});
          }

          if (hasLocal) return localMap;

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

      // 2. USERS (Credentials Vault - Firestore Primary)
      if (root === "users") {
        if (parts[1]) {
          const uid = String(parts[1]);
          const cached = await idbGet("users", uid);
          if (cached) return cached;
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

      // 3. TEACHERS (Firestore Primary)
      if (root === "teachers") {
        if (parts[1]) {
          const user = String(parts[1]);
          const cached = await idbGet("teachers", user);
          if (cached) return cached;
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

      // 4. FEES MATRIX (Firestore Primary)
      if (root === "fees_matrix") {
        if (parts[1]) {
          const admn = String(parts[1]);
          const cached = await idbGet("fees_matrix", admn);
          if (cached) return cached;
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

      // 5. FEES ENTRIES (Receipts - Firestore Primary)
      if (root === "fees_entries") {
        if (parts[1]) {
          const admn = String(parts[1]);
          const localMap = await idbGetAllMap("fees_entries");
          const filtered = {};
          Object.entries(localMap).forEach(([k, v]) => {
            if (v && String(v.admn) === admn) filtered[k] = v;
          });
          if (Object.keys(filtered).length > 0) return filtered;

          if (navigator.onLine && fsDb && getDocs && collection) {
            try {
              const snap = await getDocs(collection(fsDb, "fees_entries"));
              const studentEntries = {};
              snap.forEach((d) => {
                const data = d.data();
                idbSet("fees_entries", d.id, data);
                if (data && String(data.admn) === admn) {
                  studentEntries[data.id || d.id] = data;
                }
              });
              return studentEntries;
            } catch (e) {}
          }
          return {};
        } else {
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
      }

      // 6. ATTENDANCE (Firestore Primary)
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
              const batchMap = {};
              snap.forEach((d) => {
                const docData = d.data();
                const admn = docData.admn || d.id.split("_")[0];
                const month = docData.month || d.id.split("_")[1];
                if (!fullAtt[admn]) fullAtt[admn] = {};
                fullAtt[admn][month] = docData.days || docData;
                batchMap[`${admn}_${month}`] = docData.days || docData;
              });
              idbSetBatch("attendance", batchMap);
              return fullAtt;
            } catch (e) {}
          }
          return {};
        }
      }

      // 7. TESTS (Offline Test Marks - Firestore Primary)
      if (root === "tests") {
        const admn = parts[1];
        if (admn) {
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
      }

      // 8. ONLINE TESTS (Firestore Primary)
      if (root === "online_tests") {
        const classKey = parts[1];
        const testId = parts[2];

        if (testId) {
          const cached = await idbGet("online_tests", testId);
          if (cached) return cached;
          if (navigator.onLine && fsDb && getDoc && doc) {
            try {
              const snap = await getDoc(doc(fsDb, "online_tests", testId));
              if (snap && snap.exists()) {
                const data = snap.data();
                await idbSet("online_tests", testId, data);
                return data;
              }
            } catch (e) {}
          }
          return null;
        } else {
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
              const batchMap = {};
              snap.forEach((d) => {
                const data = d.data();
                batchMap[d.id] = data;
                if (!classKey || String(data.class) === String(classKey)) {
                  tests[d.id] = data;
                }
              });
              idbSetBatch("online_tests", batchMap);
              return tests;
            } catch (e) {}
          }
          return {};
        }
      }

      // 9. DAILY CLAIMS (Firestore Primary)
      if (root === "daily_claims" && parts[1]) {
        const admn = String(parts[1]);
        const cached = await idbGet("daily_claims", admn);
        if (cached) return cached;
        if (navigator.onLine && fsDb && getDoc && doc) {
          try {
            const snap = await getDoc(doc(fsDb, "daily_claims", admn));
            if (snap && snap.exists()) {
              const res = snap.data().claims || snap.data();
              await idbSet("daily_claims", admn, res);
              return res;
            }
          } catch (e) {}
        }
        return {};
      }

      // 10. LIGHTWEIGHT RTDB CONFIGS (Timetable, Subjects, Syllabus)
      if (root === "timetable") {
        const cls = parts[1] || "1";
        const cached = await idbGet("timetable", cls);
        if (cached) return cached;
        if (navigator.onLine && rtdb && ref && get && child) {
          try {
            const snap = await get(child(ref(rtdb), `timetable/${cls}`));
            if (snap && snap.exists()) {
              const val = snap.val();
              await idbSet("timetable", cls, val);
              return val;
            }
          } catch (e) {}
        }
        return [];
      }

      if (root === "subjects") {
        const localSubs = await idbGet("subjects", "all_subjects");
        if (localSubs) return localSubs;
        if (navigator.onLine && rtdb && ref && get && child) {
          try {
            const snap = await get(child(ref(rtdb), "subjects"));
            if (snap && snap.exists()) {
              const val = snap.val();
              await idbSet("subjects", "all_subjects", val);
              return val;
            }
          } catch (e) {}
        }
        return ["English", "Mathematics", "Science", "Social Studies", "Urdu", "Hindi", "Deeniyat"];
      }

      // RTDB Fallback for other paths
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
      const { fsDb, doc, setDoc, deleteDoc, db: rtdb, ref, update: rtdbUpdate } = modules;

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
          } else if (item.actionType === "student_update") {
            const { admn, studentData, userData, rtdbPayload } = item.payload;
            await setDoc(doc(fsDb, "students", String(admn)), studentData, { merge: true });
            if (userData) await setDoc(doc(fsDb, "users", String(admn)), userData, { merge: true });
            if (rtdb && rtdbPayload && rtdbUpdate && ref) await rtdbUpdate(ref(rtdb), rtdbPayload).catch(() => {});
          } else if (item.actionType === "student_delete") {
            const { admn } = item.payload;
            await deleteDoc(doc(fsDb, "students", String(admn))).catch(() => {});
            await deleteDoc(doc(fsDb, "users", String(admn))).catch(() => {});
            await deleteDoc(doc(fsDb, "fees_matrix", String(admn))).catch(() => {});
          } else if (item.actionType === "teacher_update") {
            const { username, teacherData, userData } = item.payload;
            await setDoc(doc(fsDb, "teachers", String(username)), teacherData, { merge: true });
            if (userData) await setDoc(doc(fsDb, "users", String(username)), userData, { merge: true });
          } else if (item.actionType === "teacher_delete") {
            const { username } = item.payload;
            await deleteDoc(doc(fsDb, "teachers", String(username))).catch(() => {});
            await deleteDoc(doc(fsDb, "users", String(username))).catch(() => {});
          } else if (item.actionType === "offline_test") {
            const { testDocId, testData, admn, newPoints } = item.payload;
            await setDoc(doc(fsDb, "tests", testDocId), testData, { merge: true });
            await setDoc(doc(fsDb, "students", String(admn)), { points: newPoints }, { merge: true });
          } else if (item.actionType === "points_update") {
            const { admn, newPoints } = item.payload;
            await setDoc(doc(fsDb, "students", String(admn)), { points: newPoints }, { merge: true });
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
