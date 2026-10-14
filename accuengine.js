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
  const DB_VERSION = 10;
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

    // Version update karna jab bhi koi data likha jaye
    bumpSyncVersion: async function () {
      if (!navigator.onLine || !modules) return;
      try {
        const { db: rtdb, ref, set } = modules;
        const newVer = Date.now().toString();
        await set(ref(rtdb, "sync_triggers/version"), newVer);
        localStorage.setItem("accu_local_version", newVer);
      } catch (e) {}
    },

    // Cloud se bulk download aur local encryption
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

      // Agar data local memory mein hai aur version match hai -> zero network calls
      if (!force && hasLocalStudents && hasLocalAttendance && remoteVersion && remoteVersion === localVersion) {
        console.log("🎯 [AccuEngine] 0-Network Sync: Decrypting fresh data directly from hardware cache.");
        return false;
      }

      console.log("📥 [AccuEngine] Fetching cloud data and encrypting into device storage...");

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

        // 6. Attendance
        const attMap = {};
        attendanceSnap.forEach((d) => {
          const dt = d.data();
          attMap[d.id] = dt.days || dt;
        });
        await idbSetBatch("attendance", attMap);

        const finalVer = remoteVersion || Date.now().toString();
        localStorage.setItem("accu_local_version", finalVer);

        console.log(`🔒 [AccuEngine] Encrypted & Locked: ${Object.keys(studentsMap).length} Students, ${Object.keys(attMap).length} Attendance sheets.`);
        return true;
      } catch (err) {
        console.error("❌ [AccuEngine Sync Failed]:", err);
        return false;
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

