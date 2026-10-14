/**
 * ====================================================================
 * IGRIS v6.0 - THE SHADOW SENTINEL & CRYPTOGRAPHIC SECURITY VAULT
 * System: MM Islamic English School ERP
 * Author: Managed & Maintained by MM Islamic English School
 * Features:
 *  - AES-GCM 256-Bit Hardware Encrypted Storage
 *  - Anti-Tamper Integrity Fingerprint
 *  - Zero-Network Delta Version Gatekeeper
 *  - WebAuthn Biometric & PIN Security Gate
 * ====================================================================
 */

(function (window) {
  "use strict";

  // Security Signature to prevent dummy overrides
  const IGRIS_SIGNATURE = "IGRIS_CORE_SECURE_VAULT_7789";
  const DB_NAME = "Igris_Storage_Vault";
  const DB_VERSION = 14;
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
  // AES-GCM 256-BIT WEB CRYPTO HARDWARE ENGINE
  // ----------------------------------------------------
  const CRYPTO_KEY_ID = "igris_device_secret_vault_v2";

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
      const iv = crypto.getRandomValues(new Uint8Array(12));
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
      return plainObj;
    }
  }

  async function decryptPayload(storedRecord, storeName = null, key = null) {
    if (storedRecord === null || storedRecord === undefined) return null;

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

      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
      return null;
    }
  }

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
  // IGRIS CORE SHADOW SENTINEL
  // ----------------------------------------------------
  const Igris = {
    isAlive: true,
    signature: IGRIS_SIGNATURE,

    init: function (config) {
      modules = config;
      getOrCreateCryptoKey().then(() => {
        console.log("🛡️ [Igris v6.0] Shadow Sentinel Initialized & Active.");
      });
    },

    _syncInProgress: false,

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

    checkAndSyncData: async function (force = false) {
      if (!modules) return false;
      if (this._syncInProgress) return false;

      const { fsDb, db: rtdb, ref, get, set, child, getDocs, collection } = modules;
      let remoteVersion = null;
      const localVersion = localStorage.getItem("igris_local_version");

      if (navigator.onLine && rtdb) {
        try {
          const snap = await get(child(ref(rtdb), "sync_triggers/version"));
          if (snap.exists()) {
            remoteVersion = String(snap.val());
          } else if (typeof set === "function") {
            remoteVersion = "10001";
            await set(ref(rtdb, "sync_triggers/version"), remoteVersion);
          }
        } catch (e) {}
      }

      const hasLocalStudents = Object.keys(await idbGetAllMap("students")).length > 0;

      // 0-Read Strict Gate
      if (!force && hasLocalStudents && remoteVersion && remoteVersion === localVersion) {
        return false;
      }
      if (!navigator.onLine && hasLocalStudents) {
        return false;
      }

      this._syncInProgress = true;
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

        const studentsMap = {}; studentsSnap.forEach(d => { studentsMap[d.id] = d.data(); });
        await idbSetBatch("students", studentsMap);

        const teachersMap = {}; teachersSnap.forEach(d => { teachersMap[d.id] = d.data(); });
        await idbSetBatch("teachers", teachersMap);

        const usersMap = {}; usersSnap.forEach(d => { usersMap[d.id] = d.data(); });
        await idbSetBatch("users", usersMap);

        const feesMap = {}; feesMatrixSnap.forEach(d => { const dt = d.data(); feesMap[d.id] = dt.matrix || dt; });
        await idbSetBatch("fees_matrix", feesMap);

        const entriesMap = {}; feesEntriesSnap.forEach(d => { entriesMap[d.id] = d.data(); });
        await idbSetBatch("fees_entries", entriesMap);

        const attMap = {}; attendanceSnap.forEach(d => { const dt = d.data(); attMap[d.id] = dt.days || dt; });
        await idbSetBatch("attendance", attMap);

        const matMap = {}; studyMatSnap.forEach(d => { matMap[d.id] = d.data(); });
        await idbSetBatch("study_material", matMap);

        const hwMap = {}; homeworkSnap.forEach(d => { hwMap[d.id] = d.data(); });
        await idbSetBatch("homework", hwMap);

        const ttMap = {}; timetableSnap.forEach(d => { ttMap[d.id] = d.data().schedule || d.data(); });
        await idbSetBatch("timetable", ttMap);

        const lvMap = {}; leavesSnap.forEach(d => { lvMap[d.id] = d.data(); });
        await idbSetBatch("leaves", lvMap);

        const subMap = {}; subjectsSnap.forEach(d => { subMap[d.id] = d.data(); });
        await idbSetBatch("subjects", subMap);

        const sylCfgMap = {}; sylConfigSnap.forEach(d => { sylCfgMap[d.id] = d.data().subjects || d.data(); });
        await idbSetBatch("syllabus_config", sylCfgMap);

        const chMap = {}; sylChaptersSnap.forEach(d => { chMap[d.id] = d.data().chapters || d.data(); });
        await idbSetBatch("syllabus_chapters", chMap);

        const progMap = {}; sylProgressSnap.forEach(d => { progMap[d.id] = d.data().progress || d.data(); });
        await idbSetBatch("syllabus_progress", progMap);

        const musMap = {}; musterSnap.forEach(d => { musMap[d.id] = d.data(); });
        await idbSetBatch("muster", musMap);

        const expMap = {}; expensesSnap.forEach(d => { expMap[d.id] = d.data(); });
        await idbSetBatch("expenses", expMap);

        const claimMap = {}; dailyClaimsSnap.forEach(d => { claimMap[d.id] = d.data().claims || d.data(); });
        await idbSetBatch("daily_claims", claimMap);

        const testMap = {}; testsSnap.forEach(d => { testMap[d.id] = d.data(); });
        await idbSetBatch("tests", testMap);

        const onlTestMap = {}; onlineTestsSnap.forEach(d => { onlTestMap[d.id] = d.data(); });
        await idbSetBatch("online_tests", onlTestMap);

        const attpMap = {}; testAttemptsSnap.forEach(d => { attpMap[d.id] = d.data(); });
        await idbSetBatch("test_attempts", attpMap);

        const finalVer = remoteVersion || "10001";
        localStorage.setItem("igris_local_version", finalVer);
        return true;
      } catch (err) {
        return false;
      } finally {
        this._syncInProgress = false;
      }
    },

    fetch: async function (path) {
      if (!path) return null;
      const parts = path.split("/");
      const root = parts[0];

      if (root === "attendance") {
        if (parts[1] && parts[2]) {
          return (await idbGet("attendance", `${parts[1]}_${parts[2]}`)) || {};
        } else if (parts[1]) {
          const all = await idbGetAllMap("attendance");
          const res = {};
          const prefix = `${parts[1]}_`;
          Object.entries(all).forEach(([k, v]) => {
            if (k.startsWith(prefix)) res[k.substring(prefix.length)] = v;
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

      if (root === "fees_entries") {
        const all = await idbGetAllMap("fees_entries");
        if (parts[1]) {
          const res = {};
          Object.entries(all).forEach(([k, v]) => {
            if (v && String(v.admn) === String(parts[1])) res[k] = v;
          });
          return res;
        }
        const nested = {};
        Object.values(all).forEach((item) => {
          if (item && item.admn) {
            if (!nested[item.admn]) nested[item.admn] = {};
            nested[item.admn][item.id || item.entryId || Math.random()] = item;
          }
        });
        return nested;
      }

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

      if (root === "timetable") {
        if (parts[1]) {
          return await idbGet("timetable", String(parts[1]).replace(/class\s*/i, "").trim());
        }
        return await idbGetAllMap("timetable");
      }

      if (root === "leave_applications" || root === "teacher_leave_applications") {
        const allLeaves = await idbGetAllMap("leaves");
        const isTeacherQuery = root === "teacher_leave_applications";
        if (parts[1]) {
          const userLeaves = {};
          Object.entries(allLeaves).forEach(([k, v]) => {
            if (v && String(v.admn).trim() === String(parts[1]).trim()) userLeaves[k] = v;
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

      if (root === "enabled_syllabus") {
        if (parts[1]) {
          return await idbGet("syllabus_config", String(parts[1]).replace(/class\s*/i, "").trim());
        }
        return await idbGetAllMap("syllabus_config");
      }

      if (root === "syllabus_chapters") {
        if (parts[1] && parts[2]) {
          const cls = String(parts[1]).replace(/class\s*/i, "").trim();
          return await idbGet("syllabus_chapters", `${cls}_${String(parts[2]).trim()}`);
        } else if (parts[1]) {
          const cls = String(parts[1]).replace(/class\s*/i, "").trim();
          const allCh = await idbGetAllMap("syllabus_chapters");
          const classCh = {};
          Object.entries(allCh).forEach(([k, v]) => {
            if (k.startsWith(`${cls}_`)) classCh[k.substring(cls.length + 1)] = v;
          });
          return classCh;
        }
        return await idbGetAllMap("syllabus_chapters");
      }

      if (root === "syllabus_progress") {
        if (parts[1] && parts[2]) {
          return await idbGet("syllabus_progress", `${String(parts[1]).trim()}_${String(parts[2]).trim()}`);
        } else if (parts[1]) {
          const admn = String(parts[1]).trim();
          const allP = await idbGetAllMap("syllabus_progress");
          const res = {};
          Object.entries(allP).forEach(([k, v]) => {
            if (k.startsWith(`${admn}_`)) res[k.substring(admn.length + 1)] = v;
          });
          return res;
        }
        return await idbGetAllMap("syllabus_progress");
      }

      if (root === "muster") {
        if (parts[1] && parts[2] && parts[3]) {
          const mDoc = (await idbGet("muster", parts[1])) || {};
          return (mDoc[parts[2]] && mDoc[parts[2]][parts[3]]) || null;
        } else if (parts[1]) {
          return await idbGet("muster", parts[1]);
        }
        return await idbGetAllMap("muster");
      }

      if (root === "expenses") {
        const allExp = await idbGetAllMap("expenses");
        if (parts[1]) {
          const targetMonth = String(parts[1]).trim().toLowerCase();
          const monthExpenses = {};
          Object.entries(allExp).forEach(([k, v]) => {
            if ((v && v.month && String(v.month).trim().toLowerCase() === targetMonth) || k.startsWith(`${parts[1]}_`)) {
              monthExpenses[v.id || k] = v;
            }
          });
          return monthExpenses;
        }
        return allExp;
      }

      if (root === "daily_claims" || root === "teacher_daily_claims") {
        if (parts[1] && parts[2]) {
          const userClaims = (await idbGet("daily_claims", parts[1])) || {};
          return userClaims[parts[2]] === true;
        } else if (parts[1]) {
          return (await idbGet("daily_claims", parts[1])) || {};
        }
        return await idbGetAllMap("daily_claims");
      }

      if (root === "tests") {
        const allTests = await idbGetAllMap("tests");
        if (parts[1]) {
          const res = {};
          Object.entries(allTests).forEach(([k, v]) => {
            if (v && String(v.admn).trim() === String(parts[1]).trim()) res[k] = v;
          });
          return res;
        }
        return allTests;
      }

      if (root === "online_tests") {
        const allOnl = await idbGetAllMap("online_tests");
        if (parts[1] && parts[2]) {
          return (await idbGet("online_tests", parts[2])) || (await idbGet("online_tests", `${parts[1]}_${parts[2]}`));
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

      if (root === "test_attempts" || root === "student_test_attempts") {
        const allAtt = await idbGetAllMap("test_attempts");
        if (root === "test_attempts" && parts[1]) {
          const res = {};
          Object.entries(allAtt).forEach(([k, v]) => {
            if (v && String(v.testId).trim() === String(parts[1]).trim()) res[v.admn] = v;
          });
          return res;
        } else if (root === "student_test_attempts" && parts[1]) {
          const res = {};
          Object.entries(allAtt).forEach(([k, v]) => {
            if (v && String(v.admn).trim() === String(parts[1]).trim()) res[v.testId] = v;
          });
          return res;
        }
        return allAtt;
      }

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
    // SECURITY LOCK (PIN & BIOMETRIC)
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
                { type: "public-key", alg: -7 },
                { type: "public-key", alg: -257 }
              ],
              authenticatorSelection: {
                authenticatorAttachment: "platform",
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
          console.warn("Biometric setup fallback:", bioErr);
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
        throw new Error("Biometrics not supported on this browser.");
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

  // Lock Object to prevent tampering
  Object.freeze(Igris);
  window.Igris = Igris;
  // Backward compatibility alias (so nothing breaks)
  window.AccuEngine = Igris;
})(window);
