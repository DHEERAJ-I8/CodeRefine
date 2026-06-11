"""
CodeRefine — Secure FastAPI Backend
Features:
- JWT Login System
- Protected AI Routes
- Groq / Gemini support
- API keys ONLY in .env file
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict
from jose import jwt, JWTError
from passlib.context import CryptContext
from datetime import datetime, timedelta
import os, json, re, httpx
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CodeRefine API", version="2.0.0")

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # change to your domain in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── CONFIG — keys come from .env ONLY ─────────────────────────
GROQ_API_KEY   = os.getenv("GROQ_API_KEY",   "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
HF_API_TOKEN   = os.getenv("HF_API_TOKEN",  "")
SECRET_KEY     = os.getenv("SECRET_KEY",     "")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not set in .env — server cannot start safely.")

ALGORITHM        = "HS256"
ACCESS_EXPIRE_MIN = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
auth_scheme = HTTPBearer()

# ── In-memory user store (replace with a real DB for production) ──
users_db: dict = {}

# ── MODELS ────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class AnalyzeRequest(BaseModel):
    code: str
    language: str = "python"
    checks: Dict[str, bool] = {}
    model: str = "groq-llama3"

class OptimizeRequest(BaseModel):
    code: str
    language: str = "python"
    model: str = "groq-llama3"

class SecurityRequest(BaseModel):
    code: str
    language: str = "python"
    model: str = "groq-llama3"

class Issue(BaseModel):
    type: str
    severity: str
    line: Optional[int] = None
    title: str
    description: str
    suggestion: Optional[str] = None

class AnalyzeResponse(BaseModel):
    score: int
    summary: str
    issues: List[Issue]
    optimized_code: Optional[str] = None

# ── AUTH HELPERS ──────────────────────────────────────────────
def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)

def verify_password(pw: str, hashed: str) -> bool:
    return pwd_context.verify(pw, hashed)

def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=ACCESS_EXPIRE_MIN)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# ── AI HELPERS ────────────────────────────────────────────────
async def call_groq(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.2
            }
        )

        print("STATUS:", res.status_code)
        print("BODY:", res.text)

        res.raise_for_status()

        return res.json()["choices"][0]["message"]["content"]

async def call_gemini(prompt: str) -> str:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key not configured on server")
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={GEMINI_API_KEY}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
        res.raise_for_status()
        return res.json()["candidates"][0]["content"]["parts"][0]["text"]

async def get_ai_response(prompt: str) -> str:
    """Try Groq first, fall back to Gemini."""
    if GROQ_API_KEY:
        return await call_groq(prompt)
    if GEMINI_API_KEY:
        return await call_gemini(prompt)
    raise HTTPException(status_code=503, detail="No AI provider configured. Add GROQ_API_KEY or GEMINI_API_KEY to .env")

def parse_ai_json(raw: str) -> dict:
    """Extract JSON object from AI response text."""
    try:
        clean = raw.replace("```json", "").replace("```", "").strip()
        match = re.search(r"\{.*\}", clean, re.S)
        if not match:
            raise ValueError("No JSON found in response")
        return json.loads(match.group())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {e}")

# ── PROMPTS ───────────────────────────────────────────────────
def build_analyze_prompt(code: str, language: str, checks: dict) -> str:
    check_list = ", ".join(k for k, v in checks.items() if v) or "bugs, performance, security, style"
    return f"""You are CodeRefine, an expert code reviewer. Analyze this {language} code for: {check_list}.

Respond ONLY with valid JSON — no markdown fences, no extra text:
{{
  "score": <integer 0-100>,
  "summary": "<one-sentence summary of code quality>",
  "issues": [
    {{
      "type": "<bug|performance|security|style|best-practice>",
      "severity": "<high|medium|low>",
      "line": <line number or null>,
      "title": "<short title>",
      "description": "<clear explanation>",
      "suggestion": "<how to fix it>"
    }}
  ],
  "optimized_code": "<full optimized rewrite>"
}}

Code to analyze:
```{language}
{code}
```"""

# ── AUTH ROUTES ───────────────────────────────────────────────
@app.post("/register")
def register(user: UserCreate):
    if user.username in users_db:
        raise HTTPException(status_code=400, detail="Username already taken")

    users_db[user.username] = {
        "username": user.username,
        "password": hash_password(user.password),
    }

    return {"message": "Account created successfully"}

@app.post("/login")
def login(user: UserLogin):
    db_user = users_db.get(user.username)

    if not db_user or not verify_password(
        user.password,
        db_user["password"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    token = create_token({"sub": user.username})

    return {
        "access_token": token,
        "username": user.username
    }
# ── PROTECTED AI ROUTES ───────────────────────────────────────
@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest, username: str = Depends(verify_token)):
    prompt = build_analyze_prompt(req.code, req.language, req.checks)
    raw    = await get_ai_response(prompt)
    data   = parse_ai_json(raw)
    return AnalyzeResponse(
        score          = int(data.get("score", 50)),
        summary        = str(data.get("summary", "")),
        issues         = data.get("issues", []),
        optimized_code = data.get("optimized_code", ""),
    )

@app.post("/optimize")
async def optimize(req: OptimizeRequest, username: str = Depends(verify_token)):
    prompt = build_analyze_prompt(req.code, req.language,
                                  {"bugs": True, "performance": True, "style": True, "optimize": True})
    raw  = await get_ai_response(prompt)
    data = parse_ai_json(raw)
    return data

@app.post("/security")
async def security(req: SecurityRequest, username: str = Depends(verify_token)):
    prompt = build_analyze_prompt(req.code, req.language,
                                  {"security": True, "bugs": True})
    raw  = await get_ai_response(prompt)
    data = parse_ai_json(raw)
    return data

@app.get("/health")
def health():
    return {
        "status": "ok",
        "groq":   bool(GROQ_API_KEY),
        "gemini": bool(GEMINI_API_KEY),
    }