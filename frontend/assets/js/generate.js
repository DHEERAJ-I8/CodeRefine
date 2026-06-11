// ─────────────────────────────────────────────────────────────
// assets/js/generate.js
// Core analysis engine — all AI calls go to the backend.
// No Groq / Gemini / HF keys or direct AI calls here.
// ─────────────────────────────────────────────────────────────

let lastAnalysisResult = null;
let lastOptimizedCode  = null;
let activeResultTab    = "issues";

// ── Char counter ──────────────────────────────────────────────
function updateCharCount() {
  const code  = document.getElementById("codeInput")?.value || "";
  const lines = code ? code.split("\n").length : 0;
  const el    = document.getElementById("charCount");
  if (el) el.textContent = `${lines} lines · ${code.length} chars`;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("codeInput")?.addEventListener("input", updateCharCount);
});

// ── Clear ─────────────────────────────────────────────────────
function clearAll() {
  const codeInput = document.getElementById("codeInput");
  if (codeInput) codeInput.value = "";

  const scroll = document.getElementById("resultsScroll");
  if (scroll) {
    scroll.innerHTML = `
      <div class="result-empty" id="resultEmpty">
        <div class="empty-icon">🔬</div>
        <p>Paste your code and click<br/><strong>Analyze Code</strong> to get started</p>
      </div>`;
  }

  const resultActions = document.getElementById("resultActions");
  if (resultActions) resultActions.style.display = "none";

  updateCharCount();
  lastAnalysisResult = null;
  lastOptimizedCode  = null;
}

// ── Sample code ───────────────────────────────────────────────
const SAMPLES = {
  python: `import sqlite3
import hashlib

def login(username, password):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    # BAD: SQL injection vulnerability
    query = "SELECT * FROM users WHERE username = '" + username + "'"
    cursor.execute(query)
    user = cursor.fetchone()
    conn.close()

    # BAD: MD5 is insecure for passwords
    hashed = hashlib.md5(password.encode()).hexdigest()
    if user and user[2] == hashed:
        return True
    return False

def get_all_users():
    users = []
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users")
    # BAD: loading everything into memory
    for row in cursor.fetchall():
        users.append(row)
    return users

def process_data(items):
    result = ""
    # BAD: O(n²) string concatenation
    for item in items:
        for sub in item:
            result = result + str(sub) + ","
    return result`,

  javascript: `async function fetchUserData(userId) {
  // BAD: no error handling
  const response = await fetch('/api/user/' + userId);
  const data = response.json();

  // BAD: using var, not const/let
  var users = [];
  for (var i = 0; i < data.length; i++) {
    // BAD: inefficient DOM manipulation in loop
    document.getElementById('list').innerHTML += '<li>' + data[i].name + '</li>';
    users.push(data[i]);
  }

  // BAD: eval usage
  var result = eval(data.formula);

  // BAD: == instead of ===
  if (result == "admin") {
    console.log("secret_token_12345"); // BAD: leaked secret
  }
  return users;
}`,
};

function loadSample() {
  const lang   = document.getElementById("langSelect")?.value || "python";
  const sample = SAMPLES[lang] || SAMPLES.python;
  const codeInput = document.getElementById("codeInput");
  if (codeInput) codeInput.value = sample;
  updateCharCount();
  showToast("Sample code loaded", "info");
}

// ── HTML escape ───────────────────────────────────────────────
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── MAIN ANALYZE ──────────────────────────────────────────────
async function analyzeCode() {
  const codeInput = document.getElementById("codeInput");
  const code = codeInput?.value.trim();
  if (!code) { showToast("Please paste some code first", "error"); return; }

  const language = document.getElementById("langSelect")?.value || "python";
  const checks = {
    bugs:      document.getElementById("chkBugs")?.checked     ?? true,
    performance: document.getElementById("chkPerf")?.checked   ?? true,
    security:  document.getElementById("chkSec")?.checked      ?? true,
    style:     document.getElementById("chkStyle")?.checked    ?? true,
    optimize:  document.getElementById("chkOptimize")?.checked ?? true,
  };

  const btn = document.getElementById("analyzeBtn");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Analyzing…"; }

  showAnalyzingState();

  // All AI processing happens on the backend — no frontend keys needed
  const result = await API.analyze(code, language, checks);

  if (btn) { btn.disabled = false; btn.textContent = "🔍 Analyze Code"; }

  if (result) {
    lastAnalysisResult = result;
    lastOptimizedCode  = result.optimized_code || "";
    renderResults(result, code, language);
    saveToHistory({
      code:       code.slice(0, 500),
      language,
      lines:      code.split("\n").length,
      issueCount: result.issues?.length || 0,
      bugCount:   (result.issues || []).filter((i) => i.type === "bug").length,
      score:      result.score || 0,
      summary:    result.summary || "",
    });
  } else {
    showErrorState();
  }
}

