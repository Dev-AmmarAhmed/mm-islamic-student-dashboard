/**
 * ====================================================================
 * IGRIS v9.5 - THE SECURE HARDWARE VAULT & RESILIENT SYNC SENTINEL
 * MM Islamic English School ERP
 * Hardware Encrypted Storage • Auto-Decryption • 0-Read Gatekeeper
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
  let legacyCryptoKeys = [];

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

  async function loadAllAvailableCryptoKeys() {
    if (primaryCryptoKey) return [primaryCryptoKey, ...legacyCryptoKeys];

    const db = await openIDB();
    const keyCandidates = ["accu_device_secret_vault_v1", "igris_device_secret_vault_v2", "accu_device_secret_vault_v2"];
    const foundRawKeys = [];

    await new Promise((resolve) => {
      const tx = db.transaction("secure_keys", "readonly");
      const store = tx.objectStore("secure_keys");
      let completed = 0;

      keyCandidates.forEach((kId) => {
        const req = store.get(kId);
        req.onsuccess = () => {
          if (req.result) foundRawKeys.push(req.result);
          completed++;
          if (completed === keyCandidates.length) resolve();
        };
        req.onerror = () => {
          completed++;
          if (completed === keyCandidates.length) resolve();
        };
      });
    });

    const cryptoKeys = [];
    for (const raw of foundRawKeys) {
      try {
        const k = await crypto.subtle.importKey(
          "raw",
          raw,
          { name: "AES-GCM" },
          false,
          ["encrypt", "decrypt"]
        );
        cryptoKeys.push(k);
      } catch (_) {}
    }

    if (cryptoKeys.length === 0) {
      const newKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      const exportedRaw = await crypto.subtle.exportKey("raw", newKey);

      await new Promise((resolve) => {
        const tx = db.transaction("secure_keys", "readwrite");
        tx.objectStore("secure_keys").put(exportedRaw, "accu_device_secret_vault_v1");
        tx.oncomplete = () => resolve();
      });

      const imported = await crypto.subtle.importKey(
        "raw",
        exportedRaw,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );
      cryptoKeys.push(imported);
    }

    primaryCryptoKey = cryptoKeys[0];
    legacyCryptoKeys = cryptoKeys.slice(1);
    return cryptoKeys;
  }

  async function encryptPayload(plainObj) {
    if (plainObj === null || plainObj === undefined) return null;
    try {
      const keys = await loadAllAvailableCryptoKeys();
      const activeKey = keys[0];
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(JSON.stringify(plainObj));

      const cipherBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        activeKey,
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

    const keys = await loadAllAvailableCryptoKeys();
    const ivBuffer = base64ToArrayBuffer(storedRecord.iv);
    const cipherBuffer = base64ToArrayBuffer(storedRecord.data);

    for (const key of keys) {
      try {
        const decrypted = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
          key,
          cipherBuffer
        );
        const jsonStr = new TextDecoder().decode(decrypted);
        return JSON.parse(jsonStr);
      } catch (err) {}
    }
    return null;
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

  // ----------------------------------------------------
  // IGRIS MASTER CONTROLLER
  // ----------------------------------------------------
  const Igris = {
    isAlive: true,
    signature: IGRIS_SIGNATURE,

    init: function (config) {
      modules = config;
      loadAllAvailableCryptoKeys().then(() => {
        console.log("🛡️ [Igris v9.5] Hardware Vault Initialized.");
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

      // 0-Read strict gate: agar local data pehle se hai aur koi naya version nahi hai toh NO READS
      if (!force && hasLocalData && remoteVersion && remoteVersion === localVersion) {
        return false;
      }
      if (!navigator.onLine && hasLocalData) return false;

      this._syncInProgress = true;

      async function safeFetchCollection(name) {
        try {
          const snap = await getDocs(collection(fsDb, name));
          const map = {};
          snap.forEach(d => { map[d.id] = d.data(); });
          return { name, map };
        } catch (err) {
          return { name, map: {} };
        }
      }

      try {
        const collectionsList = [
          "students", "teachers", "users", "fees_matrix", "fees_entries", 
          "attendance", "study_material", "homework", "timetable", "leaves", 
          "subjects", "syllabus_config", "syllabus_chapters", "syllabus_progress", 
          "muster", "expenses", "daily_claims", "tests", "online_tests", "test_attempts"
        ];

        // Fail-safe parallel download: koi ek collection fail bhi ho tab bhi baaqi save honge
        const results = await Promise.allSettled(collectionsList.map(c => safeFetchCollection(c)));

        for (const res of results) {
          if (res.status === "fulfilled" && res.value) {
            const { name, map } = res.value;
            if (Object.keys(map).length > 0) {
              if (name === "fees_matrix") {
                const cleanFees = {};
                Object.entries(map).forEach(([k, v]) => { cleanFees[k] = v.matrix || v; });
                await idbSetBatch(name, cleanFees);
              } else if (name === "attendance") {
                const cleanAtt = {};
                Object.entries(map).forEach(([k, v]) => { cleanAtt[k] = v.days || v; });
                await idbSetBatch(name, cleanAtt);
              } else if (name === "timetable") {
                const cleanTT = {};
                Object.entries(map).forEach(([k, v]) => { cleanTT[k] = v.schedule || v; });
                await idbSetBatch(name, cleanTT);
              } else {
                await idbSetBatch(name, map);
              }
            }
          }
        }

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

      if (root === "students") {
        if (parts[1]) return await idbGet("students", parts[1]);
        return await idbGetAllMap("students");
      }

      if (root === "teachers") {
        if (parts[1]) return await idbGet("teachers", parts[1]);
        return await idbGetAllMap("teachers");
      }

      if (root === "users") {
        if (parts[1]) return await idbGet("users", parts[1]);
        return await idbGetAllMap("users");
      }

      if (root === "fees_matrix") {
        if (parts[1]) return await idbGet("fees_matrix", parts[1]);
        return await idbGetAllMap("fees_matrix");
      }

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
