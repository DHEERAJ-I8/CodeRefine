// ─────────────────────────────────────────────────────────────
// assets/js/dashboard.js
// Dashboard metrics, history, page navigation, toast, settings
// ─────────────────────────────────────────────────────────────

// ── Auth guard — redirect to login if no token ────────────────
requireAuth();

// ── Show logged-in user in sidebar ───────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const username = localStorage.getItem("cr_username") || "User";
  const avatarEl = document.getElementById("user-avatar");
  const nameEl   = document.getElementById("user-name");
  if (avatarEl) avatarEl.textContent = username[0].toUpperCase();
  if (nameEl)   nameEl.textContent   = username;

  // Load saved settings into fields
  loadSettings();

  // Refresh dashboard metrics
  refreshDashboard();

  // Show default page
  showPage("analyze");
});

// ── Page navigation ───────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));

  const page = document.getElementById("page-" + name);
  const nav  = document.querySelector(`[data-page="${name}"]`);
  if (page) page.classList.add("active");
  if (nav)  nav.classList.add("active");

  if (name === "dashboard" || name === "history") refreshDashboard();
}

// ── Toast notifications ───────────────────────────────────────
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── History helpers ───────────────────────────────────────────
function getHistory() {
  try { return JSON.parse(localStorage.getItem("coderefine_history") || "[]"); }
  catch { return []; }
}

function saveToHistory(entry) {
  const history = getHistory();
  history.unshift({ ...entry, id: Date.now(), time: new Date().toLocaleString() });
  if (history.length > 50) history.pop();
  localStorage.setItem("coderefine_history", JSON.stringify(history));
}

function clearHistory() {
  if (!confirm("Clear all history?")) return;
  localStorage.removeItem("coderefine_history");
  refreshDashboard();
  showToast("History cleared", "info");
}

// ── Dashboard refresh ─────────────────────────────────────────
function refreshDashboard() {
  const history = getHistory();

  // Metrics
  const totalEl = document.getElementById("dash-total");
  const bugsEl  = document.getElementById("dash-bugs");
  const scoreEl = document.getElementById("dash-score");
  const changeEl = document.getElementById("dash-change");
  const scoresubEl = document.getElementById("dash-scoresub");

  if (totalEl) totalEl.textContent = history.length;

  const totalBugs = history.reduce((s, h) => s + (h.bugCount || 0), 0);
  if (bugsEl) bugsEl.textContent = totalBugs;

  if (history.length) {
    const avgScore = Math.round(history.reduce((s, h) => s + (h.score || 0), 0) / history.length);
    if (scoreEl)    scoreEl.textContent    = avgScore;
    if (scoresubEl) scoresubEl.textContent = `Last: ${history[0].score}/100`;
    if (changeEl)   changeEl.textContent   = `Last run: ${history[0].time}`;
  } else {
    if (scoreEl)    scoreEl.textContent    = "—";
    if (scoresubEl) scoresubEl.textContent = "No data yet";
    if (changeEl)   changeEl.textContent   = "Start analyzing to see stats";
  }

  // History table
  const tbody = document.getElementById("historyBody");
  if (tbody) {
    if (!history.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px;">No history yet — run your first analysis!</td></tr>`;
    } else {
      tbody.innerHTML = history.map((h) => {
        const cls = h.score >= 75 ? "good" : h.score >= 50 ? "ok" : "bad";
        return `
          <tr>
            <td style="font-family:'JetBrains Mono',monospace;font-size:11px;">${h.time}</td>
            <td>${h.language || "—"}</td>
            <td style="font-family:'JetBrains Mono',monospace;">${h.lines || 0}</td>
            <td style="font-family:'JetBrains Mono',monospace;">${h.issueCount || 0}</td>
            <td><span class="score-badge ${cls}">${h.score}/100</span></td>
            <td><button class="btn btn-secondary btn-sm" onclick="reloadHistory(${h.id})">↩ Reload</button></td>
          </tr>`;
      }).join("");
    }
  }

  // Detail history list
  const detail = document.getElementById("historyDetailList");
  if (detail) {
    if (!history.length) {
      detail.innerHTML = `<div class="result-empty" style="padding:60px 0;"><div class="empty-icon">🕑</div><p>No past analyses yet</p></div>`;
    } else {
      detail.innerHTML = history.map((h) => `
        <div class="issue-card" style="cursor:default;">
          <div class="issue-header">
            <span class="issue-type best-practice">${h.language || "unknown"}</span>
            <span class="issue-line">${h.time}</span>
            <span class="score-badge ${h.score >= 75 ? "good" : h.score >= 50 ? "ok" : "bad"}" style="margin-left:8px;">${h.score}/100</span>
          </div>
          <div class="issue-title">${h.lines} lines · ${h.issueCount} issues found</div>
          <div class="issue-desc">${(h.summary || "").slice(0, 120)}${(h.summary || "").length > 120 ? "…" : ""}</div>
        </div>`).join("");
    }
  }
}

