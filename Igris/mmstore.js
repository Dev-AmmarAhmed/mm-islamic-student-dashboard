/**
 * mmstore.js - Enterprise IndexedDB Reactive Storage Engine
 * Data Flow Architecture: User -> mmstore -> Firestore -> mmstore -> UI
 */
(function (global) {
  'use strict';

  const DB_NAME = 'MM_SCHOOL_STORE';
  const DB_VERSION = 1;
  const STORE_RECORDS = 'records';
  const STORE_MUTATIONS = 'sync_queue';

  class MMStore {
    constructor() {
      this.db = null;
      this.listeners = new Map();
      this.firestoreHook = null;
      this.readyPromise = this._init();
    }

    _init() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_RECORDS)) {
            db.createObjectStore(STORE_RECORDS, { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
            db.createObjectStore(STORE_MUTATIONS, { keyPath: 'id', autoIncrement: true });
          }
        };

        req.onsuccess = (event) => {
          this.db = event.target.result;
          console.log('[mmstore] IndexedDB initialized successfully.');
          resolve(this.db);
        };

        req.onerror = (event) => {
          console.error('[mmstore] Database failed to open:', event.target.error);
          reject(event.target.error);
        };
      });
    }

    // Bind bidirectional Firestore pipeline (Phase 2 bridge)
    setFirestoreSyncHandler(handler) {
      if (typeof handler === 'function') {
        this.firestoreHook = handler;
      }
    }

    // Reactive State Subscriptions
    subscribe(key, callback) {
      if (!this.listeners.has(key)) {
        this.listeners.set(key, new Set());
      }
      this.listeners.get(key).add(callback);
      return () => this.listeners.get(key).delete(callback);
    }

    _notify(key, value) {
      if (this.listeners.has(key)) {
        this.listeners.get(key).forEach((cb) => {
          try {
            cb(value);
          } catch (err) {
            console.error(`[mmstore] Subscriber error for key "${key}":`, err);
          }
        });
      }
    }

    // Get item directly from local IndexedDB
    async get(key) {
      await this.readyPromise;
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([STORE_RECORDS], 'readonly');
        const store = tx.objectStore(STORE_RECORDS);
        const req = store.get(key);

        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
      });
    }

    // User -> mmstore -> Firestore -> mmstore execution pipeline
    async set(key, value, syncRemote = true) {
      await this.readyPromise;
      const record = { key, value, updatedAt: Date.now() };

      // 1. Write to local IndexedDB
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction([STORE_RECORDS], 'readwrite');
        const store = tx.objectStore(STORE_RECORDS);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      // 2. Notify local UI subscribers instantly
      this._notify(key, value);

      // 3. Forward mutation to Firestore if enabled
      if (syncRemote && this.firestoreHook) {
        try {
          const remoteAck = await this.firestoreHook('WRITE', key, value);
          if (remoteAck !== undefined) {
            // Firestore returned verified snapshot -> reconcile back to mmstore
            await this.set(key, remoteAck, false);
          }
        } catch (err) {
          console.warn(`[mmstore] Remote write failed, queued locally for replay:`, err);
          await this._queueSyncMutation('WRITE', key, value);
        }
      }
      return value;
    }

    async _queueSyncMutation(action, key, value) {
      const tx = this.db.transaction([STORE_MUTATIONS], 'readwrite');
      const store = tx.objectStore(STORE_MUTATIONS);
      store.add({ action, key, value, timestamp: Date.now() });
    }

    async delete(key, syncRemote = true) {
      await this.readyPromise;
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction([STORE_RECORDS], 'readwrite');
        const store = tx.objectStore(STORE_RECORDS);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      this._notify(key, null);

      if (syncRemote && this.firestoreHook) {
        try {
          await this.firestoreHook('DELETE', key, null);
        } catch (err) {
          await this._queueSyncMutation('DELETE', key, null);
        }
      }
    }
  }

  global.mmstore = new MMStore();
})(window);
