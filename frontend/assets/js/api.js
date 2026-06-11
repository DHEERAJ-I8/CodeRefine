// ─────────────────────────────────────────────────────────────
// assets/js/api.js  —  SECURE VERSION
// All AI calls go through the FastAPI backend.
// No API keys are stored or used here — they live in backend/.env
// Backend URL is read from localStorage (set via Settings page).
// ─────────────────────────────────────────────────────────────

const API = {
  // ── Backend URL — set once via Settings, never hardcoded ──
  get baseUrl() {
    return localStorage.getItem('backendUrl') || 'http://localhost:8000';
  },

  // ── Auth headers ─────────────────────────────────────────
  getHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  },

  // ── 401 → kick to login ──────────────────────────────────
  handleUnauthorized(status) {
    if (status === 401) {
      localStorage.removeItem('token');
      window.location.href = 'login.html';
      return true;
    }
    return false;
  },

  // ── Generic POST ─────────────────────────────────────────
  async post(endpoint, body) {
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method:  'POST',
        headers: this.getHeaders(),
        body:    JSON.stringify(body),
      });
      if (this.handleUnauthorized(res.status)) return null;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`[API] ${endpoint} failed:`, err.message);
      return null;
    }
  },

  // ── Auth (no token needed) ───────────────────────────────
  async login(username, password) {
    const res = await fetch(`${this.baseUrl}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Login failed');
    return data;
  },

  async register(username, password) {
    const res = await fetch(`${this.baseUrl}/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Registration failed');
    return data;
  },

  // ── Protected AI routes — all processing on the backend ──
  async analyze(code, language, checks) {
    return this.post('/analyze', { code, language, checks });
  },

  async optimize(code, language) {
    return this.post('/optimize', { code, language });
  },

  async security(code, language) {
    return this.post('/security', { code, language });
  },

  // ── Health check ─────────────────────────────────────────
  async ping() {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (res.ok) {
        const data = await res.json();
        return data; // { status, groq, gemini }
      }
      return null;
    } catch {
      return null;
    }
  },
};

// ── Token / user helpers ──────────────────────────────────────
function getToken()   { return localStorage.getItem('token'); }
function setToken(t)  { localStorage.setItem('token', t); }
function clearToken() { localStorage.removeItem('token'); }

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('cr_user') || 'null'); }
  catch { return null; }
}
function setUser(u) { localStorage.setItem('cr_user', JSON.stringify(u)); }

// ── Auth guard — call at top of every protected page ──────────
function requireAuth() {
  if (!getToken()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// ── Logout ────────────────────────────────────────────────────
function doLogout() {
  clearToken();
  localStorage.removeItem('cr_user');
  localStorage.removeItem('cr_username');
  window.location.href = 'login.html';
}

// ── Active model selector ─────────────────────────────────────
function getSelectedModel() {
  return document.getElementById('modelSelect')?.value || 'groq-llama3';
}

// ── Backend connection test (used in Settings) ────────────────
async function checkBackendStatus() {
  const btn    = document.getElementById('pingBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Testing…'; }

  const data = await API.ping();

  if (btn) { btn.disabled = false; btn.textContent = '🔌 Test Connection'; }

  if (data && data.status === 'ok') {
    const providers = [
      data.groq   ? '✅ Groq'   : '❌ Groq',
      data.gemini ? '✅ Gemini' : '❌ Gemini',
    ].join('  ');
    showToast(`Backend online — ${providers}`, 'success');
  } else {
    showToast('Cannot reach backend. Check the URL and that the server is running.', 'error');
  }
}