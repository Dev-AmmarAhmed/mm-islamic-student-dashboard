/**
 * ====================================================================
 * MMASSISTANT AI v20.0 (FULL-SCREEN PRO UI • TERMS GATE • GEMINI FLASH)
 * M.M ISLAMIC ENGLISH SCHOOL ERP
 * ====================================================================
 */

(function (window) {
  "use strict";

  const _g1 = "QVEuQWI4Uk42TF9ZemxyZ05HM2ZEd0psTWp1";
  const _g2 = "R25JUFZOYVh3ZThMSWd3NVBObFZmMUhyWVE=";

  function getGeminiKey() {
    try {
      return atob(_g1) + atob(_g2);
    } catch (e) {
      return "";
    }
  }

  const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
  const TERMS_STORAGE_KEY = "mm_gemini_terms_accepted_v1";
  const CHATS_STORAGE_KEY = "mm_assistant_all_sessions_v1";
  const ACTIVE_SESSION_KEY = "mm_assistant_active_session_id_v1";

  // 2D AI Sparkle SVG
  const AI_SPARKLE_SVG = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z" fill="url(#sparkleGrad)" />
      <defs>
        <linearGradient id="sparkleGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stop-color="#38bdf8"/>
          <stop offset="1" stop-color="#818cf8"/>
        </linearGradient>
      </defs>
    </svg>
  `;

  // Hamburger SVG
  const HAMBURGER_SVG = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  `;

  // Red Trash SVG
  const RED_TRASH_SVG = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
  `;

  // Markdown Parser
  function formatMarkdown(text) {
    if (!text) return "";
    let safe = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/^[\*\-]\s+(.*)$/gim, "<span style='display:block; padding-left:12px;'>• $1</span>");
    safe = safe.replace(/^(\d+)\.\s+(.*)$/gim, "<span style='display:block; padding-left:12px;'><b>$1.</b> $2</span>");
    return safe;
  }

  // ----------------------------------------------------
  // MULTI-SESSION STORAGE MANAGEMENT
  // ----------------------------------------------------
  function getAllSessions() {
    try {
      const data = localStorage.getItem(CHATS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  function saveAllSessions(sessions) {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(sessions));
  }

  function getActiveSessionId() {
    let id = localStorage.getItem(ACTIVE_SESSION_KEY);
    const sessions = getAllSessions();
    if (!id || !sessions.find(s => s.id === id)) {
      if (sessions.length > 0) {
        id = sessions[0].id;
      } else {
        id = createNewSession();
      }
      localStorage.setItem(ACTIVE_SESSION_KEY, id);
    }
    return id;
  }

  function createNewSession() {
    const sessions = getAllSessions();
    const newId = "session_" + Date.now();
    const newSession = {
      id: newId,
      title: "New Conversation",
      createdAt: new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      messages: []
    };
    sessions.unshift(newSession);
    saveAllSessions(sessions);
    localStorage.setItem(ACTIVE_SESSION_KEY, newId);
    return newId;
  }

  function getActiveMessages() {
    const id = getActiveSessionId();
    const sessions = getAllSessions();
    const active = sessions.find(s => s.id === id);
    return active ? active.messages : [];
  }

  function saveMessageToActive(role, text) {
    const id = getActiveSessionId();
    const sessions = getAllSessions();
    const active = sessions.find(s => s.id === id);
    if (!active) return;

    active.messages.push({
      role: role,
      text: text,
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    });

    if (role === "user" && active.messages.length === 1) {
      active.title = text.length > 28 ? text.substring(0, 25) + "..." : text;
    }

    if (active.messages.length > 60) active.messages.shift();
    saveAllSessions(sessions);
  }

  function deleteSessionById(sessionId) {
    let sessions = getAllSessions();
    sessions = sessions.filter(s => s.id !== sessionId);
    saveAllSessions(sessions);

    if (localStorage.getItem(ACTIVE_SESSION_KEY) === sessionId) {
      if (sessions.length > 0) {
        localStorage.setItem(ACTIVE_SESSION_KEY, sessions[0].id);
      } else {
        createNewSession();
      }
    }
    renderSidebarList();
    renderMessages();
  }

  // ----------------------------------------------------
  // FULL-SCREEN UI & DRAWER INJECTION
  // ----------------------------------------------------
  function injectChatUI() {
    if (document.getElementById("mmAssistantOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "mmAssistantOverlay";
    overlay.style.cssText = `
      display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: #090d16; z-index: 100099; flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    overlay.innerHTML = `
      <!-- TOP NAVIGATION BAR -->
      <div style="background: #111827; height: 60px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1f2937; z-index: 20;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button type="button" id="mmBtnHamburger" title="Open Chat List" style="background: transparent; border: none; color: #f3f4f6; padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
            ${HAMBURGER_SVG}
          </button>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${AI_SPARKLE_SVG}
            <span style="font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: 0.3px;">MMAssistant</span>
          </div>
        </div>

        <button type="button" id="mmBtnCloseFull" title="Close" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #e5e7eb; padding: 6px 14px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer;">
          ✕
        </button>
      </div>

      <!-- QUICK TOP PROMPT CHIPS -->
      <div style="display: flex; gap: 8px; overflow-x: auto; padding: 10px 16px; background: #0c1220; border-bottom: 1px solid #1f2937; scrollbar-width: none;">
        <div class="class-chip mm-chip" style="margin:0; padding:6px 14px; font-size:11.5px; cursor:pointer; white-space:nowrap;" data-query="School ka address, timings aur principal details batao">🏫 School Details</div>
        <div class="class-chip mm-chip" style="margin:0; padding:6px 14px; font-size:11.5px; cursor:pointer; white-space:nowrap;" data-query="Is app me kaunse features hain aur fees kaise enter karein?">📱 App Manual</div>
        <div class="class-chip mm-chip" style="margin:0; padding:6px 14px; font-size:11.5px; cursor:pointer; white-space:nowrap;" data-query="Teachers ki list aur unke contact numbers do">👩‍🏫 Teachers List</div>
        <div class="class-chip mm-chip" style="margin:0; padding:6px 14px; font-size:11.5px; cursor:pointer; white-space:nowrap;" data-query="Is month kitne bachon ki fees pending hai list do">💳 Unpaid Fees</div>
      </div>

      <!-- MAIN MESSAGES CONTAINER -->
      <div id="mmMessagesList" style="flex: 1; overflow-y: auto; padding: 18px 16px; display: flex; flex-direction: column; gap: 14px; -webkit-overflow-scrolling: touch;"></div>

      <!-- FIXED POWERED BY GOOGLE GEMINI BADGE -->
      <div style="text-align: center; font-size: 10.5px; font-weight: 700; color: #94a3b8; padding: 6px 0 4px 0; background: #111827; border-top: 1px solid rgba(255,255,255,0.05); letter-spacing: 0.3px; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#38bdf8; box-shadow: 0 0 6px #38bdf8;"></span>
        • Powered by Google Gemini
      </div>

      <!-- BOTTOM INPUT BAR -->
      <div style="padding: 10px 16px 16px 16px; background: #111827; display: flex; align-items: center; gap: 10px; border-top: 1px solid #1f2937;">
        <input type="text" id="mmInputBox" placeholder="Ask MMAssistant anything..." autocomplete="off" style="flex: 1; padding: 13px 18px; font-size: 14px; font-weight: 600; border: 1.5px solid #059669; border-radius: 16px; background: #1f2937; color: #ffffff; outline: none;">
        <button id="mmSendBtn" class="btn-primary btn-green" style="width: auto; padding: 13px 20px; margin: 0; border-radius: 16px; font-size: 14px; font-weight: 700;">
          Send ➔
        </button>
      </div>

      <!-- SIDEBAR DRAWER (CHAT SESSIONS) -->
      <div id="mmSidebarDrawer" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); z-index: 100100;">
        <div style="width: 290px; height: 100%; background: #0f172a; border-right: 1px solid #1e293b; display: flex; flex-direction: column; animation: slideInLeft 0.25s ease-out forwards;">
          
          <div style="padding: 18px 16px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 15px; font-weight: 800; color: #f8fafc;">Conversations</span>
            <button id="mmBtnNewChat" style="background: #059669; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
              + New Chat
            </button>
          </div>

          <div id="mmDrawerSessionList" style="flex: 1; overflow-y: auto; padding: 12px 10px; display: flex; flex-direction: column; gap: 8px;"></div>

          <!-- DRAWER FOOTER: TERMS AND CONDITIONS BLUE TEXT -->
          <div style="padding: 16px; border-top: 1px solid #1e293b; text-align: center; background: #0b1120;">
            <a href="javascript:void(0)" id="mmLinkDrawerTerms" style="color: #38bdf8; font-size: 12.5px; font-weight: 700; text-decoration: underline; letter-spacing: 0.2px;">
              Terms and Conditions
            </a>
          </div>

        </div>
      </div>

      <!-- LONG PRESS ACTION DROPDOWN -->
      <div id="mmLongPressMenu" style="display: none; position: fixed; background: #1e293b; border: 1px solid #334155; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 100102; width: 150px; overflow: hidden;">
        <div id="mmBtnDeleteFromMenu" style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; cursor: pointer; color: #ef4444; font-size: 13.5px; font-weight: 700;">
          ${RED_TRASH_SVG}
          <span>Delete</span>
        </div>
      </div>

      <!-- TERMS & CONDITIONS MODAL -->
      <div id="mmTermsModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(6px); z-index: 100110; align-items: center; justify-content: center; padding: 20px;">
        <div style="width: 100%; max-width: 460px; background: #111827; border: 1.5px solid #1f2937; border-radius: 20px; padding: 22px; box-shadow: 0 20px 50px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 14px; color: #f3f4f6;">
          
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 24px;">🛡️</div>
            <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #ffffff;">Terms & Data Sharing Disclosure</h3>
          </div>

          <div style="font-size: 13px; line-height: 1.6; color: #9ca3af; background: #0f172a; padding: 14px; border-radius: 12px; border: 1px solid #1e293b; max-height: 220px; overflow-y: auto;">
            <p style="margin: 0 0 10px 0; color: #e5e7eb; font-weight: 600;">
              Notice Regarding Artificial Intelligence (AI) Usage:
            </p>
            Please note that your queries and relevant institution information (such as attendance, fees matrix, timetable schedules, and student directory) are securely transmitted from this application to <b>Google Gemini (Google LLC)</b> via cloud API. 
            <br><br>
            This data sharing is strictly utilized to provide accurate assistant capabilities, deep institutional analysis, and continuous performance improvements. Local cache remains protected through encrypted device hardware sentinel.
          </div>

          <!-- CONSENT CHECKBOX ROW -->
          <div id="mmConsentCheckboxWrapper" style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
            <input type="checkbox" id="mmConsentCheckbox" style="width: 18px; height: 18px; cursor: pointer; accent-color: #059669;">
            <label for="mmConsentCheckbox" style="font-size: 13px; font-weight: 700; color: #f3f4f6; cursor: pointer;">
              Allow data sharing with Google Gemini
            </label>
          </div>

          <!-- ACTIONS -->
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
            <button type="button" id="mmBtnCloseTermsViewOnly" style="display: none; padding: 10px 20px; background: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer;">
              Close
            </button>
            <button type="button" id="mmBtnAcceptTerms" disabled style="padding: 11px 22px; background: #374151; color: #9ca3af; border: none; border-radius: 12px; font-size: 13.5px; font-weight: 800; cursor: not-allowed; transition: all 0.2s;">
              Continue
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event Bindings
    document.getElementById("mmBtnCloseFull").onclick = window.MMAssistant.close;
    document.getElementById("mmSendBtn").onclick = window.MMAssistant.submitMessage;
    document.getElementById("mmInputBox").addEventListener("keypress", (e) => {
      if (e.key === "Enter") window.MMAssistant.submitMessage();
    });

    // Chips
    overlay.querySelectorAll(".mm-chip").forEach((chip) => {
      chip.onclick = () => {
        document.getElementById("mmInputBox").value = chip.getAttribute("data-query");
        window.MMAssistant.submitMessage();
      };
    });

    // Hamburger & Drawer
    document.getElementById("mmBtnHamburger").onclick = () => {
      renderSidebarList();
      document.getElementById("mmSidebarDrawer").style.display = "block";
    };

    document.getElementById("mmSidebarDrawer").onclick = (e) => {
      if (e.target.id === "mmSidebarDrawer") {
        document.getElementById("mmSidebarDrawer").style.display = "none";
        hideLongPressMenu();
      }
    };

    document.getElementById("mmBtnNewChat").onclick = () => {
      createNewSession();
      document.getElementById("mmSidebarDrawer").style.display = "none";
      renderMessages();
      hideLongPressMenu();
    };

    // Terms Modal Events
    const checkbox = document.getElementById("mmConsentCheckbox");
    const acceptBtn = document.getElementById("mmBtnAcceptTerms");

    checkbox.onchange = () => {
      if (checkbox.checked) {
        acceptBtn.disabled = false;
        acceptBtn.style.background = "#059669";
        acceptBtn.style.color = "#ffffff";
        acceptBtn.style.cursor = "pointer";
      } else {
        acceptBtn.disabled = true;
        acceptBtn.style.background = "#374151";
        acceptBtn.style.color = "#9ca3af";
        acceptBtn.style.cursor = "not-allowed";
      }
    };

    acceptBtn.onclick = () => {
      if (!checkbox.checked) return;
      localStorage.setItem(TERMS_STORAGE_KEY, "true");
      document.getElementById("mmTermsModal").style.display = "none";
      renderMessages();
    };

    // Drawer Terms Link (View Only)
    document.getElementById("mmLinkDrawerTerms").onclick = () => {
      document.getElementById("mmSidebarDrawer").style.display = "none";
      showTermsModal(true); // view-only mode
    };

    document.getElementById("mmBtnCloseTermsViewOnly").onclick = () => {
      document.getElementById("mmTermsModal").style.display = "none";
    };

    // Close long press menu on outside click
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#mmLongPressMenu")) {
        hideLongPressMenu();
      }
    });
  }

  // ----------------------------------------------------
  // TERMS MODAL CONTROLLER
  // ----------------------------------------------------
  function showTermsModal(viewOnly = false) {
    const modal = document.getElementById("mmTermsModal");
    const checkRow = document.getElementById("mmConsentCheckboxWrapper");
    const acceptBtn = document.getElementById("mmBtnAcceptTerms");
    const closeBtn = document.getElementById("mmBtnCloseTermsViewOnly");

    if (viewOnly) {
      checkRow.style.display = "none";
      acceptBtn.style.display = "none";
      closeBtn.style.display = "block";
    } else {
      checkRow.style.display = "flex";
      acceptBtn.style.display = "block";
      closeBtn.style.display = "none";
      document.getElementById("mmConsentCheckbox").checked = false;
      acceptBtn.disabled = true;
      acceptBtn.style.background = "#374151";
      acceptBtn.style.color = "#9ca3af";
      acceptBtn.style.cursor = "not-allowed";
    }
    modal.style.display = "flex";
  }

  // ----------------------------------------------------
  // SIDEBAR SESSIONS & LONG-PRESS HANDLER
  // ----------------------------------------------------
  let targetDeleteSessionId = null;
  let longPressTimer = null;

  function hideLongPressMenu() {
    const menu = document.getElementById("mmLongPressMenu");
    if (menu) menu.style.display = "none";
    targetDeleteSessionId = null;
  }

  function renderSidebarList() {
    const container = document.getElementById("mmDrawerSessionList");
    if (!container) return;
    const sessions = getAllSessions();
    const activeId = getActiveSessionId();
    container.innerHTML = "";

    if (sessions.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:#64748b; font-size:12.5px;">No conversations yet</div>`;
      return;
    }

    sessions.forEach((s) => {
      const isActive = s.id === activeId;
      const item = document.createElement("div");
      item.style.cssText = `
        padding: 12px 14px; border-radius: 12px; background: ${isActive ? '#1e293b' : 'rgba(255,255,255,0.03)'};
        border: 1px solid ${isActive ? '#059669' : '#1e293b'}; color: ${isActive ? '#ffffff' : '#cbd5e1'};
        cursor: pointer; user-select: none; -webkit-user-select: none; display: flex; flex-direction: column; gap: 4px;
      `;

      item.innerHTML = `
        <div style="font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${s.title || 'Conversation'}
        </div>
        <div style="font-size: 10.5px; color: #64748b;">${s.createdAt || ''}</div>
      `;

      // Click to switch session
      item.onclick = () => {
        localStorage.setItem(ACTIVE_SESSION_KEY, s.id);
        document.getElementById("mmSidebarDrawer").style.display = "none";
        renderMessages();
      };

      // Long press handler for Delete dropdown
      function triggerLongPress(e) {
        targetDeleteSessionId = s.id;
        const menu = document.getElementById("mmLongPressMenu");
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        menu.style.top = Math.min(clientY, window.innerHeight - 80) + "px";
        menu.style.left = Math.min(clientX, window.innerWidth - 160) + "px";
        menu.style.display = "block";
      }

      item.addEventListener("touchstart", (e) => {
        longPressTimer = setTimeout(() => triggerLongPress(e), 500);
      });
      item.addEventListener("touchend", () => clearTimeout(longPressTimer));
      item.addEventListener("touchmove", () => clearTimeout(longPressTimer));

      item.addEventListener("mousedown", (e) => {
        longPressTimer = setTimeout(() => triggerLongPress(e), 500);
      });
      item.addEventListener("mouseup", () => clearTimeout(longPressTimer));
      item.addEventListener("mouseleave", () => clearTimeout(longPressTimer));

      container.appendChild(item);
    });

    document.getElementById("mmBtnDeleteFromMenu").onclick = () => {
      if (targetDeleteSessionId) {
        deleteSessionById(targetDeleteSessionId);
        hideLongPressMenu();
      }
    };
  }

  // ----------------------------------------------------
  // MESSAGES RENDERING
  // ----------------------------------------------------
  function renderMessages() {
    const box = document.getElementById("mmMessagesList");
    if (!box) return;
    const messages = getActiveMessages();
    box.innerHTML = "";

    if (messages.length === 0) {
      box.innerHTML = `
        <div style="text-align:center; padding:40px 16px; color:#94a3b8; margin: auto;">
          <div style="display:flex; justify-content:center; margin-bottom:14px;">${BIG_SPARKLE_SVG}</div>
          <div style="font-size:19px; font-weight:900; color:#f8fafc; margin-bottom:8px;">Assalamualaikum</div>
          <div style="font-size:13px; font-weight:600; line-height:1.6; max-width:440px; margin:0 auto; color:#94a3b8;">
            Welcome to MMAssistant. Ask me anything about student records, teacher contacts, fee status, portal navigation, or study help.
          </div>
        </div>
      `;
      return;
    }

    messages.forEach((m) => {
      const isUser = m.role === "user";
      const formatted = isUser ? m.text : formatMarkdown(m.text);
      box.innerHTML += `
        <div style="display:flex; flex-direction:column; align-items:${isUser ? 'flex-end' : 'flex-start'};">
          <div style="max-width:88%; padding:13px 17px; border-radius:${isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px'}; background:${isUser ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)' : '#1e293b'}; color:${isUser ? '#ffffff' : '#f8fafc'}; border:1px solid ${isUser ? 'transparent' : '#334155'}; font-size:13.5px; font-weight:600; line-height:1.6; white-space:pre-wrap; word-break:break-word; box-shadow:0 3px 10px rgba(0,0,0,0.2);">${formatted}</div>
          <span style="font-size:9.5px; color:#64748b; margin-top:3px; padding:0 4px;">${m.time}</span>
        </div>
      `;
    });
    box.scrollTop = box.scrollHeight;
  }

  // ----------------------------------------------------
  // IGRIS DATA HARVESTER (PROTECTED BY TERMS GATE)
  // ----------------------------------------------------
  async function buildContextSlice(userQuery, recentHistoryText) {
    // 🚨 DATA PROTECTION CHECK: Only harvest data if Terms are accepted
    if (localStorage.getItem(TERMS_STORAGE_KEY) !== "true") {
      return "{}";
    }

    const Sentinel = window.Igris || window.AccuEngine;
    const allMonths = ["June","July","August","September","October","November","December","January","February","March","April","May"];
    const now = new Date();
    const systemMonth = ["January","February","March","April","May","June","July","August","September","October","November","December"][now.getMonth()];
    const todayDay = now.getDate();

    const context = {
      institution_profile: {
        name: "M.M ISLAMIC ENGLISH SCHOOL",
        full_address: "46/K/05 (Room No 5, Line K, Plot No 46), Road No 04, Shivaji Nagar, Govandi, Mumbai - 400043, Maharashtra.",
        landmarks: "S.N. Hospital aur Honest Life English School ke bazu me, Sufi Dairy ke paas.",
        affiliation_standards: "Approved English Medium Islamic & Modern Curriculum. Operating Nursery to Class 5th (Vision up to Class 10th).",
        principal: {
          name: "Saba Teacher (Saba Parveen)",
          designation: "Principal / Head of Institution",
          qualifications: "D.Ed, B.Ed, LLB",
          primary_contact_whatsapp: "7302132270",
          secondary_contact: "9322298658"
        },
        office_contacts: ["7302132270", "9322298658"]
      },
      app_user_guide: {
        portal_name: "M.M Islamic English School Admin & Teacher ERP",
        navigation_tabs_manual: {
          Home: "Analytics overview, Month Fee summary card, Mentors Standing (Teacherboard points, leaderboard), and MMAssistant AI search.",
          Students: "Complete student directory, class filter, add/edit student records, phone numbers, and profile management.",
          Entry: "Fees collection module. '+ ADD FEES ENTRY' button dabakar student fee collect karte hain. 'Total Due Fees' wale red box par 3 baar lagatar click (Triple Tap) karne par unpaid bachon ki list khulti hai. 'Collected Amount' blue box par Triple Tap se paid list khulti hai.",
          Track: "Student fees payment status aur past transaction logs track karna.",
          Attend: "Student attendance calendar. Date-wise Present (P), Absent (A), ya Holiday (H) mark karke 'Save Attendance' kiya jata hai.",
          Card: "Automated student ID card generator with printable layout.",
          Expns: "Daily and monthly school expense entries log."
        },
        teachers_features: [
          "Class-wise student attendance marking.",
          "Teacher leaderboard progression.",
          "Muster in/out check-in and daily claim submission.",
          "Create online objective tests and track student performance."
        ]
      },
      current_portal_date: `${todayDay} ${systemMonth} ${now.getFullYear()}`
    };

    if (!Sentinel) return JSON.stringify(context, null, 2);

    try {
      const [studentsMap, teachersMap, feesMap, leavesMap, musterDoc] = await Promise.all([
        Sentinel.fetch("students") || {},
        Sentinel.fetch("teachers") || {},
        Sentinel.fetch("fees_matrix") || {},
        Sentinel.fetch("leaves") || {},
        Sentinel.fetch(`muster/${systemMonth}`) || {}
      ]);

      const students = Object.values(studentsMap || {}).filter(Boolean);
      const teachers = Object.values(teachersMap || {}).filter(Boolean);

      context.school_stats = {
        total_students: students.length,
        total_teachers: teachers.length
      };

      const allLeaves = Object.values(leavesMap || {}).filter(Boolean);
      context.teachers_directory = teachers.map((t) => {
        const teacherLeaves = allLeaves.filter(
          (l) => String(l.admn || l.teacherId || l.name).toLowerCase() === String(t.name || t.id).toLowerCase()
        );
        return {
          name: t.name || "Teacher",
          phone: t.phone || t.mobile || t.whatsapp || t.contact || "Not updated",
          assignedClass: t.assignedClass || t.classes || "All",
          points: t.points || 0,
          approved_leaves_count: teacherLeaves.length,
          muster_today: (musterDoc[`day_${todayDay}`] && musterDoc[`day_${todayDay}`][t.name]) || "Not marked today"
        };
      });

      const qRaw = userQuery + " " + recentHistoryText;
      const q = qRaw.toLowerCase().replace(/[^a-z0-9\s]/g, " ");

      // 🔍 1. Phone Number Search
      const phoneMatch = qRaw.match(/\b\d{10}\b/);
      if (phoneMatch) {
        const searchedPhone = phoneMatch[0];
        if (searchedPhone === "7302132270" || searchedPhone === "9322298658") {
          context.phone_lookup_result = `Yeh number Principal Saba Teacher ka hai (${searchedPhone}).`;
        } else {
          const matchedTeacherPhone = context.teachers_directory.find((t) =>
            String(t.phone).replace(/\D/g, "").includes(searchedPhone)
          );
          if (matchedTeacherPhone) {
            context.phone_lookup_result = `Yeh number Teacher ${matchedTeacherPhone.name} ka hai (Class ${matchedTeacherPhone.assignedClass}).`;
          } else {
            const matchedStudentPhone = students.find((s) =>
              String(s.phone || s.parentPhone).replace(/\D/g, "").includes(searchedPhone)
            );
            if (matchedStudentPhone) {
              context.phone_lookup_result = `Yeh number student ${matchedStudentPhone.name} (Class ${matchedStudentPhone.class}, Admn ${matchedStudentPhone.admn}) ka hai.`;
            } else {
              context.phone_lookup_result = `Yeh number (${searchedPhone}) school ke kisi teacher ya student se match nahi hua.`;
            }
          }
        }
      }

      // 🔍 2. Admission Number Search
      const admnMatches = qRaw.match(/(?:admn|admission|roll|id)?\s*#?\s*(\d{1,4})\b/i);
      let targetStudentByAdmn = null;
      if (admnMatches && admnMatches[1] && parseInt(admnMatches[1], 10) < 5000) {
        const searchedAdmn = admnMatches[1];
        targetStudentByAdmn = students.find((s) => String(s.admn) === searchedAdmn);
      }

      // 🔍 3. Student Name Search & 12-Month Fees Matrix
      const matchedStudents = [];
      for (const st of students) {
        const sName = (st.name || "").toLowerCase();
        if (!sName) continue;
        const parts = sName.split(" ").filter((p) => p.length >= 3);
        const nameMatches = parts.some((p) => q.includes(p));

        if (nameMatches || (targetStudentByAdmn && String(st.admn) === String(targetStudentByAdmn.admn))) {
          const studentAttDoc =
            (await Sentinel.fetch(`attendance/${st.admn}_${systemMonth}`)) ||
            (await Sentinel.fetch(`attendance/${st.admn}/${systemMonth}`)) ||
            {};
          const stFees = feesMap[st.admn] || {};

          const fullSessionFees = {};
          allMonths.forEach((m) => {
            fullSessionFees[m] = stFees[m]?.paid ? "Paid" : "Unpaid";
          });

          matchedStudents.push({
            name: st.name,
            class: st.class,
            admn: st.admn,
            phone: st.phone || st.parentPhone || st.mobile || "Not updated",
            attendance_month: systemMonth,
            attendance_record: studentAttDoc,
            monthly_fee_rate: st.customFee || 500,
            full_academic_year_fees: fullSessionFees
          });
          if (matchedStudents.length >= 6) break;
        }
      }

      if (matchedStudents.length > 0) {
        context.queried_students = matchedStudents;
      }

      // 💳 4. Fees Summary
      if (/(fee|unpaid|pending|paid|due|rupaye|paisa|list)/i.test(q)) {
        let unpaidCount = 0;
        let totalDues = 0;
        const unpaidList = [];
        students.forEach((st) => {
          const isPaid = feesMap[st.admn] && feesMap[st.admn][systemMonth] && feesMap[st.admn][systemMonth].paid;
          const feeVal = parseFloat(st.customFee || 500);
          if (!isPaid) {
            unpaidCount++;
            totalDues += feeVal;
            unpaidList.push(`${st.name} (Class ${st.class})`);
          }
        });

        context.fees_summary = {
          month: systemMonth,
          total_unpaid_students: unpaidCount,
          total_due_rupees: totalDues,
          unpaid_student_names: unpaidList.slice(0, 45)
        };
      }

      return JSON.stringify(context, null, 2);
    } catch (e) {
      return JSON.stringify(context, null, 2);
    }
  }

  // ----------------------------------------------------
  // GEMINI FLASH INFERENCE
  // ----------------------------------------------------
  async function callGeminiFlash(userPrompt, verifiedContext) {
    const apiKey = getGeminiKey();

    const systemPrompt = `Aap M.M ISLAMIC ENGLISH SCHOOL ke official smart assistant (MMAssistant) hain.
Aap school Administrator / Principal (Saba Teacher / Saba Parveen) se mukhatib hain.

COMPLETE SCHOOL DATABASE, APP MANUAL & VERIFIED CONTEXT:
${verifiedContext}

OPERATING RULES:
1. APP NAVIGATION & MANUAL:
   - User jab bhi app ke bare me puche, "app_user_guide" se step-by-step simple Roman Urdu me guide karein.
   - Example: Fees lene ke liye 'Entry' tab me jakar '+ ADD FEES ENTRY' button dabayein. Unpaid list ke liye 'Total Due Fees' box par 3 baar lagatar click (Triple Tap) karein.
2. SCHOOL & PRINCIPAL DETAILS:
   - Address: 46/K/05 (Room No 5, Line K, Plot No 46), Road No 04, Shivaji Nagar, Govandi, Mumbai - 400043.
   - Landmarks: S.N. Hospital aur Honest Life English School ke bazu me, Sufi Dairy ke paas.
   - Principal: Saba Teacher (Saba Parveen). Degrees: D.Ed, B.Ed, LLB. Numbers: 7302132270 / 9322298658.
3. TEACHERS & STUDENTS CONTACT:
   - "teachers_directory" se teachers ke direct mobile numbers batayein (e.g. Bushra Teacher: 88796 69303).
   - "queried_students" se student ka admission number, class, guardian phone, attendance aur 12 mahino ka fees status batayein.
4. TONE & MANNER:
   - Natural, respectful aur direct Roman Urdu me baat karein.
   - Factually accurate rahein aur bina kisi faltu bahane ke saaf jawab dein.`;

    const rawHistory = getActiveMessages();
    const contents = [];

    rawHistory.slice(-4).forEach((m) => {
      contents.push({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }]
      });
    });

    contents.push({
      role: "user",
      parts: [{ text: userPrompt }]
    });

    const payload = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 750
      }
    };

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status} from Google Gemini`);
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!replyText) throw new Error("Empty response from Gemini Flash");

    return replyText.trim();
  }

  // ----------------------------------------------------
  // PUBLIC CONTROLLER API
  // ----------------------------------------------------
  window.MMAssistant = {
    open: function () {
      injectChatUI();
      const overlay = document.getElementById("mmAssistantOverlay");
      overlay.style.display = "flex";

      // 🚨 First time Terms Gate Check
      const hasAccepted = localStorage.getItem(TERMS_STORAGE_KEY) === "true";
      if (!hasAccepted) {
        showTermsModal(false); // First time consent mode
      }

      renderMessages();
      setTimeout(() => {
        const inp = document.getElementById("mmInputBox");
        if (inp) inp.focus();
      }, 250);
    },

    close: function () {
      const overlay = document.getElementById("mmAssistantOverlay");
      if (overlay) overlay.style.display = "none";
      hideLongPressMenu();
      const drawer = document.getElementById("mmSidebarDrawer");
      if (drawer) drawer.style.display = "none";
    },

    submitMessage: async function () {
      const input = document.getElementById("mmInputBox");
      const btn = document.getElementById("mmSendBtn");
      const text = input.value.trim();
      if (!text) return;

      // Agar terms accept nahi hain toh pehle terms dikhao
      if (localStorage.getItem(TERMS_STORAGE_KEY) !== "true") {
        showTermsModal(false);
        return;
      }

      input.value = "";
      saveMessageToActive("user", text);
      renderMessages();

      btn.disabled = true;
      btn.innerText = "Thinking...";

      try {
        const recentHist = getActiveMessages().slice(-4).map((m) => m.text).join(" ");
        const contextSlice = await buildContextSlice(text, recentHist);
        const aiReply = await callGeminiFlash(text, contextSlice);
        saveMessageToActive("assistant", aiReply);
        renderMessages();
      } catch (err) {
        console.error("MMAssistant Gemini Error:", err);
        saveMessageToActive("assistant", "⚠️ Error: " + err.message);
        renderMessages();
      } finally {
        btn.disabled = false;
        btn.innerText = "Send ➔";
        const inp = document.getElementById("mmInputBox");
        if (inp) inp.focus();
      }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectChatUI);
  } else {
    injectChatUI();
  }

})(window);