// ── OPTIMIZE PAGE ─────────────────────────────────────────────
async function runOptimize() {
  const code = document.getElementById("optimizeInput")?.value.trim();
  if (!code) { showToast("Paste some code first", "error"); return; }

  const lang    = document.getElementById("langSelect")?.value || "python";
  const results = document.getElementById("optimizeResults");
  if (results) results.innerHTML = `<div class="analyzing-state"><div class="spinner"></div><p style="color:var(--text-muted);font-size:13px;">Optimizing your code…</p></div>`;

  const result = await API.optimize(code, lang);

  if (result?.optimized_code) {
    lastOptimizedCode = result.optimized_code;
    const actionsEl = document.getElementById("optimizeResultActions");
    if (actionsEl) actionsEl.style.display = "flex";
    if (results) {
      results.innerHTML = `
        <div class="optimized-section">
          <div class="optimized-header">✨ Optimized Code — Score: ${result.score || "?"}/100</div>
          <div class="optimized-code" id="optimizedCodeBlock">${escHtml(result.optimized_code)}</div>
        </div>
        ${(result.issues || []).length ? `<div style="margin-top:12px;font-size:12px;color:var(--text-muted);">Fixed ${result.issues.length} issue(s) in the rewrite.</div>` : ""}`;
    }
  } else {
    if (results) results.innerHTML = `<div class="result-empty"><div class="empty-icon">⚠️</div><p>Optimization failed.<br/>Check that the backend is running and your .env has API keys.</p></div>`;
    showToast("Optimization failed — check backend connection", "error");
  }
}

function copyOptimized() {
  const code = document.getElementById("optimizedCodeBlock")?.textContent;
  if (code) { navigator.clipboard.writeText(code); showToast("Copied!", "success"); }
}

// ── SECURITY PAGE ─────────────────────────────────────────────
async function runSecurity() {
  const code = document.getElementById("securityInput")?.value.trim();
  if (!code) { showToast("Paste some code first", "error"); return; }

  const lang    = document.getElementById("langSelect")?.value || "python";
  const results = document.getElementById("securityResults");
  if (results) results.innerHTML = `<div class="analyzing-state"><div class="spinner"></div><p style="color:var(--text-muted);font-size:13px;">Scanning for vulnerabilities…</p></div>`;

  const result = await API.security(code, lang);

  if (result) {
    const secIssues = (result.issues || []).filter(
      (i) => i.type === "security" || i.type === "bug"
    );
    const highRisk  = secIssues.filter((i) => i.severity === "high");
    const riskLevel = highRisk.length > 0 ? "HIGH RISK" : secIssues.length > 0 ? "MEDIUM RISK" : "LOOKS SAFE";
    const riskColor = highRisk.length > 0 ? "var(--accent-red)" : secIssues.length > 0 ? "var(--accent-yellow)" : "var(--accent-green)";

    if (results) {
      results.innerHTML = `
        <div class="score-ring">
          <div class="score-circle" style="background:conic-gradient(${riskColor} ${100 - (result.score || 50)}%, var(--bg-card) 0%); color:${riskColor}; font-size:10px; font-weight:700;">
            ${riskLevel.split(" ")[0]}
          </div>
          <div class="score-info">
            <div class="score-title" style="color:${riskColor}">${riskLevel}</div>
            <div class="score-desc">${highRisk.length} critical · ${secIssues.length - highRisk.length} warnings</div>
          </div>
        </div>
        ${
          secIssues.length === 0
            ? `<div class="issue-card" style="border-left-color:var(--accent-green);">
                <div class="issue-title">✅ No security issues found</div>
                <div class="issue-desc">Your code passed security checks. Consider a deeper SAST scan for production.</div>
               </div>`
            : secIssues.map((issue) => `
                <div class="issue-card type-security">
                  <div class="issue-header">
                    <span class="issue-type security">${issue.type}</span>
                    <span style="font-size:11px;color:${issue.severity === "high" ? "var(--accent-red)" : "var(--accent-yellow)"};font-weight:600;">${(issue.severity || "").toUpperCase()}</span>
                    ${issue.line ? `<span class="issue-line">Line ${issue.line}</span>` : ""}
                  </div>
                  <div class="issue-title">${escHtml(issue.title)}</div>
                  <div class="issue-desc">${escHtml(issue.description)}</div>
                  ${issue.suggestion ? `<div class="issue-suggestion">🛡️ ${escHtml(issue.suggestion)}</div>` : ""}
                </div>`).join("")
        }`;
    }
  } else {
    if (results) results.innerHTML = `<div class="result-empty"><div class="empty-icon">⚠️</div><p>Scan failed.<br/>Check that the backend is running and your .env has API keys.</p></div>`;
    showToast("Security scan failed — check backend connection", "error");
  }
}

