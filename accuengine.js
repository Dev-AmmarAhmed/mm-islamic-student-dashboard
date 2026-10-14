/**
 * AccuEngine v5.0 - Military-Grade AES-GCM Client Encrypted Cache
 * MM Islamic English School ERP
 * Transparent Client-Side Encryption with Auto-Migration for Legacy Data
 */

(function (window) {
  "use strict";

  const DB_NAME = "AccuEngine_Storage";
  const DB_VERSION = 9;
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
  // 1. INDEXEDDB CONNECTION
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

    // Nayi 256-bit AES-GCM key generate karna
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
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV
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
      console.warn("Encryption failed, falling back to raw payload:", e);
      return plainObj;
    }
  }

  async function decryptPayload(storedRecord, storeName = null, key = null) {
    if (storedRecord === null || storedRecord === undefined) return null;

    // Check agar record pehle se unencrypted legacy format mein hai (Auto Migration trigger)
    if (!storedRecord.__enc || !storedRecord.iv || !storedRecord.data) {
      if (storeName && key && idbInstance) {
        // Silently encrypt and save in background
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
      console.warn("Decryption failed:", e);
      return null;
    }
  }

  // ----------------------------------------------------
  // 3. TRANSPARENT CRUD OPERATIONS (ENCRYPT ON WRITE, DECRYPT ON READ)
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
  // 4. MASTER ACCUENGINE CONTROLLER
  // ----------------------------------------------------
  const AccuEngine = {
    init: function (config) {
      modules = config;
      getOrCreateCryptoKey().then(() => {
        console.log("🔒 [AccuEngine v5.0] AES-GCM Encrypted Cache Active.");
      });
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

        // 1. Students Encrypted Batch
        const studentsMap = {};
        studentsSnap.forEach((d) => { studentsMap[d.id] = d.data(); });
        await idbSetBatch("students", studentsMap);

        // 2. Teachers Encrypted Batch
        const teachersMap = {};
        teachersSnap.forEach((d) => { teachersMap[d.id] = d.data(); });
        await idbSetBatch("teachers", teachersMap);

        // 3. Users Encrypted Batch
        const usersMap = {};
        usersSnap.forEach((d) => { usersMap[d.id] = d.data(); });
        await idbSetBatch("users", usersMap);

        // 4. Fees Matrix Encrypted Batch
        const feesMap = {};
        feesMatrixSnap.forEach((d) => {
          const dt = d.data();
          feesMap[d.id] = dt.matrix || dt;
        });
        await idbSetBatch("fees_matrix", feesMap);

        // 5. Fees Entries Encrypted Batch
        const entriesMap = {};
        feesEntriesSnap.forEach((d) => { entriesMap[d.id] = d.data(); });
        await idbSetBatch("fees_entries", entriesMap);

        // 6. Attendance Encrypted Batch
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

    // 🚀 READ DATA (Auto Decrypted on the fly)
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
    }
  };

  window.AccuEngine = AccuEngine;
})(window);
