import os
import io
import json
import requests
import pdfplumber
from flask import Flask, render_template, request, jsonify, redirect, session, url_for
from flask_cors import CORS
from supabase import create_client, Client

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-change-in-production")
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024  # 32 MB

GROQ_API_URL    = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY    = os.environ.get("GROQ_API_KEY", "")
SUPABASE_URL    = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY    = os.environ.get("SUPABASE_ANON_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None


# ── Text extraction ────────────────────────────────────────────────────────────

def extract_text(filename: str, file_bytes: bytes) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        text_parts = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for i, page in enumerate(pdf.pages, 1):
                page_text = page.extract_text() or ""
                if page_text.strip():
                    text_parts.append(f"[Page {i}]\n{page_text}")
        result = "\n\n".join(text_parts)
        if not result.strip():
            raise ValueError(
                f"Could not extract text from PDF '{filename}'. "
                "It may be a scanned image-only PDF."
            )
        return result
    for encoding in ("utf-8", "latin-1", "cp1252"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Could not decode '{filename}' as text.")


# ── Auth helpers ───────────────────────────────────────────────────────────────

def get_current_user():
    """Return user dict from session, or None."""
    return session.get("user")


def require_login(f):
    """Decorator — redirects to grading page if not logged in."""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not get_current_user():
            return jsonify({"error": "Not authenticated"}), 401
        return f(*args, **kwargs)
    return decorated


# ── Pages ──────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    user = get_current_user()
    return render_template("index.html", user=user)


@app.route("/dashboard")
def dashboard():
    user = get_current_user()
    if not user:
        return redirect("/")
    return render_template("dashboard.html", user=user)


# ── Auth routes ────────────────────────────────────────────────────────────────

@app.route("/auth/google")
def auth_google():
    """Redirect to Supabase Google OAuth."""
    if not supabase:
        return jsonify({"error": "Supabase not configured"}), 500
    redirect_url = os.environ.get("SITE_URL", request.host_url.rstrip("/")) + "/auth/callback"
    data = supabase.auth.sign_in_with_oauth({
        "provider": "google",
        "options": {"redirect_to": redirect_url}
    })
    return redirect(data.url)


@app.route("/auth/callback")
def auth_callback():
    """Supabase redirects here after Google login."""
    # Supabase sends the session via URL fragment (#) which JS handles.
    # We render a small page that reads the fragment and calls /auth/session.
    return render_template("auth_callback.html")


@app.route("/auth/session", methods=["POST"])
def auth_session():
    """JS posts the access_token here so we can store it server-side."""
    data         = request.get_json()
    access_token = data.get("access_token", "")
    if not access_token or not supabase:
        return jsonify({"error": "Missing token"}), 400
    try:
        user_resp = supabase.auth.get_user(access_token)
        user      = user_resp.user
        session["user"] = {
            "id":    user.id,
            "email": user.email,
            "name":  user.user_metadata.get("full_name", user.email),
            "avatar":user.user_metadata.get("avatar_url", ""),
            "token": access_token,
        }
        return jsonify({"ok": True, "user": session["user"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 401


@app.route("/auth/logout", methods=["POST"])
def auth_logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/auth/me")
def auth_me():
    user = get_current_user()
    if user:
        return jsonify({"user": user})
    return jsonify({"user": None})


# ── Grading ────────────────────────────────────────────────────────────────────

@app.route("/grade", methods=["POST"])
def grade():
    if not GROQ_API_KEY:
        return jsonify({"error": "Server is missing GROQ_API_KEY environment variable."}), 500

    rubric_uploads = request.files.getlist("rubric_files")
    if not rubric_uploads:
        return jsonify({"error": "No rubric or answer key file provided."}), 400

    rubric_blocks = []
    for f in rubric_uploads:
        try:
            content = extract_text(f.filename, f.read())
            rubric_blocks.append(f"=== RUBRIC/ANSWER KEY FILE: {f.filename} ===\n{content}")
        except ValueError as e:
            return jsonify({"error": str(e)}), 422
    rubric_text = "\n\n".join(rubric_blocks)

    work_uploads = request.files.getlist("work_files")
    if not work_uploads:
        return jsonify({"error": "No student work files provided."}), 400

    work_blocks = []
    work_filenames = []
    for f in work_uploads:
        try:
            content = extract_text(f.filename, f.read())
            work_blocks.append(f"=== STUDENT FILE: {f.filename} ===\n{content}")
            work_filenames.append(f.filename)
        except ValueError as e:
            return jsonify({"error": str(e)}), 422
    work_block = "\n\n".join(work_blocks)

    grade_level          = request.form.get("grade_level", "").strip()
    special_instructions = request.form.get("special_instructions", "").strip()

    grade_block = ""
    if grade_level:
        grade_block = f"\nGRADE LEVEL: Grade {grade_level}. Evaluate strictly based on the expected abilities and standards of a typical Grade {grade_level} student.\n"

    instr_block = ""
    if special_instructions:
        instr_block = f"\nSPECIAL INSTRUCTIONS FROM TEACHER:\n{special_instructions}\n"

    prompt = f"""You are an expert teacher grading student work. Produce highly specific, evidence-based feedback.

ANTI-HALLUCINATION RULES — FOLLOW STRICTLY:
1. You may ONLY reference content that is LITERALLY AND EXPLICITLY present in the student's work provided below.
2. Do NOT invent, assume, or fabricate any quotes, paragraph references, section names, or examples that are not directly in the text.
3. If you cannot find specific evidence for a point, say "The work does not contain sufficient evidence to assess [X]" — do not make something up.
4. Every piece of feedback must be traceable to actual text in the student's work. If you reference "paragraph 2" or quote something, it must exist verbatim in the student's work below.
5. Do NOT reference topics, sources, authors, or arguments that do not appear in the student's work.

FEEDBACK QUALITY RULES:
6. Never use vague phrases like "could be better", "needs improvement", "good job". Replace every vague phrase with a specific observation tied to actual content from the student's work.
7. For each criterion, explain your reasoning — why did you assign that score? What specific text supports it?
8. Use varied language: "notably", "specifically", "for instance", "your section on X states...", "the passage where you write...".
9. If an answer key is provided, check each answer explicitly against it.
10. Calculate the final score using weighted categories if the rubric specifies weights.
{grade_block}{instr_block}
RUBRIC / ANSWER KEY:
{rubric_text}

STUDENT WORK (only reference content from this — nothing else):
{work_block}

Respond ONLY with a JSON object in this exact format (no markdown, no backticks):
{{
  "score": <number 0-100>,
  "letter": "<A+/A/A-/B+/B/B-/C+/C/C-/D/F>",
  "confidence": <number 0-100>,
  "confidence_label": "<High|Moderate|Low>",
  "confidence_note": "<one sentence explaining confidence level>",
  "grading_logic": "<explain how the final score was calculated>",
  "criteria": [
    {{
      "name": "<criterion name>",
      "weight": "<e.g. 30% or N/A>",
      "points_earned": <number>,
      "points_possible": <number>,
      "status": "<pass|partial|fail>",
      "feedback": "<SPECIFIC feedback referencing only actual content from the student work — quote or reference specific text that is literally present. Explain WHY this score was given with evidence from the actual work.>"
    }}
  ],
  "strengths": "<Specific paragraph referencing actual content from the student work — only quote or reference text that is literally present>",
  "improvements": "<Specific paragraph with exact locations in the actual work — only reference content that literally exists in the student submission>",
  "summary": "<2-3 sentence honest overall summary referencing the actual work>"
}}"""

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2000,
        "temperature": 0.1,
    }

    try:
        resp = requests.post(GROQ_API_URL, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
        result    = resp.json()
        text      = result["choices"][0]["message"]["content"]
        clean     = text.replace("```json", "").replace("```", "").strip()
        parsed    = json.loads(clean)

        # Save to Supabase if user is logged in
        user = get_current_user()
        if user and supabase:
            try:
                supabase.table("grades").insert({
                    "user_id":      user["id"],
                    "score":        parsed.get("score"),
                    "letter":       parsed.get("letter"),
                    "confidence":   parsed.get("confidence"),
                    "grade_level":  grade_level or None,
                    "work_files":   work_filenames,
                    "rubric_files": [f.filename for f in rubric_uploads],
                    "result":       parsed,
                }).execute()
            except Exception:
                pass  # Don't fail grading if save fails

        return jsonify({"result": text})
    except requests.exceptions.HTTPError as e:
        return jsonify({"error": f"Groq API error: {e.response.status_code} — {e.response.text}"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"error": "Request to Groq timed out."}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Dashboard API ──────────────────────────────────────────────────────────────

@app.route("/api/grades")
@require_login
def api_grades():
    user = get_current_user()
    try:
        resp = supabase.table("grades") \
            .select("*") \
            .eq("user_id", user["id"]) \
            .order("created_at", desc=True) \
            .execute()
        return jsonify({"grades": resp.data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/grades/<grade_id>", methods=["DELETE"])
@require_login
def api_delete_grade(grade_id):
    user = get_current_user()
    try:
        supabase.table("grades") \
            .delete() \
            .eq("id", grade_id) \
            .eq("user_id", user["id"]) \
            .execute()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