// ── Render results ────────────────────────────────────────────
function renderResults(result, code, language) {
  const scroll = document.getElementById("resultsScroll");
  if (!scroll) return;

  const resultActions = document.getElementById("resultActions");
  if (resultActions) resultActions.style.display = "flex";
  activeResultTab = "issues";

  const highCount  = (result.issues || []).filter((i) => i.severity === "high").length;
  const medCount   = (result.issues || []).filter((i) => i.severity === "medium").length;
  const lowCount   = (result.issues || []).filter((i) => i.severity === "low" || i.severity === "info").length;
  const scoreColor = result.score >= 75 ? "var(--accent-green)" : result.score >= 50 ? "var(--accent-yellow)" : "var(--accent-red)";

  const issuesHTML =
    (result.issues || []).length === 0
      ? `<div class="issue-card" style="border-left-color:var(--accent-green);">
          <div class="issue-header"><span class="issue-type best-practice">All Clear</span></div>
          <div class="issue-title">✅ No issues detected</div>
          <div class="issue-desc">Your code looks clean! The AI found no problems to report.</div>
         </div>`
      : (result.issues || []).map((issue) => `
          <div class="issue-card type-${issue.type}">
            <div class="issue-header">
              <span class="issue-type ${issue.type}">${issue.type}</span>
              <span style="font-size:11px;color:${issue.severity === "high" ? "var(--accent-red)" : issue.severity === "medium" ? "var(--accent-yellow)" : "var(--accent-cyan)"};font-weight:600;">${(issue.severity || "").toUpperCase()}</span>
              ${issue.line ? `<span class="issue-line">Line ${issue.line}</span>` : ""}
            </div>
            <div class="issue-title">${escHtml(issue.title)}</div>
            <div class="issue-desc">${escHtml(issue.description)}</div>
            ${issue.suggestion ? `<div class="issue-suggestion">💡 ${escHtml(issue.suggestion)}</div>` : ""}
          </div>`).join("");

  const optimizedHTML = `
    <div class="optimized-section">
      <div class="optimized-header">✨ Optimized Rewrite</div>
      <div class="optimized-code" id="optimizedCodeBlock">${escHtml(result.optimized_code || "// No optimized code generated.")}</div>
    </div>`;

  const diffHTML = buildDiff(code, result.optimized_code || code);

  scroll.innerHTML = `
    <div class="score-ring">
      <div class="score-circle" style="background:conic-gradient(${scoreColor} ${result.score}%, var(--bg-card) 0%); color:${scoreColor};">
        ${result.score}
      </div>
      <div class="score-info">
        <div class="score-title">Quality Score</div>
        <div class="score-desc">${escHtml(result.summary || "")}</div>
      </div>
    </div>
    <div class="result-summary">
      <div class="stat-box"><div class="stat-num" style="color:var(--accent-red)">${highCount}</div><div class="stat-label">High</div></div>
      <div class="stat-box"><div class="stat-num" style="color:var(--accent-yellow)">${medCount}</div><div class="stat-label">Medium</div></div>
      <div class="stat-box"><div class="stat-num" style="color:var(--accent-cyan)">${lowCount}</div><div class="stat-label">Low</div></div>
      <div class="stat-box"><div class="stat-num" style="color:var(--accent-primary)">${(result.issues || []).length}</div><div class="stat-label">Total</div></div>
    </div>
    <div id="tab-issues"    class="tab-content">${issuesHTML}</div>
    <div id="tab-optimized" class="tab-content" style="display:none">${optimizedHTML}</div>
    <div id="tab-diff"      class="tab-content" style="display:none">${diffHTML}</div>
  `;
}

