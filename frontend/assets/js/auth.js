// ─────────────────────────────────────────────────────────────
// assets/js/auth.js
// CodeRefine Authentication System
// ─────────────────────────────────────────────────────────────

if (localStorage.getItem("token")) {
  window.location.href = "index.html";
}

// ─────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById("tab-login").classList.toggle("active", tab === "login");
  document.getElementById("tab-register").classList.toggle("active", tab === "register");

  document.getElementById("panel-login").classList.toggle("active", tab === "login");
  document.getElementById("panel-register").classList.toggle("active", tab === "register");

  clearMessages();
}

function clearMessages() {
  const ids = ["login-msg", "reg-msg"];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerText = "";
      el.className = "msg";
    }
  });
}

function showMsg(id, text, type = "info") {
  const el = document.getElementById(id);

  if (!el) return;

  el.innerText = text;
  el.className = `msg ${type}`;
}

// ─────────────────────────────────────────────────────────────
// Loading State
// ─────────────────────────────────────────────────────────────
function setLoading(btnId, spinnerId, labelId, loading) {
  const btn = document.getElementById(btnId);
  const spinner = document.getElementById(spinnerId);
  const label = document.getElementById(labelId);

  if (btn) btn.disabled = loading;

  if (spinner) {
    spinner.style.display = loading ? "block" : "none";
  }

  if (label) {
    label.style.display = loading ? "none" : "inline";
  }
}

// ─────────────────────────────────────────────────────────────
// Password Toggle
// ─────────────────────────────────────────────────────────────
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);

  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "🙈";
  } else {
    input.type = "password";
    btn.textContent = "👁";
  }
}

// ─────────────────────────────────────────────────────────────
// Password Strength
// ─────────────────────────────────────────────────────────────
function checkStrength(password) {
  const fill = document.getElementById("strength-fill");

  if (!fill) return;

  let score = 0;

  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const percent = (score / 5) * 100;

  fill.style.width = percent + "%";

  if (score <= 1) {
    fill.style.background = "#ef4444";
  } else if (score <= 3) {
    fill.style.background = "#f59e0b";
  } else {
    fill.style.background = "#10b981";
  }
}

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById("login-username")?.value.trim();
  const password = document.getElementById("login-password")?.value;

  if (!username || !password) {
    showMsg(
      "login-msg",
      "Please enter username and password",
      "error"
    );
    return;
  }

  setLoading(
    "login-btn",
    "login-spinner",
    "login-label",
    true
  );

  try {
    const data = await API.login(
      username,
      password
    );

    console.log("LOGIN RESPONSE:", data);

    if (!data.access_token) {
      throw new Error(
        "No access token returned from backend"
      );
    }

    localStorage.setItem(
      "token",
      data.access_token
    );

    localStorage.setItem(
      "cr_username",
      username
    );

    console.log(
      "TOKEN SAVED:",
      localStorage.getItem("token")
    );

    showMsg(
      "login-msg",
      "Login successful. Redirecting...",
      "success"
    );

    setTimeout(() => {
      window.location.href = "index.html";
    }, 700);

  } catch (err) {

    console.error(err);

    showMsg(
      "login-msg",
      err.message,
      "error"
    );

    setLoading(
      "login-btn",
      "login-spinner",
      "login-label",
      false
    );
  }
}

// ─────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────
async function doRegister() {

  const username =
    document.getElementById("reg-username")?.value.trim();

  const password =
    document.getElementById("reg-password")?.value;

  if (!username || !password) {
    showMsg(
      "reg-msg",
      "Fill all fields",
      "error"
    );
    return;
  }

  if (username.length < 3) {
    showMsg(
      "reg-msg",
      "Username must be at least 3 characters",
      "error"
    );
    return;
  }

  if (password.length < 6) {
    showMsg(
      "reg-msg",
      "Password must be at least 6 characters",
      "error"
    );
    return;
  }

  try {

    setLoading(
      "reg-btn",
      "reg-spinner",
      "reg-label",
      true
    );

    await API.register(
      username,
      password
    );

    const loginData =
      await API.login(
        username,
        password
      );

    localStorage.setItem(
      "token",
      loginData.access_token
    );

    localStorage.setItem(
      "cr_username",
      username
    );

    showMsg(
      "reg-msg",
      "Account created successfully",
      "success"
    );

    setTimeout(() => {
      window.location.href =
        "index.html";
    }, 700);

  } catch (err) {

    showMsg(
      "reg-msg",
      err.message,
      "error"
    );

    setLoading(
      "reg-btn",
      "reg-spinner",
      "reg-label",
      false
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Enter Key
// ─────────────────────────────────────────────────────────────
document.addEventListener(
  "keydown",
  function (e) {

    if (e.key !== "Enter") return;

    const loginActive =
      document
        .getElementById("panel-login")
        ?.classList.contains("active");

    if (loginActive) {
      doLogin();
    } else {
      doRegister();
    }
  }
);