/**
 * ====================================================================
 * MMASSISTANT AI v14.0 (DEEP ADMINISTRATIVE BRAIN + IGRIS SYNC)
 * Powered by Groq Cloud & Igris Local Cache
 * M.M ISLAMIC ENGLISH SCHOOL ERP
 * ====================================================================
 */

(function (window) {
  "use strict";

  // Obfuscated Groq Key (Bot-Protected)
  const _k1 = "Z3NrX1U0Z2xpQzZrbHE5TDRTdzFlcVQ0";
  const _k2 = "V0dkeWIzRllzMWNXS2d4R3NFZUNqMFFK";
  const _k3 = "a2gzclJKdnU=";

  function getSecureKey() {
    try {
      return atob(_k1) + atob(_k2) + atob(_k3);
    } catch (e) {
      return "";
    }
  }

  const STORAGE_KEY = "mm_assistant_chat_history_v1";

  // 2D AI Sparkle Icon
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

  const BIG_SPARKLE_SVG = `
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z" fill="url(#bigSparkleGrad)" />
      <circle cx="19" cy="5" r="1.5" fill="#38bdf8" />
      <circle cx="5" cy="19" r="1.5" fill="#818cf8" />
      <defs>
        <linearGradient id="bigSparkleGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stop-color="#38bdf8"/>
          <stop offset="1" stop-color="#a855f7"/>
        </linearGradient>
      </defs>
    </svg>
  `;

  // ----------------------------------------------------
  // 1. UI INJECTION ENGINE
  // ----------------------------------------------------
  function injectChatUI() {
    if (document.getElementById("mmAssistantOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "mmAssistantOverlay";
    overlay.style.cssText = `
      display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(5, 8, 18, 0.85); backdrop-filter: blur(8px);
      z-index: 100099; align-items: flex-end; justify-content: center;
    `;

    overlay.innerHTML = `
      <div id="mmAssistantContainer" style="width: 100%; max-width: 680px; height: 94vh; border-radius: 24px 24px 0 0; background: var(--card-bg, #0f172a); display: flex; flex-direction: column; overflow: hidden; border: 1.5px solid var(--border-color, #1e293b); box-shadow: 0 -10px 40px rgba(0,0,0,0.45); animation: sheetFlyUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
        
        <div style="background: var(--header-bg, #1e1b4b); padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; color: white;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="display:flex; align-items:center; justify-content:center;">${AI_SPARKLE_SVG}</div>
            <div>
              <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.3px;">MMAssistant</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" id="btnMmClearChat" title="Clear History" class="icon-btn" style="padding: 5px 9px; font-size: 12px; background: rgba(255,255,255,0.12);">🗑️</button>
            <button type="button" id="btnMmCloseChat" class="btn-sm-del" style="margin: 0; padding: 6px 14px; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3);">✕</button>
          </div>
        </div>

        <div style="display: flex; gap: 8px; overflow-x: auto; padding: 10px 14px; background: rgba(0,0,0,0.04); border-bottom: 1px solid var(--border-color, #1e293b); scrollbar-width: none;">
          <div class="class-chip mm-chip" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" data-query="School ka address, timings aur principal details batao">🏫 School Details</div>
          <div class="class-chip mm-chip" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" data-query="Teachers ki list aur unke contact numbers do">👩‍🏫 Teachers List</div>
          <div class="class-chip mm-chip" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" data-query="Is month kitne bachon ki fees pending hai list do">💳 Unpaid Fees</div>
          <div class="class-chip mm-chip" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" data-query="Photosynthesis kya hota hai simple samjhao">🌱 Study Help</div>
        </div>

        <div id="mmMessagesList" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px;"></div>

        <div style="padding: 12px 14px; background: var(--nav-bg, #0f172a); border-top: 1.5px solid var(--border-color, #1e293b); display: flex; align-items: center; gap: 10px;">
          <input type="text" id="mmInputBox" placeholder="Ask MMAssistant" autocomplete="off" style="flex: 1; padding: 12px 16px; font-size: 13px; font-weight: 700; border: 1.5px solid #059669; border-radius: 14px; background: var(--input-bg, #1e293b); color: var(--text-color, #ffffff); outline: none;">
          <button id="mmSendBtn" class="btn-primary btn-green" style="width: auto; padding: 12px 18px; margin: 0; border-radius: 14px; font-size: 14px;">
            Send ➔
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("btnMmCloseChat").onclick = window.MMAssistant.close;
    document.getElementById("btnMmClearChat").onclick = window.MMAssistant.clearHistory;
    document.getElementById("mmSendBtn").onclick = window.MMAssistant.submitMessage;

    document.getElementById("mmInputBox").addEventListener("keypress", (e) => {
      if (e.key === "Enter") window.MMAssistant.submitMessage();
    });

    overlay.querySelectorAll(".mm-chip").forEach((chip) => {
      chip.onclick = () => {
        document.getElementById("mmInputBox").value = chip.getAttribute("data-query");
        window.MMAssistant.submitMessage();
      };
    });
  }

  // ----------------------------------------------------
  // 2. CHAT STORAGE & RENDERING
  // ----------------------------------------------------
  function getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  function saveMessage(role, text) {
    const list = getHistory();
    list.push({
      role: role,
      text: text,
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    });
    if (list.length > 50) list.shift();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function renderHistory() {
    const box = document.getElementById("mmMessagesList");
    if (!box) return;
    const history = getHistory();
    box.innerHTML = "";

    if (history.length === 0) {
      box.innerHTML = `
        <div style="text-align:center; padding:36px 16px; color:var(--text-muted, #94a3b8);">
          <div style="display:flex; justify-content:center; margin-bottom:14px;">${BIG_SPARKLE_SVG}</div>
          <div style="font-size:18px; font-weight:900; color:var(--text-color, #f8fafc); margin-bottom:8px;">Assalamualaikum</div>
          <div style="font-size:12.5px; font-weight:600; line-height:1.6; max-width:440px; margin:0 auto;">
            Welcome to MMAssistant. Ask about student records, teacher phone numbers, fees collection, attendance, school information, or academic study doubts.
          </div>
        </div>
      `;
      return;
    }

    history.forEach((m) => {
      const isUser = m.role === "user";
      box.innerHTML += `
        <div style="display:flex; flex-direction:column; align-items:${isUser ? 'flex-end' : 'flex-start'};">
          <div style="max-width:85%; padding:12px 16px; border-radius:${isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px'}; background:${isUser ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)' : 'rgba(255,255,255,0.06)'}; color:${isUser ? '#ffffff' : 'var(--text-color, #f8fafc)'}; border:1px solid ${isUser ? 'transparent' : 'var(--border-color, #1e293b)'}; font-size:13px; font-weight:650; line-height:1.55; white-space:pre-wrap; word-break:break-word; box-shadow:0 2px 8px rgba(0,0,0,0.05);">${m.text}</div>
          <span style="font-size:9.5px; color:var(--text-muted, #64748b); margin-top:3px; padding:0 4px;">${m.time}</span>
        </div>
      `;
    });
    box.scrollTop = box.scrollHeight;
  }

  // ----------------------------------------------------
  // 3. MASTER KNOWLEDGE & LIVE CONTEXT INGESTION
  // ----------------------------------------------------
  async function buildContextSlice(userQuery, recentHistoryText) {
    const Sentinel = window.Igris || window.AccuEngine;

    // 🏫 PERMANENT VERIFIED INSTITUTION RECORD
    const context = {
      institution_profile: {
        name: "M.M ISLAMIC ENGLISH SCHOOL",
        full_official_address: "46/K/05 (Room No 5, Line K, Plot No 46), Road No 04, Shivaji Nagar, Govandi, Mumbai - 400043, Maharashtra.",
        landmarks: "S.N. Hospital aur Honest Life English School ke bazu me, Sufi Dairy ke paas.",
        affiliation_standards: "Approved English Medium Islamic & Modern Curriculum. Currently operating Nursery to Class 5 (Target & Structure up to Class 10th).",
        principal: {
          name: "Saba Teacher",
          designation: "Principal / Head of Institution",
          qualifications: "D.Ed, B.Ed, LLB",
          primary_contact_whatsapp: "7302132270",
          secondary_contact: "9322298658"
        },
        official_office_contact: "7302132270 / 9322298658"
      },
      app_modules_guide: {
        architecture: "Igris Sentinel Engine (Client-side 256-bit AES-GCM Encrypted Local Cache, Instant Offline Execution, Zero unnecessary Firestore Reads).",
        admin_dashboard_tabs: {
          "Home": "Analytics overview, Month Fee summary card, Mentors Rank (Teacher leaderboard cards), and MMAssistant AI.",
          "Students": "Student directory, class filter, add/edit records, admission numbers, parents contact info.",
          "Entry": "Fees entry window (+ ADD FEES ENTRY), monthly collection, triple-tap to see paid/unpaid lists.",
          "Track": "Student fee payment tracker and transaction history.",
          "Attend": "Monthly student attendance grid with Present / Absent / Holiday markers.",
          "Card": "Automated student ID card generator with printable layout.",
          "Expns": "Daily and monthly school expense entries log."
        },
        teachers_dashboard_tabs: {
          "Home": "Assigned class stats, mentor points progression.",
          "Attend": "Daily class attendance marker (Save Today's Attendance, Mark Holiday for All).",
          "Track": "Class-wise student tracking.",
          "Students": "Student directory of assigned classes.",
          "Perform": "Teacher leaderboard ranking.",
          "Test": "Create and conduct online objective tests and view results."
        }
      }
    };

    if (!Sentinel) return JSON.stringify(context, null, 2);

    try {
      const studentsMap = (await Sentinel.fetch("students")) || {};
      const teachersMap = (await Sentinel.fetch("teachers")) || {};
      const students = Object.values(studentsMap).filter(Boolean);
      const teachers = Object.values(teachersMap).filter(Boolean);

      const combinedText = (userQuery + " " + recentHistoryText).toLowerCase().replace(/[^a-z0-9\s]/g, "");

      // 👩‍🏫 ALL TEACHERS FEED (With Mobile Numbers)
      context.all_teachers_directory = teachers.map((t) => ({
        name: t.name || "Unknown Teacher",
        phone_number: t.phone || t.mobile || t.whatsapp || t.contact || "Not updated",
        assigned_classes: t.assignedClass || t.classes || "All",
        performance_points: t.points || 0,
        username: t.username || ""
      }));

      // Search matching teacher
      const matchedTeacher = context.all_teachers_directory.find((t) => {
        const tn = t.name.toLowerCase();
        return tn && (combinedText.includes(tn) || tn.split(" ").some((p) => p.length >= 3 && combinedText.includes(p)));
      });
      if (matchedTeacher) {
        context.currently_queried_teacher = matchedTeacher;
      }

      // 🔍 Student Search (Phone Numbers & Details)
      const matchedList = [];
      for (const st of students) {
        const sName = (st.name || "").toLowerCase();
        if (!sName) continue;
        const parts = sName.split(" ").filter((p) => p.length >= 3);
        const isMatched = combinedText.includes(sName) || parts.some((p) => combinedText.includes(p));

        if (isMatched) {
          matchedList.push({
            name: st.name,
            class: st.class,
            roll_or_admn: st.admn,
            phone_number: st.phone || st.parentPhone || st.mobile || st.contact || "Portal me update nahi hai",
            father_name: st.fatherName || st.parent || ""
          });
          if (matchedList.length >= 8) break;
        }
      }

      if (matchedList.length > 0) {
        context.matched_students = matchedList;
        const currentMonth = ["January","February","March","April","May","June","July","August","September","October","November","December"][new Date().getMonth()];
        context.primary_student_attendance = (await Sentinel.fetch(`attendance/${matchedList[0].roll_or_admn}/${currentMonth}`)) || {};
      }

      // 💳 Fees Matrix Analysis
      if (/(fee|unpaid|pending|paid|due|rupaye|paisa|list)/i.test(combinedText)) {
        const feesMap = (await Sentinel.fetch("fees_matrix")) || {};
        const currentMonth = "September";
        let unpaidCount = 0, paidCount = 0, totalDues = 0;
        const unpaidStudentsList = [];

        students.forEach((st) => {
          const m = feesMap[st.admn] || {};
          const isPaid = m[currentMonth] && m[currentMonth].paid;
          const rate = st.customFee !== undefined ? parseFloat(st.customFee) : 500;
          if (isPaid) {
            paidCount++;
          } else {
            unpaidCount++;
            totalDues += rate;
            unpaidStudentsList.push(`${st.name} (Class ${st.class})`);
          }
        });

        context.fees_data = {
          month: currentMonth,
          total_unpaid_students: unpaidCount,
          total_paid_students: paidCount,
          total_pending_fees_rupees: totalDues,
          unpaid_students_names: unpaidStudentsList.slice(0, 50)
        };
      }

      return JSON.stringify(context, null, 2);
    } catch (e) {
      return JSON.stringify(context, null, 2);
    }
  }

  // ----------------------------------------------------
  // 4. MODEL DISCOVERY (STRICT SAFE LLM WHITELIST)
  // ----------------------------------------------------
  let memoizedLiveModel = null;

  async function getLiveActiveModel(apiKey) {
    if (memoizedLiveModel) return memoizedLiveModel;

    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { "Authorization": "Bearer " + apiKey }
    });

    if (!res.ok) throw new Error("API Key verification failed.");

    const json = await res.json();
    const rawIds = (json.data || []).map((m) => m.id);

    // 🔒 STRICT WHITELIST: Only verified high-grade conversational LLMs
    const trustedWhitelist = [
      "llama-3.3-70b-versatile",
      "qwen-2.5-32b",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768"
    ];

    for (const modelName of trustedWhitelist) {
      if (rawIds.includes(modelName)) {
        memoizedLiveModel = modelName;
        console.log("✔ [MMAssistant] Locked Trusted Model:", memoizedLiveModel);
        return memoizedLiveModel;
      }
    }

    // Fallback: only standard text llama models (no canopylabs/orpheus/audio/guard)
    memoizedLiveModel = rawIds.find((id) => id.includes("llama-3") && !id.includes("guard")) || "llama-3.1-8b-instant";
    return memoizedLiveModel;
  }

  // ----------------------------------------------------
  // 5. MASTER INFERENCE ENGINE
  // ----------------------------------------------------
  async function callGroqDirect(userPrompt, verifiedContext) {
    const apiKey = getSecureKey();
    const activeModel = await getLiveActiveModel(apiKey);

    const systemPrompt = `Aap M.M ISLAMIC ENGLISH SCHOOL ke official smart collaborator (MMAssistant) hain.
Aap school ke Administrator / Principal se baat kar rahe hain.

SCHOOL COMPLETE MASTER CONTEXT & LIVE DATABASE:
${verifiedContext}

STRICT BEHAVIOR & KNOWLEDGE RULES:
1. SCHOOL & ADDRESS INQUIRIES:
   - Agar address pucha jaye: Batayein ki school "46/K/05 (Room No 5, Line K, Plot No 46), Road No 04, Shivaji Nagar, Govandi, Mumbai - 400043" par waqe hai. Landmark: "S.N. Hospital aur Honest Life English School ke bazu me, Sufi Dairy ke paas".
   - Agar classes pucha jaye: School Nursery se Class 10th tak ke liye plan hai, jisme filhal Nursery se Class 5th tak ke students actively registered hain.
2. PRINCIPAL DETAILS:
   - Principal "Saba Teacher" hain. Unki educational degrees "D.Ed, B.Ed, LLB" hain.
   - Unka Primary / WhatsApp number "7302132270" hai aur secondary contact number "9322298658" hai.
3. TEACHER DETAILS & CONTACT NUMBERS:
   - Check "all_teachers_directory" aur "currently_queried_teacher".
   - Agar kisi teacher (jaise Khan Bushra ya kisi aur) ka contact number pucha jaye, toh database se unka exact mobile number (jaise Bushra Teacher ka: 88796 69303), unki assigned classes aur points foran batayein. Kabhi mat kahein ki number available nahi hai jab directory me number mojood ho.
4. STUDENT DETAILS & CONTACT NUMBERS:
   - Check "matched_students". Name, class aur contact number saaf dein.
5. APP NAVIGATION & FEATURES:
   - User ko app ke tabs (Home, Students, Entry, Track, Attend, Card, Expns) aur features (Fees, Attendance, ID Cards, Muster, Syllabus) ki guidance clear steps me dein.
6. ACADEMIC & STUDY DOUBTS:
   - Photosynthesis ya subjects ke sawalat ko natural, dilchasp aur gehre andaaz me Roman Urdu/Hindi me samjhayein (jaise pichla response tha).
7. TONE & MANNER:
   - Har jawab seedha, respectful, factual aur accurate hona chahiye. Faltu excuses ya "data available nahi hai" jaisi baat na bolein jab data context me maujood ho.`;

    const rawHistory = getHistory();
    const recentMessages = rawHistory.slice(-4).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text
    }));

    const messagesPayload = [
      { role: "system", content: systemPrompt },
      ...recentMessages,
      { role: "user", content: userPrompt }
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: activeModel,
        messages: messagesPayload,
        temperature: 0.15,
        max_tokens: 550
      })
    });

    if (!response.ok) {
      memoizedLiveModel = null;
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  // ----------------------------------------------------
  // 6. PUBLIC CONTROLLER API
  // ----------------------------------------------------
  window.MMAssistant = {
    open: function () {
      injectChatUI();
      const overlay = document.getElementById("mmAssistantOverlay");
      overlay.style.display = "flex";
      renderHistory();
      setTimeout(() => {
        const inp = document.getElementById("mmInputBox");
        if (inp) inp.focus();
      }, 250);
    },

    close: function () {
      const overlay = document.getElementById("mmAssistantOverlay");
      if (overlay) overlay.style.display = "none";
    },

    clearHistory: function () {
      if (confirm("Clear all MMAssistant conversation history?")) {
        localStorage.removeItem(STORAGE_KEY);
        renderHistory();
      }
    },

    submitMessage: async function () {
      const input = document.getElementById("mmInputBox");
      const btn = document.getElementById("mmSendBtn");
      const text = input.value.trim();
      if (!text) return;

      input.value = "";
      saveMessage("user", text);
      renderHistory();

      btn.disabled = true;
      btn.innerText = "Thinking...";

      try {
        const recentHist = getHistory().slice(-4).map((m) => m.text).join(" ");
        const contextSlice = await buildContextSlice(text, recentHist);
        const aiReply = await callGroqDirect(text, contextSlice);
        saveMessage("assistant", aiReply);
        renderHistory();
      } catch (err) {
        console.error("MMAssistant Error:", err);
        saveMessage("assistant", "⚠️ Error: " + err.message);
        renderHistory();
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
