/**
 * ====================================================================
 * IGRIS v7.5 - SECURE HARDWARE SENTINEL & BULLETPROOF CACHE
 * M.M ISLAMIC ENGLISH SCHOOL ERP
 * ====================================================================
 */

(function (window) {
  "use strict";

  const IGRIS_SIGNATURE = "IGRIS_CORE_SECURE_VAULT_7789";
  const DB_NAME = "AccuEngine_Storage";
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
  let primaryCryptoKey = null;

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

  const STATIC_SECRET_SALT = "MM_ISLAMIC_IGRIS_VAULT_KEY_2026";

  async function getOrCreateCryptoKey() {
    if (primaryCryptoKey) return primaryCryptoKey;
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(STATIC_SECRET_SALT),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    primaryCryptoKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode("MM_FIXED_SALT_99"),
        iterations: 10000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    return primaryCryptoKey;
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

  async function decryptPayload(storedRecord) {
    if (storedRecord === null || storedRecord === undefined) return null;
    if (!storedRecord.__enc || !storedRecord.iv || !storedRecord.data) {
      return storedRecord;
    }

    try {
      const key = await getOrCreateCryptoKey();
      const ivBuffer = base64ToArrayBuffer(storedRecord.iv);
      const cipherBuffer = base64ToArrayBuffer(storedRecord.data);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
        key,
        cipherBuffer
      );
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
      return storedRecord;
    }
  }

  async function idbGet(storeName, key) {
    try {
      const db = await openIDB();
      const raw = await new Promise((resolve) => {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(String(key));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      return await decryptPayload(raw);
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

      const cleanMap = {};
      for (const [k, v] of Object.entries(rawMap)) {
        const unencrypted = await decryptPayload(v);
        if (unencrypted !== null && unencrypted !== undefined) {
          cleanMap[k] = unencrypted;
        }
      }
      return cleanMap;
    } catch (e) {
      return {};
    }
  }

  const Igris = {
    isAlive: true,
    signature: IGRIS_SIGNATURE,

    init: function (config) {
      modules = config;
      getOrCreateCryptoKey().then(() => {
        console.log("🛡️ [Igris v7.5] Bulletproof Storage Engine Active.");
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

      const localStudents = await idbGetAllMap("students");
      const hasLocalData = Object.keys(localStudents).length > 0;

      if (!force && hasLocalData && remoteVersion && remoteVersion === localVersion) {
        return false;
      }
      if (!navigator.onLine && hasLocalData) {
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

      if (parts.length === 1) {
        return await idbGetAllMap(root);
      } else if (parts.length === 2) {
        return await idbGet(root, parts[1]);
      } else {
        // Nested path handling for attendance, muster etc.
        const all = await idbGetAllMap(root);
        if (root === "attendance" && parts[1] && parts[2]) {
           return (await idbGet("attendance", `${parts[1]}_${parts[2]}`)) || {};
        }
        return await idbGet(root, parts.slice(1).join("_")) || all[parts[1]] || null;
      }
    },

    setLocal: async function (storeName, key, value) {
      if (arguments.length === 2) {
        // Agar sirf storeName aur poora map diya hai
        await idbSetBatch(storeName, key);
      } else {
        await idbSet(storeName, key, value);
      }
    },

    invalidate: async function (storeName, key) {
      await idbSet(storeName, key, null);
    },

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

      const lockConfig = {
        enabled: true,
        userId: String(userId),
        salt: saltStr,
        pinHash: hashedPin,
        biometricEnabled: !!enableBiometrics,
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
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      return await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: "required"
        }
      });
    }
  };

  Object.freeze(Igris);
  window.Igris = Igris;
  window.AccuEngine = Igris;
})(window);
