/**
 * ====================================================================
 * MMASSISTANT AI v1.0 (PRO GENERATIVE AI ENGINE)
 * Powered by Groq Cloud (Llama-3.3-70b-versatile) & Igris Hardware Cache
 * M.M ISLAMIC ENGLISH SCHOOL ERP
 * ====================================================================
 */

(function (window) {
  "use strict";

  // 🔑 GROQ API CONFIGURATION
  const GROQ_API_KEY = "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";
  const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
  const AI_MODEL = "llama-3.3-70b-versatile";
  const STORAGE_KEY = "mm_assistant_chat_history_v1";

  // ----------------------------------------------------
  // 1. DYNAMIC CHAT UI INJECTOR (Keeps index.html clean)
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
      <div id="mmAssistantContainer" style="width: 100%; max-width: 680px; height: 94vh; border-radius: 24px 24px 0 0; background: var(--card-bg, #ffffff); display: flex; flex-direction: column; overflow: hidden; border: 1.5px solid var(--border-color, #e2e8f0); box-shadow: 0 -10px 40px rgba(0,0,0,0.45); animation: sheetFlyUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
        
        <!-- Header -->
        <div style="background: var(--header-bg, linear-gradient(135deg, #022c22 0%, #059669 100%)); padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; color: white;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 24px;">🤖</div>
            <div>
              <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.3px;">MMAssistant AI</div>
              <div style="font-size: 10.5px; font-weight: 700; color: #34d399;">Llama-3.3 70B • Igris Verified Context</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" id="btnMmClearChat" title="Clear History" class="icon-btn" style="padding: 5px 9px; font-size: 12px; background: rgba(255,255,255,0.15);">🗑️</button>
            <button type="button" id="btnMmCloseChat" class="btn-sm-del" style="margin: 0; padding: 6px 14px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.35);">✕</button>
          </div>
        </div>

        <!-- Quick Prompts Carousel -->
        <div style="display: flex; gap: 8px; overflow-x: auto; padding: 10px 14px; background: rgba(0,0,0,0.02); border-bottom: 1px solid var(--border-color, #e2e8f0); scrollbar-width: none;">
          <div class="class-chip mm-chip" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" data-query="Is month kitne bachon ki fees pending hai?">💳 Unpaid Fees</div>
          <div class="class-chip mm-chip" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" data-query="School me total kitne students registered hain class-wise?">🎓 Total Students</div>
          <div class="class-chip mm-chip" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" data-query="Top teachers kaun hain points leaderboard me?">🏆 Mentors Rank</div>
          <div class="class-chip mm-chip" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" data-query="Photosynthesis kya hota hai aasan lafzon me samjhao">🌱 Homework Help</div>
        </div>

        <!-- Messages Container -->
        <div id="mmMessagesList" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px;"></div>

        <!-- Bottom Input Bar -->
        <div style="padding: 12px 14px; background: var(--nav-bg, #ffffff); border-top: 1.5px solid var(--border-color, #e2e8f0); display: flex; align-items: center; gap: 10px;">
          <input type="text" id="mmInputBox" placeholder="Ask anything about school records or study doubts..." autocomplete="off" style="flex: 1; padding: 12px 16px; font-size: 13px; font-weight: 700; border: 1.5px solid #059669; border-radius: 14px; background: var(--input-bg, #ffffff); color: var(--text-color, #0f172a); outline: none;">
          <button id="mmSendBtn" class="btn-primary btn-green" style="width: auto; padding: 12px 18px; margin: 0; border-radius: 14px; font-size: 14px;">
            Send ➔
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    // Event Listeners
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
  // 2. CHAT HISTORY PERSISTENCE (LocalStorage)
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
    if (list.length > 60) list.shift();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function renderHistory() {
    const box = document.getElementById("mmMessagesList");
    if (!box) return;
    const history = getHistory();
    box.innerHTML = "";

    if (history.length === 0) {
      box.innerHTML = `
        <div style="text-align:center; padding:36px 16px; color:var(--text-muted);">
          <div style="font-size:42px; margin-bottom:10px;">🤖</div>
          <div style="font-size:16px; font-weight:900; color:var(--text-color); margin-bottom:6px;">Assalamu Alaikum! I am MMAssistant.</div>
          <div style="font-size:12px; font-weight:600; line-height:1.6; max-width:440px; margin:0 auto;">
            Main M.M Islamic English School ka official smart AI assistant hoon. Aap mujhse kisi bhi student ki attendance, pending fees, teacher rank, timetable ke baare me pooch sakte hain — ya phir padhai aur homework se judi kisi bhi cheez ko aasan lafzon me samajh sakte hain.
          </div>
        </div>
      `;
      return;
    }

    history.forEach((m) => {
      const isUser = m.role === "user";
      box.innerHTML += `
        <div style="display:flex; flex-direction:column; align-items:${isUser ? 'flex-end' : 'flex-start'};">
          <div style="max-width:85%; padding:12px 16px; border-radius:${isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px'}; background:${isUser ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)' : 'rgba(0,0,0,0.04)'}; color:${isUser ? '#ffffff' : 'var(--text-color)'}; border:1px solid ${isUser ? 'transparent' : 'var(--border-color, #e2e8f0)'}; font-size:13px; font-weight:650; line-height:1.55; white-space:pre-wrap; word-break:break-word; box-shadow:0 2px 8px rgba(0,0,0,0.05);">${m.text}</div>
          <span style="font-size:9.5px; color:var(--text-muted); margin-top:3px; padding:0 4px;">${m.time}</span>
        </div>
      `;
    });
    box.scrollTop = box.scrollHeight;
  }

  // ----------------------------------------------------
  // 3. IGRIS HARDWARE CACHE SLICING ENGINE
  // ----------------------------------------------------
  async function buildContextSlice(userQuery) {
    const Sentinel = window.Igris || window.AccuEngine;
    if (!Sentinel) return "No local cache available.";

    try {
      const studentsMap = (await Sentinel.fetch("students")) || {};
      const teachersMap = (await Sentinel.fetch("teachers")) || {};
      const students = Object.values(studentsMap).filter(Boolean);
      const teachers = Object.values(teachersMap).filter(Boolean);

      // School overview summary for LLM
      const context = {
        total_students_count: students.length,
        total_teachers_count: teachers.length,
        classes_registered: [...new Set(students.map((s) => s.class))].filter(Boolean),
        top_teachers: teachers
          .sort((a, b) => (b.points || 0) - (a.points || 0))
          .slice(0, 5)
          .map((t) => ({ name: t.name, class: t.assignedClass, points: t.points || 0 }))
      };

      const q = userQuery.toLowerCase();

      // Attendance check intent: If student name is detected, fetch their exact attendance
      for (const st of students) {
        if (st.name && q.includes(st.name.toLowerCase())) {
          context.queried_student = {
            admn: st.admn,
            name: st.name,
            class: st.class,
            phone: st.phone,
            points: st.points || 0
          };
          // Fetch student attendance for active month
          const currentMonth = ["January","February","March","April","May","June","July","August","September","October","November","December"][new Date().getMonth()];
          context.queried_student_attendance = {
            month: currentMonth,
            records: (await Sentinel.fetch(`attendance/${st.admn}/${currentMonth}`)) || {}
          };
          break;
        }
      }

      // Fees inquiry intent
      if (/(fee|unpaid|pending|paid|due|rupaye|paisa)/i.test(q)) {
        const feesMap = (await Sentinel.fetch("fees_matrix")) || {};
        const currentMonth = "September"; // Academic active reference
        let unpaidCount = 0;
        let paidCount = 0;
        let totalDues = 0;

        students.forEach((st) => {
          const m = feesMap[st.admn] || {};
          const isPaid = m[currentMonth] && m[currentMonth].paid;
          const rate = st.customFee !== undefined ? parseFloat(st.customFee) : 500;
          if (isPaid) paidCount++;
          else {
            unpaidCount++;
            totalDues += rate;
          }
        });

        context.fees_summary = {
          month: currentMonth,
          unpaid_students: unpaidCount,
          paid_students: paidCount,
          total_pending_amount: totalDues
        };
      }

      // Today's Muster intent
      if (/(muster|in time|check in|teacher present)/i.test(q)) {
        const currentMonth = ["January","February","March","April","May","June","July","August","September","October","November","December"][new Date().getMonth()];
        const todayNum = new Date().getDate();
        const musterDoc = (await Sentinel.fetch(`muster/${currentMonth}`)) || {};
        context.today_muster = musterDoc[`day_${todayNum}`] || {};
      }

      return JSON.stringify(context, null, 2);
    } catch (e) {
      return "Context extraction error: " + e.message;
    }
  }

  // ----------------------------------------------------
  // 4. GROQ INFERENCE CALL (Llama-3.3 70B)
  // ----------------------------------------------------
  async function callGroqLlama(userPrompt, verifiedContext) {
    const role = localStorage.getItem("loggedRole") || "admin";
    const user = localStorage.getItem("loggedUser") || "Admin";

    const systemPrompt = `
You are MMAssistant, the authentic, highly intelligent, supportive and professional AI of M.M ISLAMIC ENGLISH SCHOOL.
Current User Role: ${role} (${user})

PORTAL VERIFIED CONTEXT (From local secure hardware cache):
${verifiedContext}

GUIDELINES FOR ANSWERS:
1. SCHOOL PORTAL DATA (Attendance, Fees, Students, Teachers, Timetable, Muster):
   - Answer accurately based ONLY on the verified context above.
   - For student attendance: If marked true -> Present ✔. If marked false -> Absent ❌. If "H" -> Holiday.
   - If a specific date record is missing, state politely that the attendance is not marked yet.
2. HOMEWORK, GENERAL ACADEMIC & STUDY DOUBTS:
   - When asked academic questions (Science, Math, English translation, History, Quran/Urdu concepts, general knowledge), explain clearly, accurately, and step-by-step like a great teacher.
   - Help students solve doubts, write essays, or understand complex topics without refusing.
3. LANGUAGE & TONE:
   - Match the user's language style (Roman Urdu, Hindi, or English).
   - Be respectful, concise, warm, and natural.
`;

    const payload = {
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.25,
      max_tokens: 650
    };

    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || "Groq Inference Error (" + response.status + ")");
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  // ----------------------------------------------------
  // 5. PUBLIC CONTROLLER API
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
      btn.innerText = "Thinking 🧠...";

      try {
        const contextSlice = await buildContextSlice(text);
        const aiReply = await callGroqLlama(text, contextSlice);
        saveMessage("assistant", aiReply);
        renderHistory();
      } catch (err) {
        console.error("MMAssistant Error:", err);
        saveMessage("assistant", "⚠️ Maazrat, main abhi server se connect nahi kar paaya: " + err.message);
        renderHistory();
      } finally {
        btn.disabled = false;
        btn.innerText = "Send ➔";
        const inp = document.getElementById("mmInputBox");
        if (inp) inp.focus();
      }
    }
  };

  // Auto-init on script load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectChatUI);
  } else {
    injectChatUI();
  }

})(window);
