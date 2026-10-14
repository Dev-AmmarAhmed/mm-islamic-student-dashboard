/**
 * ====================================================================
 * ACCUENGINE v5.5 - SECURE CACHE, CRYPTO VAULT & BIOMETRIC GATEWAY
 * System: MM Islamic English School ERP
 * Features:
 *  - Client-Side AES-GCM 256-Bit Hardware Encryption
 *  - Auto-Migration for Legacy Plaintext Cache
 *  - Zero-Network Version-Controlled Delta Sync
 *  - SHA-256 Hashed 4-Digit Startup PIN Gate
 *  - WebAuthn Biometric Authentication (Fingerprint / Face ID)
 * ====================================================================
 */

(function (window) {
  "use strict";

  const DB_NAME = "AccuEngine_Storage";
    const DB_VERSION = 13;
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
    "subjects",
    "syllabus_config",
    "syllabus_chapters",
    "syllabus_progress",
    "muster",
    "expenses",
    "daily_claims",
    "tests",
    "online_tests",
    "test_attempts",
    "sync_queue",
    "secure_keys"
  ];



  let idbInstance = null;
  let modules = null;
  let cachedCryptoKey = null;

  // ----------------------------------------------------
  // 1. INDEXEDDB CONNECTION ENGINE
  // ----------------------------------------------------
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

  // ----------------------------------------------------
  // 2. AES-GCM 256-BIT WEB CRYPTO HARDWARE ENGINE
  // ----------------------------------------------------
  const CRYPTO_KEY_ID = "accu_device_secret_vault_v1";

  async function getOrCreateCryptoKey() {
    if (cachedCryptoKey) return cachedCryptoKey;

    const db = await openIDB();
    const rawKey = await new Promise((resolve) => {
      const tx = db.transaction("secure_keys", "readonly");
      const req = tx.objectStore("secure_keys").get(CRYPTO_KEY_ID);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (rawKey) {
      cachedCryptoKey = await crypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );
      return cachedCryptoKey;
    }

    // Nayi 256-bit AES-GCM hardware key banana
    const newKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const exportedRaw = await crypto.subtle.exportKey("raw", newKey);

    await new Promise((resolve) => {
      const tx = db.transaction("secure_keys", "readwrite");
      tx.objectStore("secure_keys").put(exportedRaw, CRYPTO_KEY_ID);
      tx.oncomplete = () => resolve();
    });

    cachedCryptoKey = await crypto.subtle.importKey(
      "raw",
      exportedRaw,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
    return cachedCryptoKey;
  }

  function arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async function encryptPayload(plainObj) {
    if (plainObj === null || plainObj === undefined) return null;
    try {
      const key = await getOrCreateCryptoKey();
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit AES-GCM IV
      const encoded = new TextEncoder().encode(JSON.stringify(plainObj));

      const cipherBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encoded
      );

      return {
        __enc: true,
        iv: arrayBufferToBase64(iv.buffer),
        data: arrayBufferToBase64(cipherBuffer)
      };
    } catch (e) {
      console.warn("AccuEngine encryption fallback:", e);
      return plainObj;
    }
  }

  async function decryptPayload(storedRecord, storeName = null, key = null) {
    if (storedRecord === null || storedRecord === undefined) return null;

    // Auto-migration: Purana unencrypted record milne par background encrypt karna
    if (!storedRecord.__enc || !storedRecord.iv || !storedRecord.data) {
      if (storeName && key && idbInstance) {
        encryptPayload(storedRecord).then((encrypted) => {
          try {
            const tx = idbInstance.transaction(storeName, "readwrite");
            tx.objectStore(storeName).put(encrypted, String(key));
          } catch (_) {}
        });
      }
      return storedRecord;
    }

    try {
      const cryptoKey = await getOrCreateCryptoKey();
      const ivBuffer = base64ToArrayBuffer(storedRecord.iv);
      const cipherBuffer = base64ToArrayBuffer(storedRecord.data);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
        cryptoKey,
        cipherBuffer
      );

      const jsonStr = new TextDecoder().decode(decrypted);
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn("AccuEngine decryption error:", e);
      return null;
    }
  }

  // ----------------------------------------------------
  // 3. SECURE ENCRYPTED STORAGE OPERATIONS
  // ----------------------------------------------------
  async function idbGet(storeName, key) {
    try {
      const db = await openIDB();
      const encrypted = await new Promise((resolve) => {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(String(key));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      return await decryptPayload(encrypted, storeName, key);
    } catch (e) {
      return null;
    }
  }

  async function idbSet(storeName, key, value) {
    try {
      const db = await openIDB();
      const encrypted = value === null ? null : await encryptPayload(value);
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readwrite");
        if (encrypted === null) {
          tx.objectStore(storeName).delete(String(key));
        } else {
          tx.objectStore(storeName).put(encrypted, String(key));
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  async function idbSetBatch(storeName, entriesMap) {
    try {
      const db = await openIDB();
      const encryptedEntries = {};
      for (const [k, v] of Object.entries(entriesMap)) {
        encryptedEntries[k] = v === null ? null : await encryptPayload(v);
      }

      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        Object.entries(encryptedEntries).forEach(([k, v]) => {
          if (v === null) store.delete(String(k));
          else store.put(v, String(k));
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  async function idbGetAllMap(storeName) {
    try {
      const db = await openIDB();
      const rawMap = await new Promise((resolve) => {
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

      const decryptedMap = {};
      for (const [k, v] of Object.entries(rawMap)) {
        decryptedMap[k] = await decryptPayload(v, storeName, k);
      }
      return decryptedMap;
    } catch (e) {
      return {};
    }
  }

  // ----------------------------------------------------
  // 4. MAIN ACCUENGINE CONTROLLER
  // ----------------------------------------------------
  const AccuEngine = {
    init: function (config) {
      modules = config;
      getOrCreateCryptoKey().then(() => {
        console.log("🔒 [AccuEngine v5.5] AES-GCM Encrypted Cache Vault Active.");
      });
    },

        // 🚀 SINGLE-FLIGHT SYNC MUTEX (Prevent duplicate concurrent network calls)
    _syncInProgress: false,

    bumpSyncVersion: async function () {
      if (!navigator.onLine || !modules) return;
      try {
        const { db: rtdb, ref, set } = modules;
        if (typeof set !== "function") return;
        const newVer = Date.now().toString();
        await set(ref(rtdb, "sync_triggers/version"), newVer);
        localStorage.setItem("accu_local_version", newVer);
        console.log("⚡ [AccuEngine Sentinel] New Version Published:", newVer);
      } catch (e) {
        console.warn("Sentinel bump warning:", e);
      }
    },

    // 🚀 ZERO-NETWORK STRICT GATEKEEPER
    checkAndSyncData: async function (force = false) {
      if (!modules) return false;
      if (this._syncInProgress) {
        console.log("🛡️ [AccuEngine] Sync already in-flight. Skipping duplicate call.");
        return false;
      }

      const { fsDb, db: rtdb, ref, get, set, child, getDocs, collection } = modules;
      let remoteVersion = null;
      const localVersion = localStorage.getItem("accu_local_version");

      // 1. Fetch 10-byte sentinel version from RTDB
      if (navigator.onLine && rtdb) {
        try {
          const snap = await get(child(ref(rtdb), "sync_triggers/version"));
          if (snap.exists()) {
            remoteVersion = String(snap.val());
          } else if (typeof set === "function") {
            // Agar pehli baar hai toh initial version set karein
            remoteVersion = "10001";
            await set(ref(rtdb, "sync_triggers/version"), remoteVersion);
          }
        } catch (e) {
          console.warn("Version check warning:", e);
        }
      }

      // Check if local cache is already populated
      const hasLocalStudents = Object.keys(await idbGetAllMap("students")).length > 0;

      // 🛑 STRICT GATE: Agar local data maujood hai aur version match hai -> 0 NETWORK READS!
      if (!force && hasLocalStudents && remoteVersion && remoteVersion === localVersion) {
        console.log("🎯 [AccuEngine Gatekeeper] Verified: 0 Firestore Reads. Loading from memory.");
        return false;
      }

      // Agar offline hai aur local data hai tab bhi network mat bulao
      if (!navigator.onLine && hasLocalStudents) {
        return false;
      }

      this._syncInProgress = true;
      console.log("📥 [AccuEngine] Remote updates found. Performing single synchronized download...");

      try {
        const [
          studentsSnap, teachersSnap, usersSnap, feesMatrixSnap, feesEntriesSnap, 
          attendanceSnap, studyMatSnap, homeworkSnap, timetableSnap, leavesSnap, 
          subjectsSnap, sylConfigSnap, sylChaptersSnap, sylProgressSnap, musterSnap,
          expensesSnap, dailyClaimsSnap, testsSnap, onlineTestsSnap, testAttemptsSnap
        ] = await Promise.all([
          getDocs(collection(fsDb, "students")),
          getDocs(collection(fsDb, "teachers")),
          getDocs(collection(fsDb, "users")),
          getDocs(collection(fsDb, "fees_matrix")),
          getDocs(collection(fsDb, "fees_entries")),
          getDocs(collection(fsDb, "attendance")),
          getDocs(collection(fsDb, "study_material")),
          getDocs(collection(fsDb, "homework")),
          getDocs(collection(fsDb, "timetable")),
          getDocs(collection(fsDb, "leaves")),
          getDocs(collection(fsDb, "subjects")),
          getDocs(collection(fsDb, "syllabus_config")),
          getDocs(collection(fsDb, "syllabus_chapters")),
          getDocs(collection(fsDb, "syllabus_progress")),
          getDocs(collection(fsDb, "muster")),
          getDocs(collection(fsDb, "expenses")),
          getDocs(collection(fsDb, "daily_claims")),
          getDocs(collection(fsDb, "tests")),
          getDocs(collection(fsDb, "online_tests")),
          getDocs(collection(fsDb, "test_attempts"))
        ]);

        // Batch save to IndexedDB
        const studentsMap = {};
        studentsSnap.forEach((d) => { studentsMap[d.id] = d.data(); });
        await idbSetBatch("students", studentsMap);

        const teachersMap = {};
        teachersSnap.forEach((d) => { teachersMap[d.id] = d.data(); });
        await idbSetBatch("teachers", teachersMap);

        const usersMap = {};
        usersSnap.forEach((d) => { usersMap[d.id] = d.data(); });
        await idbSetBatch("users", usersMap);

        const feesMap = {};
        feesMatrixSnap.forEach((d) => {
          const dt = d.data();
          feesMap[d.id] = dt.matrix || dt;
        });
        await idbSetBatch("fees_matrix", feesMap);

        const entriesMap = {};
        feesEntriesSnap.forEach((d) => { entriesMap[d.id] = d.data(); });
        await idbSetBatch("fees_entries", entriesMap);

        const attMap = {};
        attendanceSnap.forEach((d) => {
          const dt = d.data();
          attMap[d.id] = dt.days || dt;
        });
        await idbSetBatch("attendance", attMap);

        const matMap = {};
        studyMatSnap.forEach((d) => { matMap[d.id] = d.data(); });
        await idbSetBatch("study_material", matMap);

        const hwMap = {};
        homeworkSnap.forEach((d) => { hwMap[d.id] = d.data(); });
        await idbSetBatch("homework", hwMap);

        const ttMap = {};
        timetableSnap.forEach((d) => { ttMap[d.id] = d.data().schedule || d.data(); });
        await idbSetBatch("timetable", ttMap);

        const lvMap = {};
        leavesSnap.forEach((d) => { lvMap[d.id] = d.data(); });
        await idbSetBatch("leaves", lvMap);

        const subMap = {};
        subjectsSnap.forEach((d) => { subMap[d.id] = d.data(); });
        await idbSetBatch("subjects", subMap);

        const sylCfgMap = {};
        sylConfigSnap.forEach((d) => { sylCfgMap[d.id] = d.data().subjects || d.data(); });
        await idbSetBatch("syllabus_config", sylCfgMap);

        const chMap = {};
        sylChaptersSnap.forEach((d) => { chMap[d.id] = d.data().chapters || d.data(); });
        await idbSetBatch("syllabus_chapters", chMap);

        const progMap = {};
        sylProgressSnap.forEach((d) => { progMap[d.id] = d.data().progress || d.data(); });
        await idbSetBatch("syllabus_progress", progMap);

        const musMap = {};
        musterSnap.forEach((d) => { musMap[d.id] = d.data(); });
        await idbSetBatch("muster", musMap);

        const expMap = {};
        expensesSnap.forEach((d) => { expMap[d.id] = d.data(); });
        await idbSetBatch("expenses", expMap);

        const claimMap = {};
        dailyClaimsSnap.forEach((d) => { claimMap[d.id] = d.data().claims || d.data(); });
        await idbSetBatch("daily_claims", claimMap);

        const testMap = {};
        testsSnap.forEach((d) => { testMap[d.id] = d.data(); });
        await idbSetBatch("tests", testMap);

        const onlTestMap = {};
        onlineTestsSnap.forEach((d) => { onlTestMap[d.id] = d.data(); });
        await idbSetBatch("online_tests", onlTestMap);

        const attpMap = {};
        testAttemptsSnap.forEach((d) => { attpMap[d.id] = d.data(); });
        await idbSetBatch("test_attempts", attpMap);

        // Lock version in local storage
        const finalVer = remoteVersion || "10001";
        localStorage.setItem("accu_local_version", finalVer);

        console.log("🔒 [AccuEngine] Data synced & version locked:", finalVer);
        return true;
      } catch (err) {
        console.error("❌ [AccuEngine Sync Failed]:", err);
        return false;
      } finally {
        this._syncInProgress = false;
      }
    },


    // Fast Data Getter
    fetch: async function (path) {
      if (!path) return null;
      const parts = path.split("/");
      const root = parts[0];

      // Attendance Resolver
      if (root === "attendance") {
        if (parts[1] && parts[2]) {
          const key = `${parts[1]}_${parts[2]}`;
          const val = await idbGet("attendance", key);
          return val || {};
        } else if (parts[1]) {
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

      // Fees Entries Resolver
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

      // Standard Stores (students, teachers, users, fees_matrix)
            // Study Material Resolver (Class-bound)
      if (root === "study_material") {
        const all = await idbGetAllMap("study_material");
        if (parts[1]) {
          const res = {};
          const targetCls = String(parts[1]).replace(/class\s*/i, "").trim();
          Object.entries(all).forEach(([k, v]) => {
            if (v && String(v.class).replace(/class\s*/i, "").trim() === targetCls) {
              res[v.id || k] = v;
            }
          });
          return res;
        }
        return all;
      }

      // Homework Resolver (Class-bound)
      if (root === "homework") {
        const all = await idbGetAllMap("homework");
        if (parts[1]) {
          const res = {};
          const targetCls = String(parts[1]).replace(/class\s*/i, "").trim();
          Object.entries(all).forEach(([k, v]) => {
            if (v && String(v.class).replace(/class\s*/i, "").trim() === targetCls) {
              res[v.id || k] = v;
            }
          });
          return res;
        }
        return all;
      }

           // Timetable Resolver
      if (root === "timetable") {
        if (parts[1]) {
          const cls = String(parts[1]).replace(/class\s*/i, "").trim();
          return await idbGet("timetable", cls);
        }
        return await idbGetAllMap("timetable");
      }

      // Leaves Resolver (leave_applications & teacher_leave_applications)
      if (root === "leave_applications" || root === "teacher_leave_applications") {
        const allLeaves = await idbGetAllMap("leaves");
        const isTeacherQuery = root === "teacher_leave_applications";
        if (parts[1]) {
          const targetAdmn = String(parts[1]).trim();
          const userLeaves = {};
          Object.entries(allLeaves).forEach(([k, v]) => {
            if (v && String(v.admn).trim() === targetAdmn) userLeaves[k] = v;
          });
          return userLeaves;
        }
        const filteredAll = {};
        Object.entries(allLeaves).forEach(([k, v]) => {
          if (v && (isTeacherQuery ? v.applicantRole === "teacher" : v.applicantRole !== "teacher")) {
            if (!filteredAll[v.admn]) filteredAll[v.admn] = {};
            filteredAll[v.admn][v.id] = v;
          }
        });
        return filteredAll;
      }

      // Subjects Resolver
      if (root === "subjects") {
        const allSubs = await idbGetAllMap("subjects");
        if (parts[1]) {
          const cls = String(parts[1]).replace(/class\s*/i, "").trim();
          const classSubs = {};
          Object.entries(allSubs).forEach(([k, v]) => {
            if (v && String(v.class).replace(/class\s*/i, "").trim() === cls) classSubs[k] = v;
          });
          return classSubs;
        }
        return allSubs;
      }

      // Enabled Syllabus Resolver
      if (root === "enabled_syllabus") {
        if (parts[1]) {
          const cls = String(parts[1]).replace(/class\s*/i, "").trim();
          return await idbGet("syllabus_config", cls);
        }
        return await idbGetAllMap("syllabus_config");
      }

      // Syllabus Chapters Resolver
      if (root === "syllabus_chapters") {
        if (parts[1] && parts[2]) {
          const cls = String(parts[1]).replace(/class\s*/i, "").trim();
          const sub = String(parts[2]).trim();
          return await idbGet("syllabus_chapters", `${cls}_${sub}`);
        } else if (parts[1]) {
          const cls = String(parts[1]).replace(/class\s*/i, "").trim();
          const allCh = await idbGetAllMap("syllabus_chapters");
          const classCh = {};
          Object.entries(allCh).forEach(([k, v]) => {
            if (k.startsWith(`${cls}_`)) {
              const subName = k.substring(cls.length + 1);
              classCh[subName] = v;
            }
          });
          return classCh;
        }
        const allCh = await idbGetAllMap("syllabus_chapters");
        const nested = {};
        Object.entries(allCh).forEach(([k, v]) => {
          const idx = k.indexOf("_");
          if (idx !== -1) {
            const cls = k.substring(0, idx);
            const sub = k.substring(idx + 1);
            if (!nested[cls]) nested[cls] = {};
            nested[cls][sub] = v;
          }
        });
        return nested;
      }

      // Syllabus Progress Resolver
      if (root === "syllabus_progress") {
        if (parts[1] && parts[2]) {
          const admn = String(parts[1]).trim();
          const sub = String(parts[2]).trim();
          return await idbGet("syllabus_progress", `${admn}_${sub}`);
        } else if (parts[1]) {
          const admn = String(parts[1]).trim();
          const allP = await idbGetAllMap("syllabus_progress");
          const res = {};
          Object.entries(allP).forEach(([k, v]) => {
            if (k.startsWith(`${admn}_`)) {
              const subName = k.substring(admn.length + 1);
              res[subName] = v;
            }
          });
          return res;
        }
        const allP = await idbGetAllMap("syllabus_progress");
        const nested = {};
        Object.entries(allP).forEach(([k, v]) => {
          const idx = k.indexOf("_");
          if (idx !== -1) {
            const admn = k.substring(0, idx);
            const sub = k.substring(idx + 1);
            if (!nested[admn]) nested[admn] = {};
            nested[admn][sub] = v;
          }
        });
        return nested;
      }

           // Muster Resolver
      if (root === "muster") {
        if (parts[1] && parts[2] && parts[3]) {
          const mDoc = await idbGet("muster", parts[1]) || {};
          const dayObj = mDoc[parts[2]] || {};
          return dayObj[parts[3]] || null;
        } else if (parts[1]) {
          return await idbGet("muster", parts[1]);
        }
        return await idbGetAllMap("muster");
      }

      // Expenses Resolver (Month-wise)
      if (root === "expenses") {
        const allExp = await idbGetAllMap("expenses");
        if (parts[1]) {
          const targetMonth = String(parts[1]).trim().toLowerCase();
          const monthExpenses = {};
          Object.entries(allExp).forEach(([k, v]) => {
            if (v && v.month && String(v.month).trim().toLowerCase() === targetMonth) {
              monthExpenses[v.id || k] = v;
            } else if (k.startsWith(`${parts[1]}_`)) {
              monthExpenses[v.id || k] = v;
            }
          });
          return monthExpenses;
        }
        return allExp;
      }

      // Daily Claims Resolver (Student & Teacher)
      if (root === "daily_claims" || root === "teacher_daily_claims") {
        if (parts[1] && parts[2]) {
          // daily_claims/ID/2026_10_14
          const userClaims = await idbGet("daily_claims", parts[1]) || {};
          return userClaims[parts[2]] === true;
        } else if (parts[1]) {
          return await idbGet("daily_claims", parts[1]) || {};
        }
        return await idbGetAllMap("daily_claims");
      }

      // Offline Tests Resolver
      if (root === "tests") {
        const allTests = await idbGetAllMap("tests");
        if (parts[1]) {
          const targetAdmn = String(parts[1]).trim();
          const studentTests = {};
          Object.entries(allTests).forEach(([k, v]) => {
            if (v && String(v.admn).trim() === targetAdmn) studentTests[k] = v;
          });
          return studentTests;
        }
        return allTests;
      }

      // Online Tests Resolver
      if (root === "online_tests") {
        const allOnl = await idbGetAllMap("online_tests");
        if (parts[1] && parts[2]) {
          return await idbGet("online_tests", parts[2]) || await idbGet("online_tests", `${parts[1]}_${parts[2]}`);
        } else if (parts[1]) {
          const targetCls = String(parts[1]).replace(/class\s*/i, "").trim();
          const classTests = {};
          Object.entries(allOnl).forEach(([k, v]) => {
            if (v && String(v.class).replace(/class\s*/i, "").trim() === targetCls) {
              classTests[v.id || k] = v;
            }
          });
          return classTests;
        }
        return allOnl;
      }

      // Test Attempts Resolver (test_attempts & student_test_attempts)
      if (root === "test_attempts" || root === "student_test_attempts") {
        const allAtt = await idbGetAllMap("test_attempts");
        if (root === "test_attempts" && parts[1]) {
          const targetTestId = String(parts[1]).trim();
          const res = {};
          Object.entries(allAtt).forEach(([k, v]) => {
            if (v && String(v.testId).trim() === targetTestId) {
              res[v.admn] = v;
            }
          });
          return res;
        } else if (root === "student_test_attempts" && parts[1]) {
          const targetAdmn = String(parts[1]).trim();
          const res = {};
          Object.entries(allAtt).forEach(([k, v]) => {
            if (v && String(v.admn).trim() === targetAdmn) {
              res[v.testId] = v;
            }
          });
          return res;
        }
        return allAtt;
      }


      // Standard Stores (students, teachers, users, fees_matrix)
      if (parts[1]) {
        return await idbGet(root, parts[1]);
      } else {
        return await idbGetAllMap(root);
      }

    },

    setLocal: async function (storeName, key, value) {
      await idbSet(storeName, key, value);
    },

    invalidate: async function (storeName, key) {
      await idbSet(storeName, key, null);
    },
    // ----------------------------------------------------
    // 5. SECURITY VAULT: PIN HASHING & WEBAUTHN BIOMETRICS (FIXED)
    // ----------------------------------------------------
    hashPin: async function (pin, salt) {
      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", enc.encode(pin + ":" + salt));
      return arrayBufferToBase64(hashBuffer);
    },

    setAppLock: async function (userId, pin, enableBiometrics) {
      if (!userId || !pin || pin.length !== 4) return false;
      const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
      const saltStr = arrayBufferToBase64(saltBuffer.buffer);
      const hashedPin = await this.hashPin(pin, saltStr);

      let savedCredId = null;

      // Agar user ne Biometrics tick kiya hai toh Device par Passkey register karo
      if (enableBiometrics && window.PublicKeyCredential) {
        try {
          const challenge = crypto.getRandomValues(new Uint8Array(32));
          const userIdBuffer = new Uint8Array(16);
          crypto.getRandomValues(userIdBuffer);

          const credential = await navigator.credentials.create({
            publicKey: {
              challenge: challenge,
              rp: { name: "MM Islamic School ERP", id: window.location.hostname },
              user: {
                id: userIdBuffer,
                name: String(userId),
                displayName: `Account (${userId})`
              },
              pubKeyCredParams: [
                { type: "public-key", alg: -7 },   // ES256
                { type: "public-key", alg: -257 }  // RS256
              ],
              authenticatorSelection: {
                authenticatorAttachment: "platform", // Direct device Fingerprint / Face
                userVerification: "required",
                residentKey: "preferred"
              },
              timeout: 60000
            }
          });

          if (credential && credential.rawId) {
            savedCredId = arrayBufferToBase64(credential.rawId);
          }
        } catch (bioErr) {
          console.warn("Biometric creation skipped/failed:", bioErr);
        }
      }

      const lockConfig = {
        enabled: true,
        userId: String(userId),
        salt: saltStr,
        pinHash: hashedPin,
        biometricEnabled: !!savedCredId,
        credentialId: savedCredId,
        updatedAt: Date.now()
      };

      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction("secure_keys", "readwrite");
        tx.objectStore("secure_keys").put(lockConfig, `app_lock_${userId}`);
        tx.oncomplete = () => {
          localStorage.setItem(`lock_active_${userId}`, "true");
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      });
    },

    getAppLockConfig: async function (userId) {
      if (!userId) return null;
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction("secure_keys", "readonly");
        const req = tx.objectStore("secure_keys").get(`app_lock_${userId}`);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    },

    verifyPin: async function (userId, enteredPin) {
      const cfg = await this.getAppLockConfig(userId);
      if (!cfg || !cfg.enabled) return false;
      const testHash = await this.hashPin(enteredPin, cfg.salt);
      return testHash === cfg.pinHash;
    },

    promptBiometrics: async function (userId) {
      if (!window.PublicKeyCredential) {
        throw new Error("Biometrics is not supported on this browser.");
      }

      const cfg = await this.getAppLockConfig(userId);
      if (!cfg || !cfg.credentialId) {
        throw new Error("No registered biometric key found. Please setup PIN again.");
      }

      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const credIdBuffer = base64ToArrayBuffer(cfg.credentialId);

      const publicKeyOptions = {
        challenge: challenge,
        rpId: window.location.hostname,
        allowCredentials: [{
          id: new Uint8Array(credIdBuffer),
          type: "public-key",
          transports: ["internal"]
        }],
        userVerification: "required",
        timeout: 60000
      };

      return await navigator.credentials.get({ publicKey: publicKeyOptions });
    }
  };

  window.AccuEngine = AccuEngine;
})(window);