// ── Reload from history ───────────────────────────────────────
function reloadHistory(id) {
  const entry = getHistory().find((h) => h.id === id);
  if (!entry) return;
  const codeInput = document.getElementById("codeInput");
  const langSelect = document.getElementById("langSelect");
  if (codeInput)  codeInput.value  = entry.code || "";
  if (langSelect && entry.language) langSelect.value = entry.language;
  showPage("analyze");
  updateCharCount();
  showToast("Code restored from history", "success");
}

// ── Settings ──────────────────────────────────────────────────
function toggleSetting(el) {
  el.classList.toggle("on");
}

function loadSettings() {
  const backendInput = document.getElementById("settBackendUrl");
  if (backendInput) {
    backendInput.value = localStorage.getItem("backendUrl") || "http://localhost:8000";
  }

  // Load toggle states
  const toggleMap = {
    "tog-autodetect": "setting_autodetect",
    "tog-rewrite":    "setting_rewrite",
    "tog-strict":     "setting_strict",
    "tog-history":    "setting_history",
    "tog-lines":      "setting_lines",
    "tog-diff":       "setting_diff",
  };
  for (const [elId, storeKey] of Object.entries(toggleMap)) {
    const el = document.getElementById(elId);
    if (!el) continue;
    const stored = localStorage.getItem(storeKey);
    // Default "on" toggles
    const defaultOn = ["tog-autodetect", "tog-rewrite", "tog-history", "tog-lines", "tog-diff"];
    const isOn = stored !== null ? stored === "true" : defaultOn.includes(elId);
    el.classList.toggle("on", isOn);
  }
}

function saveSettings() {
  const backendInput = document.getElementById("settBackendUrl");
  if (backendInput) {
    localStorage.setItem("backendUrl", backendInput.value.trim() || "http://localhost:8000");
  }

  const toggleMap = {
    "tog-autodetect": "setting_autodetect",
    "tog-rewrite":    "setting_rewrite",
    "tog-strict":     "setting_strict",
    "tog-history":    "setting_history",
    "tog-lines":      "setting_lines",
    "tog-diff":       "setting_diff",
  };
  for (const [elId, storeKey] of Object.entries(toggleMap)) {
    const el = document.getElementById(elId);
    if (el) localStorage.setItem(storeKey, el.classList.contains("on"));
  }

  showToast("Settings saved", "success");
}

// ── File upload ───────────────────────────────────────────────
function loadFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const codeInput = document.getElementById("codeInput");
    if (codeInput) {
      codeInput.value = e.target.result;
      updateCharCount();
      showToast(`Loaded: ${file.name}`, "success");
    }
  };
  reader.readAsText(file);
}

// Drag-and-drop support
document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("dropZone");
  if (!dropZone) return;

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const codeInput = document.getElementById("codeInput");
      if (codeInput) {
        codeInput.value = ev.target.result;
        updateCharCount();
        showToast(`Loaded: ${file.name}`, "success");
      }
    };
    reader.readAsText(file);
  });
});