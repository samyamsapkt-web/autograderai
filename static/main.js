/* ── State ── */
let rubricFile    = null;
let workFiles     = [];
let selectedGrade = null;

/* ── DOM refs ── */
const rubricInput         = document.getElementById("rubricInput");
const rubricZone          = document.getElementById("rubricZone");
const rubricHint          = document.getElementById("rubricHint");
const rubricPill          = document.getElementById("rubricPill");
const rubricName          = document.getElementById("rubricName");
const rubricRemove        = document.getElementById("rubricRemove");

const workZone            = document.getElementById("workZone");
const workInput           = document.getElementById("workInput");
const workEmpty           = document.getElementById("workEmpty");
const workFileArea        = document.getElementById("workFileArea");
const workList            = document.getElementById("workList");
const addMoreInput        = document.getElementById("addMoreInput");

const specialInstructions = document.getElementById("specialInstructions");

const gradeBtn            = document.getElementById("gradeBtn");
const gradeHint           = document.getElementById("gradeHint");
const statusBar           = document.getElementById("statusBar");
const statusText          = document.getElementById("statusText");
const errorBox            = document.getElementById("errorBox");
const errorText           = document.getElementById("errorText");
const loadingBox          = document.getElementById("loadingBox");
const resultsBox          = document.getElementById("resultsBox");
const gradeAgainBtn       = document.getElementById("gradeAgainBtn");

/* ── Grade level selector ── */
document.querySelectorAll(".grade-level-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".grade-level-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedGrade = btn.dataset.grade;
  });
});

/* ── Helpers ── */
function updateGradeBtn() {
  const ready = rubricFile && workFiles.length > 0;
  gradeBtn.disabled = !ready;
  gradeHint.textContent = ready
    ? `Ready to grade ${workFiles.length} file(s)${selectedGrade ? ` · Grade ${selectedGrade}` : ""}`
    : !rubricFile
      ? "Upload both files to enable grading"
      : "Upload student work to enable grading";
}

function showError(msg) {
  errorText.textContent = msg;
  errorBox.classList.remove("hidden");
}
function hideError() { errorBox.classList.add("hidden"); }

function setStatus(msg) {
  statusText.textContent = msg;
  statusBar.classList.remove("hidden");
}
function hideStatus() { statusBar.classList.add("hidden"); }

/* ── Loading steps animation ── */
function animateLoadingSteps() {
  const dots = loadingBox.querySelectorAll(".step-dot");
  let i = 0;
  const interval = setInterval(() => {
    if (i > 0) dots[i - 1].classList.replace("active", "done");
    if (i < dots.length) { dots[i].classList.add("active"); i++; }
    else clearInterval(interval);
  }, 900);
  return interval;
}

/* ── Rubric ── */
function setRubric(file) {
  rubricFile = file;
  rubricName.textContent = file.name;
  rubricHint.classList.add("hidden");
  rubricPill.classList.remove("hidden");
  rubricZone.querySelector(".upload-formats").classList.add("hidden");
  rubricZone.querySelector(".upload-icon-wrap").classList.add("hidden");
  rubricZone.querySelector(".upload-card-title").classList.add("hidden");
  updateGradeBtn();
}

function clearRubric() {
  rubricFile = null;
  rubricHint.classList.remove("hidden");
  rubricPill.classList.add("hidden");
  rubricZone.querySelector(".upload-formats").classList.remove("hidden");
  rubricZone.querySelector(".upload-icon-wrap").classList.remove("hidden");
  rubricZone.querySelector(".upload-card-title").classList.remove("hidden");
  rubricInput.value = "";
  updateGradeBtn();
}

rubricInput.addEventListener("change", e => { if (e.target.files[0]) setRubric(e.target.files[0]); });
rubricRemove.addEventListener("click", e => { e.stopPropagation(); clearRubric(); });

rubricZone.addEventListener("dragover", e => { e.preventDefault(); rubricZone.classList.add("drag"); });
rubricZone.addEventListener("dragleave", () => rubricZone.classList.remove("drag"));
rubricZone.addEventListener("drop", e => {
  e.preventDefault(); rubricZone.classList.remove("drag");
  if (e.dataTransfer.files[0]) setRubric(e.dataTransfer.files[0]);
});

/* ── Work files ── */
function renderWorkList() {
  workList.innerHTML = "";
  workFiles.forEach(f => {
    const pill = document.createElement("div");
    pill.className = "file-pill";
    pill.innerHTML = `<span class="pill-icon">📄</span><span>${f.name}</span><button class="pill-remove" data-name="${f.name}">✕</button>`;
    workList.appendChild(pill);
  });

  if (workFiles.length > 0) {
    workEmpty.classList.add("hidden");
    workFileArea.classList.remove("hidden");
    workZone.querySelector(".upload-icon-wrap").classList.add("hidden");
    workZone.querySelector(".upload-card-title").classList.add("hidden");
    workInput.style.pointerEvents = "none";
  } else {
    workEmpty.classList.remove("hidden");
    workFileArea.classList.add("hidden");
    workZone.querySelector(".upload-icon-wrap").classList.remove("hidden");
    workZone.querySelector(".upload-card-title").classList.remove("hidden");
    workInput.style.pointerEvents = "auto";
  }
  updateGradeBtn();
}

