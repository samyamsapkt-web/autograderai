import os
import io
import requests
import pdfplumber
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024  # 32 MB upload limit

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")


def extract_text(filename: str, file_bytes: bytes) -> str:
    """Return plain text from a file, handling PDFs specially."""
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
                f"Could not extract any text from PDF '{filename}'. "
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

    rubric_file = request.files.get("rubric")
    if not rubric_file:
        return jsonify({"error": "No rubric file provided."}), 400
    try:
        rubric_text = extract_text(rubric_file.filename, rubric_file.read())
    except ValueError as e:
        return jsonify({"error": str(e)}), 422

    work_uploads = request.files.getlist("work_files")
    if not work_uploads:
        return jsonify({"error": "No student work files provided."}), 400

    work_blocks = []
    for f in work_uploads:
        try:
            content = extract_text(f.filename, f.read())
            work_blocks.append(f"=== FILE: {f.filename} ===\n{content}")
        except ValueError as e:
            return jsonify({"error": str(e)}), 422

    work_block = "\n\n".join(work_blocks)

    prompt = f"""You are an expert autograder. Grade the student's work based on the rubric provided.

RUBRIC:
{rubric_text}

STUDENT WORK:
{work_block}

Respond ONLY with a JSON object in this exact format (no markdown, no backticks):
{{
  "score": <number 0-100>,
  "letter": "<A/B/C/D/F>",
  "criteria": [
    {{
      "name": "<criterion name>",
      "points_earned": <number>,
      "points_possible": <number>,
      "status": "<pass|partial|fail>",
      "feedback": "<specific feedback>"
    }}
  ],
  "strengths": "<paragraph about what the student did well>",
  "improvements": "<paragraph about what needs work>",
  "summary": "<overall 2-3 sentence summary>"
}}"""

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
    }

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1500,
        "temperature": 0.2,
    }

    try:
        resp = requests.post(GROQ_API_URL, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
        result = resp.json()
        text = result["choices"][0]["message"]["content"]
        return jsonify({"result": text})
    except requests.exceptions.HTTPError as e:
        return jsonify({
            "error": f"Groq API error: {e.response.status_code} — {e.response.text}"
        }), 502
    except requests.exceptions.Timeout:
        return jsonify({"error": "Request to Groq timed out."}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
