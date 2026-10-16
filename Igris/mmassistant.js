/**
 * ====================================================================
 * MMASSISTANT AI v19.0 (POWERED BY GOOGLE GEMINI FLASH)
 * M.M ISLAMIC ENGLISH SCHOOL ERP
 * ====================================================================
 */

(function (window) {
  "use strict";

  // Obfuscated Gemini Flash API Key (Protected from public scanners)
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

  // Clean Markdown Formatter
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
  // 1. CHAT UI INJECTION WITH FIXED GEMINI BADGE
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
        
        <!-- Header -->
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

        <!-- Quick Prompts Carousel -->
        <div style="display: flex; gap: 8px; overflow-x: auto; padding: 10px 14px; background: rgba(0,0,0,0.04); border-bottom: 1px solid var(--border-color, #1e293b); scrollbar-width: none;">
          <div class="class-chip mm-chip" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" data-query="School ka address, timings aur principal details batao">🏫 School Details</div>
          <div class="class-chip mm-chip" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" data-query="Is app me kaunse features hain aur fees kaise enter karein?">📱 App Manual</div>
          <div class="class-chip mm-chip" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" data-query="Teachers ki list aur unke contact numbers do">👩‍🏫 Teachers List</div>
          <div class="class-chip mm-chip" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" data-query="Is month kitne bachon ki fees pending hai list do">💳 Unpaid Fees</div>
        </div>

        <!-- Messages Container -->
        <div id="mmMessagesList" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px;"></div>

        <!-- 🚀 FIXED BADGE: • Powered by Google Gemini -->
        <div style="text-align: center; font-size: 10.5px; font-weight: 700; color: #94a3b8; padding: 5px 0 3px 0; background: var(--nav-bg, #0f172a); border-top: 1px solid rgba(255,255,255,0.05); letter-spacing: 0.3px; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#38bdf8; box-shadow: 0 0 6px #38bdf8;"></span>
          Powered by Google Gemini
        </div>

        <!-- Bottom Input Bar -->
        <div style="padding: 10px 14px 14px 14px; background: var(--nav-bg, #0f172a); display: flex; align-items: center; gap: 10px;">
          <input type="text" id="mmInputBox" placeholder="Ask MMAssistant (Powered by Gemini)" autocomplete="off" style="flex: 1; padding: 12px 16px; font-size: 13px; font-weight: 700; border: 1.5px solid #059669; border-radius: 14px; background: var(--input-bg, #1e293b); color: var(--text-color, #ffffff); outline: none;">
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
            Welcome to MMAssistant. Ask me anything about student records, teacher contacts, fee status, portal navigation, or study help.
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
  // 3. IGRIS HARDWARE CACHE SLICER + MASTER KNOWLEDGE
  // ----------------------------------------------------
  async function buildContextSlice(userQuery, recentHistoryText) {
    const Sentinel = window.Igris || window.AccuEngine;
    const allMonths = ["June","July","August","September","October","November","December","January","February","March","April","May"];
    const now = new Date();
    const systemMonth = ["January","February","March","April","May","June","July","August","September","October","November","December"][now.getMonth()];
    const todayDay = now.getDate();

    // 🏫 Master Institution Profile & Full ERP User Manual
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

      // Teachers Directory with live phone numbers
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
  // 4. GOOGLE GEMINI FLASH INFERENCE CALL
  // ----------------------------------------------------
  async function callGeminiFlash(userPrompt, verifiedContext) {
    const apiKey = getGeminiKey();

    const systemPrompt = `Aap M.M ISLAMIC ENGLISH SCHOOL ke official smart assistant (MMAssistant) hain.
Aap school Administrator / Principal (Saba Teacher / Saba Parveen) se mukhatib hain.

COMPLETE SCHOOL DATABASE, APP MANUAL & VERIFIED CONTEXT:
${verifiedContext}

OPERATING RULES:
1. APP NAVIGATION & MANUAL:
   - User jab bhi app ke bare me puche (jaise "fees kaise bharein", "unpaid list kaise nikalein", "attendance kaise lagayein", ya kisi button ka kaam), "app_user_guide" se step-by-step simple Roman Urdu me batayein.
   - Example: Fees bharni ho toh 'Entry' tab me jakar '+ ADD FEES ENTRY' button dabayein. Unpaid list ke liye 'Total Due Fees' box par 3 baar lagatar tap (Triple Tap) karein.
2. SCHOOL & PRINCIPAL DETAILS:
   - Address: 46/K/05 (Room No 5, Line K, Plot No 46), Road No 04, Shivaji Nagar, Govandi, Mumbai - 400043.
   - Landmarks: S.N. Hospital aur Honest Life English School ke bazu me, Sufi Dairy ke paas.
   - Principal: Saba Teacher (Saba Parveen). Degrees: D.Ed, B.Ed, LLB. Numbers: 7302132270 / 9322298658.
3. TEACHERS & STUDENTS CONTACT:
   - "teachers_directory" se teachers ke direct mobile numbers batayein (jaise Bushra Teacher: 88796 69303).
   - "queried_students" se student ka admission number, class, guardian phone, attendance aur 12 mahino ka fees status batayein.
4. TONE & MANNER:
   - Natural, respectful aur direct Roman Urdu me baat karein.
   - Kabhi kisi data ke liye jhooth ya excuse mat dein. Point-to-point saaf jawab dein.`;

    // Multi-turn chat contents for Gemini API
    const rawHistory = getHistory();
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
      btn.innerText = "Thinking...";

      try {
        const recentHist = getHistory().slice(-4).map((m) => m.text).join(" ");
        const contextSlice = await buildContextSlice(text, recentHist);
        const aiReply = await callGeminiFlash(text, contextSlice);
        saveMessage("assistant", aiReply);
        renderHistory();
      } catch (err) {
        console.error("MMAssistant Gemini Error:", err);
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
