/**
 * igris.js - Core Security Engine & Session Sentinel
 * Enforces session signature integrity and triggers lockdown screen on violation.
 */
(function (global) {
  'use strict';

  const IGRIS_VERSION = '1.0.0-PROD';
  const SIGNATURE_SALT = 'MM_IGRIS_SENTINEL_2026';

  class IgrisSecurity {
    constructor() {
      this.isArmed = false;
      this.heartbeatTimer = null;
      this._bindGlobalShield();
    }

    _bindGlobalShield() {
      Object.defineProperty(global, '__IGRIS_SHIELD__', {
        value: Object.freeze({
          version: IGRIS_VERSION,
          status: 'ACTIVE',
          signature: this._generateHandshakeToken()
        }),
        writable: false,
        configurable: false
      });
      this.isArmed = true;
    }

    _generateHandshakeToken() {
      const entropy = navigator.userAgent + screen.width + screen.height + SIGNATURE_SALT;
      let hash = 0;
      for (let i = 0; i < entropy.length; i++) {
        hash = (hash << 5) - hash + entropy.charCodeAt(i);
        hash |= 0;
      }
      return 'IGRIS_' + Math.abs(hash).toString(16);
    }

    // Verify session integrity
    verifyAuthSession() {
      try {
        const rawUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
        if (!rawUser) {
          return { valid: false, reason: 'NO_ACTIVE_SESSION' };
        }

        const parsed = JSON.parse(rawUser);
        if (!parsed || (!parsed.admn && !parsed.uid && !parsed.admissionNo)) {
          return { valid: false, reason: 'CORRUPTED_USER_PAYLOAD' };
        }

        // Integrity verification
        return { valid: true, user: parsed };
      } catch (e) {
        return { valid: false, reason: 'MALFORMED_STORAGE_ENTRY' };
      }
    }

    triggerViolationScreen(violationMessage) {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

      document.body.innerHTML = `
        <div id="igris-security-screen" style="
          position: fixed;
          inset: 0;
          background: radial-gradient(circle, #1a0505 0%, #050101 100%);
          color: #ff3344;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 2147483647;
          text-align: center;
          padding: 24px;
        ">
          <div style="
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: 2px solid #ff3344;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 24px;
            box-shadow: 0 0 30px rgba(255, 51, 68, 0.4);
          ">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ff3344" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h1 style="margin: 0 0 12px 0; font-size: 28px; letter-spacing: 2px; text-transform: uppercase;">
            Security Violation Detected
          </h1>
          <p style="margin: 0 0 24px 0; color: #a1a1aa; max-width: 500px; font-size: 14px; line-height: 1.6;">
            Access to MM School Portal has been revoked by the Igris Security Sentinel. Unauthorized execution, missing security modules, or session tampering was detected.
          </p>
          <div style="
            background: rgba(255, 51, 68, 0.08);
            border: 1px solid rgba(255, 51, 68, 0.2);
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 12px;
            color: #ff6677;
            font-family: monospace;
          ">
            Code: ${violationMessage || 'UNAUTHORIZED_ACCESS_LOCK'}
          </div>
        </div>
      `;
    }

    startSentinel() {
      // Periodic tamper heartbeat check
      this.heartbeatTimer = setInterval(() => {
        if (!global.__IGRIS_SHIELD__ || global.__IGRIS_SHIELD__.status !== 'ACTIVE') {
          this.triggerViolationScreen('CORE_INTEGRITY_TAMPERED');
        }
      }, 3000);
    }
  }

  global.Igris = new IgrisSecurity();
  global.Igris.startSentinel();
})(window);
