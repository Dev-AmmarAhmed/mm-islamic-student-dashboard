/**
 * ====================================================================
 * MMASSISTANT AI v17.0 (QWEN ENGINE PRIORITY + LIVE DISCOVERY)
 * M.M ISLAMIC ENGLISH SCHOOL ERP
 * ====================================================================
 */

(function (window) {
  "use strict";

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

  // 2D AI Sparkle Vector
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

  // Markdown Formatter
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
      const formatted = isUser ? m.text : formatMarkdown(m.text);
      box.innerHTML += `
        <div style="display:flex; flex-direction:column; align-items:${isUser ? 'flex-end' : 'flex-start'};">
          <div style="max-width:88%; padding:12px 16px; border-radius:${isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px'}; background:${isUser ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)' : 'rgba(255,255,255,0.06)'}; color:${isUser ? '#ffffff' : 'var(--text-color, #f8fafc)'}; border:1px solid ${isUser ? 'transparent' : 'var(--border-color, #1e293b)'}; font-size:13px; font-weight:600; line-height:1.6; white-space:pre-wrap; word-break:break-word; box-shadow:0 2px 8px rgba(0,0,0,0.05);">${formatted}</div>
          <span style="font-size:9.5px; color:var(--text-muted, #64748b); margin-top:3px; padding:0 4px;">${m.time}</span>
        </div>
      `;
    });
    box.scrollTop = box.scrollHeight;
  }

  // ----------------------------------------------------
  // 3. IGRIS HARDWARE CACHE CONTEXT
  // ----------------------------------------------------
  async function buildContextSlice(userQuery, recentHistoryText) {
    const Sentinel = window.Igris || window.AccuEngine;
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const now = new Date();
    const currentMonth = months[now.getMonth()];
    const todayDay = now.getDate();

    const context = {
      institution_profile: {
        name: "M.M ISLAMIC ENGLISH SCHOOL",
        full_address: "46/K/05 (Room No 5, Line K, Plot No 46), Road No 04, Shivaji Nagar, Govandi, Mumbai - 400043, Maharashtra.",
        landmarks: "S.N. Hospital aur Honest Life English School ke bazu me, Sufi Dairy ke paas.",
        affiliation_standards: "Approved English Medium Islamic & Modern Curriculum. Currently operating Nursery to Class 5th (Vision up to Class 10th).",
        principal: {
          name: "Saba Teacher (Saba Parveen)",
          designation: "Principal / Head of Institution",
          qualifications: "D.Ed, B.Ed, LLB",
          primary_contact_whatsapp: "7302132270",
          secondary_contact: "9322298658"
        },
        office_contacts: ["7302132270", "9322298658"]
      },
      current_portal_date: `${todayDay} ${currentMonth} ${now.getFullYear()}`
    };

    if (!Sentinel) return JSON.stringify(context);

    try {
      const [studentsMap, teachersMap, feesMap, leavesMap, musterDoc] = await Promise.all([
        Sentinel.fetch("students") || {},
        Sentinel.fetch("teachers") || {},
        Sentinel.fetch("fees_matrix") || {},
        Sentinel.fetch("leaves") || {},
        Sentinel.fetch(`muster/${currentMonth}`) || {}
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

      // 🔍 3. Student Name Search
      const matchedStudents = [];
      for (const st of students) {
        const sName = (st.name || "").toLowerCase();
        if (!sName) continue;
        const parts = sName.split(" ").filter((p) => p.length >= 3);
        const nameMatches = parts.some((p) => q.includes(p));

        if (nameMatches || (targetStudentByAdmn && String(st.admn) === String(targetStudentByAdmn.admn))) {
          const studentAttDoc =
            (await Sentinel.fetch(`attendance/${st.admn}_${currentMonth}`)) ||
            (await Sentinel.fetch(`attendance/${st.admn}/${currentMonth}`)) ||
            {};
          const stFees = feesMap[st.admn] || {};

          matchedStudents.push({
            name: st.name,
            class: st.class,
            admn: st.admn,
            phone: st.phone || st.parentPhone || st.mobile || "Not updated",
            attendance_month: currentMonth,
            attendance_record: studentAttDoc,
            fees_status: {
              september: stFees["September"]?.paid ? "Paid" : "Unpaid",
              october: stFees["October"]?.paid ? "Paid" : "Unpaid",
              monthly_fee: st.customFee || 500
            }
          });
          if (matchedStudents.length >= 6) break;
        }
      }

      if (matchedStudents.length > 0) {
        context.queried_students = matchedStudents;
      }

      // 💳 4. Fees Analysis
      if (/(fee|unpaid|pending|paid|due|rupaye|paisa|list)/i.test(q)) {
        let unpaidCount = 0;
        let totalDues = 0;
        const unpaidList = [];
        students.forEach((st) => {
          const isPaid = feesMap[st.admn] && feesMap[st.admn][currentMonth] && feesMap[st.admn][currentMonth].paid;
          const feeVal = parseFloat(st.customFee || 500);
          if (!isPaid) {
            unpaidCount++;
            totalDues += feeVal;
            unpaidList.push(`${st.name} (Class ${st.class})`);
          }
        });

        context.fees_summary = {
          month: currentMonth,
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
  // 4. LIVE QWEN-FIRST MODEL RESOLVER
  // ----------------------------------------------------
  let memoizedLiveModelsList = null;

  async function getLiveActiveModels(apiKey) {
    if (memoizedLiveModelsList && memoizedLiveModelsList.length > 0) {
      return memoizedLiveModelsList;
    }

    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { "Authorization": "Bearer " + apiKey }
    });

    if (!res.ok) throw new Error("API Key verification failed.");

    const json = await res.json();
    const rawIds = (json.data || []).map((m) => m.id);

    // Filter out non-text/moderation models
    const activeTextModels = rawIds.filter((id) => {
      const s = id.toLowerCase();
      return !s.includes("guard") &&
             !s.includes("whisper") &&
             !s.includes("embed") &&
             !s.includes("vision") &&
             !s.includes("audio") &&
             !s.includes("orpheus") &&
             !s.includes("moderation");
    });

    // 🚀 Sort by Priority: QWEN FIRST, then LLAMA-3.3, then others
    const qwenModels = activeTextModels.filter((id) => id.toLowerCase().includes("qwen"));
    const llamaModels = activeTextModels.filter((id) => id.toLowerCase().includes("llama-3.3") || id.toLowerCase().includes("llama-3.2"));
    const otherModels = activeTextModels.filter((id) => !id.toLowerCase().includes("qwen") && !llamaModels.includes(id));

    memoizedLiveModelsList = [...qwenModels, ...llamaModels, ...otherModels];

    if (memoizedLiveModelsList.length === 0) {
      memoizedLiveModelsList = ["llama-3.3-70b-versatile", "llama-3.2-3b-preview"];
    }

    console.log("✔ [MMAssistant] Active Live Models (Qwen prioritized):", memoizedLiveModelsList);
    return memoizedLiveModelsList;
  }

  // ----------------------------------------------------
  // 5. INFERENCE CALL
  // ----------------------------------------------------
  async function callGroqDirect(userPrompt, verifiedContext) {
    const apiKey = getSecureKey();
    const activeModels = await getLiveActiveModels(apiKey);

    const systemPrompt = `Aap M.M ISLAMIC ENGLISH SCHOOL ke official smart assistant (MMAssistant) hain.
Aap school Administrator / Principal (Saba Teacher / Saba Parveen) se mukhatib hain.

COMPLETE SCHOOL DATABASE & CONTEXT:
${verifiedContext}

OPERATING RULES:
1. Address: 46/K/05 (Room No 5, Line K, Plot No 46), Road No 04, Shivaji Nagar, Govandi, Mumbai - 400043 (Landmark: SN Hospital & Honest Life English School ke bazu me, Sufi Dairy ke paas).
2. Principal: Saba Teacher (Saba Parveen). Degrees: D.Ed, B.Ed, LLB. Numbers: 7302132270 / 9322298658.
3. Phone lookup: Agar phone number pucha jaye ya type kiya jaye, exact person ka naam aur role batayein. Teachers directory se teacher ka contact number dein (e.g. Bushra Teacher: 88796 69303).
4. Student lookup: Admission number (jaise Admn 153) ya naam se exact student ki class, phone number, attendance aur fees status dein.
5. Answer naturally, respectfully and concisely in Roman Urdu, Hindi, or English without technical excuses or robotic preambles.`;

    const rawHistory = getHistory();
    const recentMessages = rawHistory.slice(-4).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text
    }));

    const messages = [
      { role: "system", content: systemPrompt },
      ...recentMessages,
      { role: "user", content: userPrompt }
    ];

    let lastError = null;

    for (const modelName of activeModels) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
          },
          body: JSON.stringify({
            model: modelName,
            messages: messages,
            temperature: 0.2,
            max_tokens: 500
          })
        });

        if (response.ok) {
          const data = await response.json();
          return data.choices[0].message.content.trim();
        }

        const errData = await response.json().catch(() => ({}));
        lastError = errData.error?.message || `HTTP ${response.status}`;
        console.warn(`Model [${modelName}] skipped: ${lastError}`);
      } catch (err) {
        lastError = err.message;
      }
    }

    memoizedLiveModelsList = null;
    throw new Error(lastError || "All models failed.");
  }

  // ----------------------------------------------------
  // 6. CONTROLLER API
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
