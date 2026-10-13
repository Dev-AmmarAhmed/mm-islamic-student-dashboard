/**
 * AccuEngine v4.2 - Unified Sentinel Engine
 * Full Auto-Sync: Students, Teachers, Users, Fees Matrix, Fees Entries & Attendance
 */

(function (window) {
  "use strict";

  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 8;
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

  async function idbSetBatch(storeName, entriesMap) {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        Object.entries(entriesMap).forEach(([k, v]) => {
          if (v === null) store.delete(String(k));
          else store.put(v, String(k));
        });
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
      console.log("⚡ [AccuEngine v4.2] Active with Attendance Pipeline.");
    },

    bumpSyncVersion: async function () {
      if (!navigator.onLine || !modules) return;
      try {
        const { db: rtdb, ref, set } = modules;
        const newVer = Date.now().toString();
        await set(ref(rtdb, "sync_triggers/version"), newVer);
        localStorage.setItem("accu_local_version", newVer);
      } catch (e) {}
    },

    // 🚀 MASTER CLOUD DOWNLOAD (Attendance + Fees + Students + Teachers)
    checkAndSyncData: async function (force = false) {
      if (!modules) return false;
      const { fsDb, db: rtdb, ref, get, child, getDocs, collection } = modules;

      let remoteVersion = null;
      const localVersion = localStorage.getItem("accu_local_version");

      if (navigator.onLine && rtdb) {
        try {
          const snap = await get(child(ref(rtdb), "sync_triggers/version"));
          if (snap.exists()) remoteVersion = String(snap.val());
        } catch (e) {}
      }

      const hasLocalStudents = Object.keys(await idbGetAllMap("students")).length > 0;
      const hasLocalAttendance = Object.keys(await idbGetAllMap("attendance")).length > 0;

      // Agar data pehle se hai aur version match hai -> zero network calls
      if (!force && hasLocalStudents && hasLocalAttendance && remoteVersion && remoteVersion === localVersion) {
        console.log("🎯 [AccuEngine] Cache Valid: Loading from memory (0 network read).");
        return false;
      }

      console.log("📥 [AccuEngine] Downloading complete school dataset including Attendance from Firestore...");

      try {
        const [studentsSnap, teachersSnap, usersSnap, feesMatrixSnap, feesEntriesSnap, attendanceSnap] = await Promise.all([
          getDocs(collection(fsDb, "students")),
          getDocs(collection(fsDb, "teachers")),
          getDocs(collection(fsDb, "users")),
          getDocs(collection(fsDb, "fees_matrix")),
          getDocs(collection(fsDb, "fees_entries")),
          getDocs(collection(fsDb, "attendance"))
        ]);

        // 1. Students
        const studentsMap = {};
        studentsSnap.forEach((d) => { studentsMap[d.id] = d.data(); });
        await idbSetBatch("students", studentsMap);

        // 2. Teachers
        const teachersMap = {};
        teachersSnap.forEach((d) => { teachersMap[d.id] = d.data(); });
        await idbSetBatch("teachers", teachersMap);

        // 3. Users
        const usersMap = {};
        usersSnap.forEach((d) => { usersMap[d.id] = d.data(); });
        await idbSetBatch("users", usersMap);

        // 4. Fees Matrix
        const feesMap = {};
        feesMatrixSnap.forEach((d) => {
          const dt = d.data();
          feesMap[d.id] = dt.matrix || dt;
        });
        await idbSetBatch("fees_matrix", feesMap);

        // 5. Fees Entries
        const entriesMap = {};
        feesEntriesSnap.forEach((d) => { entriesMap[d.id] = d.data(); });
        await idbSetBatch("fees_entries", entriesMap);

        // 6. 📅 ATTENDANCE (310 Monthly Sheets Sync)
        const attMap = {};
        attendanceSnap.forEach((d) => {
          const dt = d.data();
          attMap[d.id] = dt.days || dt;
        });
        await idbSetBatch("attendance", attMap);

        const finalVer = remoteVersion || Date.now().toString();
        localStorage.setItem("accu_local_version", finalVer);

        console.log(`🎉 [AccuEngine] Synced ${Object.keys(studentsMap).length} Students & ${Object.keys(attMap).length} Attendance sheets!`);
        return true;
      } catch (err) {
        console.error("❌ [AccuEngine Sync Failed]:", err);
        return false;
      }
    },

    // 🚀 UNIFIED FETCH (Auto Nested Hierarchy Resolver)
    fetch: async function (path) {
      if (!path) return null;
      const parts = path.split("/");
      const root = parts[0];

      // 1. ATTENDANCE QUERY HANDLER
      if (root === "attendance") {
        if (parts[1] && parts[2]) {
          // Path: attendance/101/August
          const key = `${parts[1]}_${parts[2]}`;
          const val = await idbGet("attendance", key);
          return val || {};
        } else if (parts[1]) {
          // Path: attendance/101
          const all = await idbGetAllMap("attendance");
          const res = {};
          const prefix = `${parts[1]}_`;
          Object.entries(all).forEach(([k, v]) => {
            if (k.startsWith(prefix)) {
              const month = k.substring(prefix.length);
              res[month] = v;
            }
          });
          return res;
        } else {
          // Path: attendance (All students all months)
          const all = await idbGetAllMap("attendance");
          const nested = {};
          Object.entries(all).forEach(([k, v]) => {
            const splitIdx = k.indexOf("_");
            if (splitIdx !== -1) {
              const admn = k.substring(0, splitIdx);
              const month = k.substring(splitIdx + 1);
              if (!nested[admn]) nested[admn] = {};
              nested[admn][month] = v;
            }
          });
          return nested;
        }
      }

      // 2. FEES ENTRIES QUERY HANDLER
      if (root === "fees_entries") {
        const all = await idbGetAllMap("fees_entries");
        if (parts[1]) {
          const res = {};
          Object.entries(all).forEach(([k, v]) => {
            if (v && String(v.admn) === String(parts[1])) res[k] = v;
          });
          return res;
        } else {
          const nested = {};
          Object.values(all).forEach((item) => {
            if (item && item.admn) {
              if (!nested[item.admn]) nested[item.admn] = {};
              nested[item.admn][item.id || item.entryId || Math.random()] = item;
            }
          });
          return nested;
        }
      }

      // 3. STANDARD PATHS (students, teachers, users, fees_matrix)
      if (parts[1]) {
        return await idbGet(root, parts[1]);
      } else {
        return await idbGetAllMap(root);
      }
    },

    setLocal: async function (storeName, key, value) {
      const db = await openIDB();
      const tx = db.transaction(storeName, "readwrite");
      if (value === null) tx.objectStore(storeName).delete(String(key));
      else tx.objectStore(storeName).put(value, String(key));
    },

    invalidate: async function (storeName, key) {
      await this.setLocal(storeName, key, null);
    }
  };

  window.AccuEngine = AccuEngine;
})(window);