// ── Tab switching in results panel ────────────────────────────
function switchResultTab(tab, el) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  if (el) el.classList.add("active");
  ["issues", "optimized", "diff"].forEach((t) => {
    const tabEl = document.getElementById(`tab-${t}`);
    if (tabEl) tabEl.style.display = t === tab ? "block" : "none";
  });
  activeResultTab = tab;
}

// ── Diff builder ──────────────────────────────────────────────
function buildDiff(original, optimized) {
  if (!optimized || original === optimized) {
    return '<div style="padding:16px;color:var(--text-muted);font-size:13px;">No changes to show.</div>';
  }
  const origLines = original.split("\n");
  const optLines  = optimized.split("\n");
  const maxLen    = Math.max(origLines.length, optLines.length);
  let html = '<div class="diff-view">';
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i];
    const n = optLines[i];
    if (o === n) {
      if (o !== undefined) html += `<div class="diff-line unchanged"><span class="diff-prefix"> </span>${escHtml(o)}</div>`;
    } else {
      if (o !== undefined) html += `<div class="diff-line removed"><span class="diff-prefix">-</span>${escHtml(o)}</div>`;
      if (n !== undefined) html += `<div class="diff-line added"><span class="diff-prefix">+</span>${escHtml(n)}</div>`;
    }
  }
  html += "</div>";
  return html;
}

// ── Analyzing / error states ──────────────────────────────────
function showAnalyzingState() {
  const scroll = document.getElementById("resultsScroll");
  if (!scroll) return;
  scroll.innerHTML = `
    <div class="analyzing-state">
      <div class="spinner"></div>
      <div class="analyzing-steps">
        <div class="analyzing-step active" id="step1"><div class="step-dot"></div> Parsing code structure…</div>
        <div class="analyzing-step" id="step2"><div class="step-dot"></div> Detecting bugs &amp; errors…</div>
        <div class="analyzing-step" id="step3"><div class="step-dot"></div> Checking security vulnerabilities…</div>
        <div class="analyzing-step" id="step4"><div class="step-dot"></div> Analyzing performance patterns…</div>
        <div class="analyzing-step" id="step5"><div class="step-dot"></div> Generating optimized rewrite…</div>
      </div>
    </div>`;

  const steps = ["step1", "step2", "step3", "step4", "step5"];
  let i = 0;
  const interval = setInterval(() => {
    if (i > 0) document.getElementById(steps[i - 1])?.classList.replace("active", "done");
    if (i < steps.length) document.getElementById(steps[i])?.classList.add("active");
    i++;
    if (i >= steps.length) clearInterval(interval);
  }, 600);
}

function showErrorState() {
  const scroll = document.getElementById("resultsScroll");
  if (!scroll) return;
  scroll.innerHTML = `
    <div class="result-empty">
      <div class="empty-icon">⚠️</div>
      <p>Analysis failed.<br/>
         Make sure the backend is running on <strong>localhost:8000</strong><br/>
         and your <strong>.env</strong> file has a valid <code>GROQ_API_KEY</code>.</p>
    </div>`;
}

// ── Copy / Export ─────────────────────────────────────────────
function copyResult() {
  if (!lastAnalysisResult) return;
  navigator.clipboard.writeText(JSON.stringify(lastAnalysisResult, null, 2));
  showToast("Results copied as JSON", "success");
}

function exportReport() {
  if (!lastAnalysisResult) return;
  const r    = lastAnalysisResult;
  const code = document.getElementById("codeInput")?.value || "";
  const lang = document.getElementById("langSelect")?.value || "unknown";
  const date = new Date().toLocaleString();

  let md = `# CodeRefine Report\n**Date:** ${date}\n**Language:** ${lang}\n**Score:** ${r.score}/100\n\n## Summary\n${r.summary}\n\n## Issues Found (${r.issues?.length || 0})\n\n`;

  (r.issues || []).forEach((issue, i) => {
    md += `### ${i + 1}. [${(issue.type || "").toUpperCase()}] ${issue.title}\n`;
    md += `**Severity:** ${issue.severity} | **Line:** ${issue.line || "N/A"}\n\n`;
    md += `${issue.description}\n\n`;
    if (issue.suggestion) md += `> 💡 **Fix:** ${issue.suggestion}\n\n`;
  });

  if (r.optimized_code) md += `## Optimized Code\n\`\`\`${lang}\n${r.optimized_code}\n\`\`\`\n`;

  const blob = new Blob([md], { type: "text/markdown" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = `coderefine-report-${Date.now()}.md`;
  a.click();
  showToast("Report exported as Markdown", "success");
}