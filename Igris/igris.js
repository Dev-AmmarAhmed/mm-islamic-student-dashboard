/**
 * igris.js - Enterprise Zero-Egress Security Sentinel
 * Protects session integrity & role authorization purely offline with zero Firebase reads.
 */
(function (global) {
  'use strict';

  const IGRIS_VERSION = '2.0.0-ZERO-EGRESS';
  const CORE_SALT = 'MM_ISLAMIC_ERP_SECURE_SALT_9941_ENTJ';

  class IgrisSecurity {
    constructor() {
      this.isArmed = false;
      this.activeSignature = null;
      this.watchdogTimer = null;
      this._installStorageTraps();
      this._bindGlobalShield();
    }

    _bindGlobalShield() {
      Object.defineProperty(global, '__IGRIS_SHIELD__', {
        value: Object.freeze({
          version: IGRIS_VERSION,
          status: 'ACTIVE',
          mode: 'ZERO_EGRESS_DEFENSE'
        }),
        writable: false,
        configurable: false
      });
      this.isArmed = true;
    }

    // Cryptographic Session Signature (Pure Math - 0 KB Network Egress)
    generateSessionSignature(userId, role, secretPin = "") {
      const payload = `${userId}:${role}:${secretPin}:${CORE_SALT}:${navigator.userAgent.slice(0, 30)}`;
      let hashA = 5381;
      let hashB = 52711;
      for (let i = 0; i < payload.length; i++) {
        const char = payload.charCodeAt(i);
        hashA = (hashA * 33) ^ char;
        hashB = (hashB * 31) ^ char;
      }
      const token = 'IG_' + (hashA >>> 0).toString(16) + (hashB >>> 0).toString(16);
      this.activeSignature = token;
      return token;
    }

    // Seal user session securely
    sealSession(userId, role, secretPin = "") {
      const sig = this.generateSessionSignature(userId, role, secretPin);
      localStorage.setItem('__igris_sig', sig);
      localStorage.setItem('__igris_uid', btoa(String(userId)));
      localStorage.setItem('__igris_role', btoa(String(role)));
      return sig;
    }

    // Validate active session against cryptographic seal
    validateSession() {
      const user = localStorage.getItem('loggedInUser');
      const role = localStorage.getItem('userRole');
      const sig = localStorage.getItem('__igris_sig');
      const storedUid = localStorage.getItem('__igris_uid');
      const storedRole = localStorage.getItem('__igris_role');

      // If no user is logged in, session is clean
      if (!user && !role && !sig) {
        return { valid: true, authenticated: false };
      }

      // If partial credentials exist without signature, it is a tampered login
      if (!sig || !storedUid || !storedRole) {
        this.triggerViolationScreen('SESSION_SIGNATURE_MISSING');
        return { valid: false, authenticated: false };
      }

      try {
        const decodedUid = atob(storedUid);
        const decodedRole = atob(storedRole);

        // Check 1: User or Role mismatch against sealed payload
        if (decodedUid !== String(user) || decodedRole !== String(role)) {
          this.triggerViolationScreen('PRIVILEGE_ESCALATION_ATTEMPT');
          return { valid: false, authenticated: false };
        }

        // Check 2: Cryptographic signature match
        const expectedSig = this.generateSessionSignature(decodedUid, decodedRole);
        if (sig !== expectedSig) {
          this.triggerViolationScreen('CRYPTOGRAPHIC_HASH_MISMATCH');
          return { valid: false, authenticated: false };
        }

        return { valid: true, authenticated: true, user: decodedUid, role: decodedRole };
      } catch (e) {
        this.triggerViolationScreen('CORRUPTED_SECURITY_ENVELOPE');
        return { valid: false, authenticated: false };
      }
    }

    // Install real-time storage tamper trap
    _installStorageTraps() {
      // Catch storage events across tabs
      global.addEventListener('storage', (e) => {
        if (e.key === 'userRole' || e.key === 'loggedInUser' || e.key === '__igris_sig') {
          const res = this.validateSession();
          if (!res.valid) {
            this.triggerViolationScreen('EXTERNAL_STORAGE_MODIFICATION');
          }
        }
      });
    }

    triggerViolationScreen(violationCode) {
      if (this.watchdogTimer) clearInterval(this.watchdogTimer);

      // Wipe potentially compromised keys
      try {
        localStorage.removeItem('userRole');
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('__igris_sig');
        sessionStorage.clear();
      } catch (e) {}

      document.body.innerHTML = `
        <div id="igris-security-screen" style="
          position: fixed;
          inset: 0;
          background: radial-gradient(circle at center, #180505 0%, #030101 100%);
          color: #ff4455;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 2147483647;
          text-align: center;
          padding: 24px;
        ">
          <div style="
            width: 84px;
            height: 84px;
            border-radius: 50%;
            border: 2px solid #ff4455;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 24px;
            box-shadow: 0 0 35px rgba(255, 68, 85, 0.35);
          ">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#ff4455" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h1 style="margin: 0 0 12px 0; font-size: 26px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
            Security Breach Prevented
          </h1>
          <p style="margin: 0 0 24px 0; color: #a1a1aa; max-width: 480px; font-size: 14px; line-height: 1.6;">
            Igris Security Sentinel detected unauthorized session manipulation or client tampering. Access to MM School Portal has been revoked.
          </p>
          <div style="
            background: rgba(255, 68, 85, 0.08);
            border: 1px solid rgba(255, 68, 85, 0.25);
            padding: 10px 22px;
            border-radius: 8px;
            font-size: 12px;
            color: #ff6677;
            font-family: monospace;
            font-weight: 700;
          ">
            CODE: ${violationCode || 'TAMPER_LOCKOUT'}
          </div>
          <button onclick="location.reload()" style="
            margin-top: 24px;
            padding: 10px 24px;
            background: #ff4455;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
          ">
            Return to Safe Login
          </button>
        </div>
      `;
    }

    startSentinel() {
      // Heartbeat checks tamper without contacting any server
      this.watchdogTimer = setInterval(() => {
        if (!global.__IGRIS_SHIELD__ || global.__IGRIS_SHIELD__.status !== 'ACTIVE') {
          this.triggerViolationScreen('SENTINEL_SHIELD_DEACTIVATED');
          return;
        }
        const user = localStorage.getItem('loggedInUser');
        if (user) {
          const check = this.validateSession();
          if (!check.valid) {
            this.triggerViolationScreen('RUNTIME_ROLE_TAMPER');
          }
        }
      }, 2500);
    }
  }

  global.Igris = new IgrisSecurity();
  global.Igris.startSentinel();
})(window);
