# ⚡ CodeRefine

**Generative AI–Powered Code Review & Optimization Engine**

CodeRefine is a full-stack web application that helps developers write, review, and optimize code using AI. It combines natural-language code generation, automated code review (bugs, performance, security, best practices), and an interactive AI coding assistant — all in a clean, modern interface.

---

## ✨ Features

- **🚀 Code Generation** — Describe what you want in plain English and get clean, production-ready code with an explanation, across 10+ languages (Python, JavaScript, TypeScript, Java, Go, Rust, C++, PHP, Ruby, Swift).

- **🔍 Code Optimization** — Paste existing code and get an automated review covering:
  - 🐛 Bug detection
  - ⚡ Performance issues
  - 🔒 Security vulnerabilities
  - ✅ Best-practice violations

  Returns a categorized issue list (with severity ratings), a fully optimized rewrite, and a before/after quality score.

- **💬 AI Assistant** — A streaming chat interface for discussing code, asking follow-up questions, and getting real-time explanations.

- **🔐 Secure Authentication** — JWT-based login and registration with bcrypt password hashing.

- **🎯 Domain-Focused** — A built-in topic filter ensures the assistant only responds to programming-related questions.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, JavaScript, Tailwind CSS |
| **Backend** | FastAPI, Python 3.11+, Uvicorn |
| **AI Models** | Groq API (LLaMA 3 — `llama-3.3-70b-versatile`, Mixtral 8x7B) |
| **Auth** | JWT (`python-jose`), Passlib + Bcrypt |
| **Communication** | REST APIs, Server-Sent Events (SSE) for streaming chat |
| **Config** | python-dotenv |

---

## 📂 Project Structure

```
CodeRefine/
├── backend/
│   ├── main.py              # FastAPI app — all routes & logic
│   ├── requirements.txt
│   └── .env                 # API keys (not committed)
│
├── frontend/
│   ├── index.html           # Login / Register page
│   ├── dashboard.html        # Main app — Generate, Optimize, Chat
│   └── assets/
│       ├── css/main.css
│       └── js/
│           ├── api.js        # API request layer
│           ├── auth.js        # Login / register logic
│           ├── dashboard.js   # Shared UI logic + chat
│           └── generate.js    # Code generation logic
│
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- A free [Groq API key](https://console.groq.com/keys)

### 1. Clone the repository
```bash
git clone https://github.com/DHEERAJ-I8/CodeRefine.git
cd CodeRefine/backend
```

### 2. Create a virtual environment & install dependencies
```bash
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

### 3. Configure environment variables
Create a `.env` file inside `backend/`:
```
GROQ_API_KEY=your_groq_api_key_here
SECRET_KEY=your_random_secret_key
```

### 4. Run the backend
```bash
python -m uvicorn main:app --reload
```
The API will be available at `http://127.0.0.1:8000`
Interactive docs: `http://127.0.0.1:8000/docs`

### 5. Run the frontend
Open `frontend/index.html` using **VS Code Live Server**, or any static file server, and visit:
```
http://127.0.0.1:5500/frontend/index.html
```

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Create a new account |
| `POST` | `/auth/login` | Log in and receive a JWT |
| `GET`  | `/auth/me` | Get current user profile |
| `POST` | `/code/generate` | Generate code from a prompt |
| `POST` | `/code/optimize` | Analyze & optimize existing code |
| `POST` | `/chat/message` | Streaming AI chat (SSE) |
| `DELETE` | `/chat/history` | Clear chat history |
| `GET`  | `/health` | Health check |

---

## 🧠 How It Works

1. **User authenticates** via the login/register page — a JWT token is issued and stored in the browser.
2. **Code Generation**: the prompt + selected language is sent to the LLaMA 3 model with a system prompt enforcing clean, well-commented, production-ready output.
3. **Code Optimization**: the submitted code and selected analysis scopes are sent to the model, which returns structured JSON containing issues, an optimized rewrite, and quality scores.
4. **AI Chat**: messages are streamed token-by-token via Server-Sent Events for a responsive, ChatGPT-like experience.
5. A **topic guard** checks every request — non-coding questions are politely declined to keep the assistant focused.

---

## 📌 Future Enhancements

- Persistent database (PostgreSQL/Supabase) for users and history
- Support for additional AI providers (Gemini, Hugging Face)
- File upload & multi-file project analysis
- Export optimization reports as PDF
- Dark/light theme toggle

---

## 👤 Author

**Dheeraj**
GitHub: [@DHEERAJ-I8](https://github.com/DHEERAJ-I8)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
