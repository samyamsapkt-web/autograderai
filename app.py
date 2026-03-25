import os
import io
import requests
import pdfplumber
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024  # 32 MB

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")


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


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/grade", methods=["POST"])
def grade():
    if not GROQ_API_KEY:
        return jsonify({"error": "Server is missing GROQ_API_KEY environment variable."}), 500

    # --- Rubric / Answer Key files ---
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

    # --- Student work files ---
    work_uploads = request.files.getlist("work_files")
    if not work_uploads:
        return jsonify({"error": "No student work files provided."}), 400

    work_blocks = []
    for f in work_uploads:
        try:
            content = extract_text(f.filename, f.read())
            work_blocks.append(f"=== STUDENT FILE: {f.filename} ===\n{content}")
        except ValueError as e:
            return jsonify({"error": str(e)}), 422
    work_block = "\n\n".join(work_blocks)

    # --- Optional fields ---
    grade_level = request.form.get("grade_level", "").strip()
    special_instructions = request.form.get("special_instructions", "").strip()

    grade_block = ""
    if grade_level:
        grade_block = f"\nGRADE LEVEL: Grade {grade_level}. Evaluate strictly based on the expected abilities and standards of a typical Grade {grade_level} student.\n"

    instr_block = ""
    if special_instructions:
        instr_block = f"\nSPECIAL INSTRUCTIONS FROM TEACHER:\n{special_instructions}\n"

    prompt = f"""You are an expert teacher grading student work. Your job is to produce highly specific, evidence-based feedback — not generic comments.

CRITICAL RULES FOR FEEDBACK QUALITY:
1. ALWAYS quote or reference specific parts of the student's work. Use phrases like "In your introduction...", "In paragraph 2...", "Your section on X...", "You write '[quote]' but...". Never give feedback without pointing to exactly where in the work the issue or strength appears.
2. NEVER use vague phrases like "could be better", "needs improvement", "good job", "well done". Replace every vague phrase with a specific observation tied to actual content.
3. For each criterion, explain your REASONING — why did you assign that score? What specific evidence in the work supports it?
4. Use varied, precise language. Rotate between: "notably", "specifically", "for instance", "your analysis of X", "the section where you discuss Y", "this is effective because", "this weakens the argument because".
5. If an answer key is provided, check each answer against it explicitly. Note correct answers, partially correct answers, and incorrect answers with specifics.
6. Calculate the final score using weighted categories if the rubric specifies weights/percentages.
{grade_block}{instr_block}
RUBRIC / ANSWER KEY:
{rubric_text}

STUDENT WORK:
{work_block}

Respond ONLY with a JSON object in this exact format (no markdown, no backticks):
{{
  "score": <number 0-100>,
  "letter": "<A+/A/A-/B+/B/B-/C+/C/C-/D/F>",
  "confidence": <number 0-100>,
  "confidence_label": "<High|Moderate|Low>",
  "confidence_note": "<one sentence explaining confidence level, e.g. 'Rubric is detailed and work is clear — high confidence in this assessment'>",
  "grading_logic": "<explain how the final score was calculated, e.g. 'Knowledge 24/30 (80%) + Thinking 20/25 (80%) + Communication 18/25 (72%) = weighted average of 78%'>",
  "criteria": [
    {{
      "name": "<criterion name>",
      "weight": "<e.g. 30% or N/A>",
      "points_earned": <number>,
      "points_possible": <number>,
      "status": "<pass|partial|fail>",
      "feedback": "<SPECIFIC feedback referencing exact parts of the student work — quote or reference specific paragraphs, sentences, or sections. Explain WHY this score was given with evidence.>"
    }}
  ],
  "strengths": "<Specific paragraph referencing actual content — name the sections, quote phrases, explain WHY they are strong>",
  "improvements": "<Specific paragraph with exact locations in the work — 'In your conclusion...', 'Your paragraph on X lacks...', 'The sentence where you say Y could be strengthened by...'>",
  "summary": "<2-3 sentence honest overall summary that references the actual work>"
}}"""

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
    }

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2000,
        "temperature": 0.2,
    }

    try:
        resp = requests.post(GROQ_API_URL, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
        result = resp.json()
        text = result["choices"][0]["message"]["content"]
        return jsonify({"result": text})
    except requests.exceptions.HTTPError as e:
        return jsonify({"error": f"Groq API error: {e.response.status_code} — {e.response.text}"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"error": "Request to Groq timed out."}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