function addWorkFiles(files) {
  for (const f of files) {
    if (!workFiles.find(x => x.name === f.name)) workFiles.push(f);
  }
  renderWorkList();
}

function removeWorkFile(name) {
  workFiles = workFiles.filter(f => f.name !== name);
  renderWorkList();
}

workList.addEventListener("click", e => {
  const btn = e.target.closest(".pill-remove[data-name]");
  if (btn) { e.stopPropagation(); removeWorkFile(btn.dataset.name); }
});

workInput.addEventListener("change", e => addWorkFiles(e.target.files));
addMoreInput.addEventListener("change", e => addWorkFiles(e.target.files));

workZone.addEventListener("dragover", e => { e.preventDefault(); workZone.classList.add("drag"); });
workZone.addEventListener("dragleave", () => workZone.classList.remove("drag"));
workZone.addEventListener("drop", e => {
  e.preventDefault(); workZone.classList.remove("drag");
  addWorkFiles(e.dataTransfer.files);
});

/* ── Score ring animation ── */
function animateScore(score) {
  const arc = document.getElementById("scoreArc");
  const circumference = 326.7;
  const offset = circumference - (score / 100) * circumference;
  arc.style.strokeDashoffset = offset;

  const numEl = document.getElementById("scoreDisplay");
  let current = 0;
  const step = score / 60;
  const interval = setInterval(() => {
    current = Math.min(current + step, score);
    numEl.textContent = Math.round(current);
    if (current >= score) clearInterval(interval);
  }, 16);
}

/* ── Render results ── */
function renderResults(data) {
  setTimeout(() => animateScore(data.score || 0), 100);

  document.getElementById("letterGrade").textContent = data.letter || "—";

  const score = data.score || 0;
  const subtitle = score >= 90 ? "Excellent work" : score >= 80 ? "Good performance" : score >= 70 ? "Satisfactory" : score >= 60 ? "Needs improvement" : "Significant work needed";
  document.getElementById("scoreSubtitle").textContent = subtitle;

  const criteriaList = document.getElementById("criteriaList");
  criteriaList.innerHTML = "";
  if (Array.isArray(data.criteria) && data.criteria.length) {
    document.getElementById("criteriaSection").classList.remove("hidden");
    data.criteria.forEach(c => {
      const badgeClass = c.status === "pass" ? "badge-pass" : c.status === "partial" ? "badge-partial" : "badge-fail";
      const row = document.createElement("div");
      row.className = "criteria-row";
      row.innerHTML = `
        <div class="criteria-badge ${badgeClass}">${c.points_earned}/${c.points_possible}</div>
        <div class="criteria-content">
          <div class="criteria-name">${c.name}</div>
          <div class="criteria-feedback">${c.feedback}</div>
        </div>`;
      criteriaList.appendChild(row);
    });
  }

  [
    ["strengthsText",    "strengthsSection",   data.strengths],
    ["improvementsText", "improvementsSection", data.improvements],
    ["summaryText",      "summarySection",      data.summary],
  ].forEach(([textId, sectionId, content]) => {
    if (content) {
      document.getElementById(textId).textContent = content;
      document.getElementById(sectionId).classList.remove("hidden");
    } else {
      document.getElementById(sectionId).classList.add("hidden");
    }
  });

  loadingBox.classList.add("hidden");
  resultsBox.classList.remove("hidden");
  resultsBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ── Grade ── */
gradeBtn.addEventListener("click", async () => {
  hideError();
  gradeBtn.disabled = true;
  loadingBox.classList.remove("hidden");
  resultsBox.classList.add("hidden");
  setStatus("Analyzing submission with AI...");

  loadingBox.querySelectorAll(".step-dot").forEach(d => {
    d.classList.remove("active", "done");
  });
  const stepInterval = animateLoadingSteps();

  try {
    const form = new FormData();
    form.append("rubric", rubricFile, rubricFile.name);
    workFiles.forEach(f => form.append("work_files", f, f.name));

    const instructions = specialInstructions.value.trim();
    if (instructions) form.append("special_instructions", instructions);

    if (selectedGrade) form.append("grade_level", selectedGrade);

    const resp = await fetch("/grade", { method: "POST", body: form });
    const json = await resp.json();

    clearInterval(stepInterval);

    if (!resp.ok || json.error) throw new Error(json.error || `Server error ${resp.status}`);

    const raw    = json.result.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);

    hideStatus();
    renderResults(parsed);

  } catch (err) {
    clearInterval(stepInterval);
    loadingBox.classList.add("hidden");
    hideStatus();
    showError("Grading failed: " + (err.message || "Unknown error"));
  } finally {
    gradeBtn.disabled = false;
    updateGradeBtn();
  }
});

/* ── Grade again ── */
gradeAgainBtn.addEventListener("click", () => {
  resultsBox.classList.add("hidden");
  clearRubric();
  workFiles = [];
  selectedGrade = null;
  document.querySelectorAll(".grade-level-btn").forEach(b => b.classList.remove("selected"));
  renderWorkList();
  specialInstructions.value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
});
