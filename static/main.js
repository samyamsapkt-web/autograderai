/* ── State ── */
let rubricFiles   = [];
let workFiles     = [];
let selectedGrade = null;
let currentData   = null;

/* ── DOM refs ── */
const rubricInput        = document.getElementById("rubricInput");
const rubricZone         = document.getElementById("rubricZone");
const rubricEmpty        = document.getElementById("rubricEmpty");
const rubricFileArea     = document.getElementById("rubricFileArea");
const rubricList         = document.getElementById("rubricList");
const addMoreRubricInput = document.getElementById("addMoreRubricInput");

const workZone     = document.getElementById("workZone");
const workInput    = document.getElementById("workInput");
const workEmpty    = document.getElementById("workEmpty");
const workFileArea = document.getElementById("workFileArea");
const workList     = document.getElementById("workList");
const addMoreInput = document.getElementById("addMoreInput");

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

/* ── Grade level ── */
document.querySelectorAll(".grade-level-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".grade-level-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedGrade = btn.dataset.grade;
    updateGradeBtn();
  });
});

/* ── Helpers ── */
function updateGradeBtn() {
  const ready = rubricFiles.length > 0 && workFiles.length > 0;
  gradeBtn.disabled = !ready;
  gradeHint.textContent = ready
    ? `Ready to grade ${workFiles.length} file(s)${selectedGrade ? ` · Grade ${selectedGrade}` : ""}`
    : rubricFiles.length === 0
      ? "Upload a rubric or answer key to get started"
      : "Upload student work to enable grading";
}

function showError(msg) { errorText.textContent = msg; errorBox.classList.remove("hidden"); }
function hideError()    { errorBox.classList.add("hidden"); }
function setStatus(msg) { statusText.textContent = msg; statusBar.classList.remove("hidden"); }
function hideStatus()   { statusBar.classList.add("hidden"); }

/* ── Generic multi-file renderer ── */
function renderFileList(files, listEl, emptyEl, fileAreaEl, zoneEl, inputEl) {
  listEl.innerHTML = "";
  files.forEach(f => {
    const pill = document.createElement("div");
    pill.className = "file-pill";
    pill.innerHTML = `<span class="pill-icon">📄</span><span>${f.name}</span><button class="pill-remove" data-name="${f.name}">✕</button>`;
    listEl.appendChild(pill);
  });
  if (files.length > 0) {
    emptyEl.classList.add("hidden");
    fileAreaEl.classList.remove("hidden");
    zoneEl.querySelector(".upload-icon-wrap").classList.add("hidden");
    zoneEl.querySelector(".upload-card-title").classList.add("hidden");
    inputEl.style.pointerEvents = "none";
  } else {
    emptyEl.classList.remove("hidden");
    fileAreaEl.classList.add("hidden");
    zoneEl.querySelector(".upload-icon-wrap").classList.remove("hidden");
    zoneEl.querySelector(".upload-card-title").classList.remove("hidden");
    inputEl.style.pointerEvents = "auto";
  }
  updateGradeBtn();
}

/* ── Rubric files ── */
function addRubricFiles(files) {
  for (const f of files) { if (!rubricFiles.find(x => x.name === f.name)) rubricFiles.push(f); }
  renderFileList(rubricFiles, rubricList, rubricEmpty, rubricFileArea, rubricZone, rubricInput);
}
function removeRubricFile(name) {
  rubricFiles = rubricFiles.filter(f => f.name !== name);
  renderFileList(rubricFiles, rubricList, rubricEmpty, rubricFileArea, rubricZone, rubricInput);
}
rubricList.addEventListener("click", e => {
  const btn = e.target.closest(".pill-remove[data-name]");
  if (btn) { e.stopPropagation(); removeRubricFile(btn.dataset.name); }
});
rubricInput.addEventListener("change", e => addRubricFiles(e.target.files));
addMoreRubricInput.addEventListener("change", e => addRubricFiles(e.target.files));
rubricZone.addEventListener("dragover", e => { e.preventDefault(); rubricZone.classList.add("drag"); });
rubricZone.addEventListener("dragleave", () => rubricZone.classList.remove("drag"));
rubricZone.addEventListener("drop", e => { e.preventDefault(); rubricZone.classList.remove("drag"); addRubricFiles(e.dataTransfer.files); });

/* ── Work files ── */
function addWorkFiles(files) {
  for (const f of files) { if (!workFiles.find(x => x.name === f.name)) workFiles.push(f); }
  renderFileList(workFiles, workList, workEmpty, workFileArea, workZone, workInput);
}
function removeWorkFile(name) {
  workFiles = workFiles.filter(f => f.name !== name);
  renderFileList(workFiles, workList, workEmpty, workFileArea, workZone, workInput);
}
workList.addEventListener("click", e => {
  const btn = e.target.closest(".pill-remove[data-name]");
  if (btn) { e.stopPropagation(); removeWorkFile(btn.dataset.name); }
});
workInput.addEventListener("change", e => addWorkFiles(e.target.files));
addMoreInput.addEventListener("change", e => addWorkFiles(e.target.files));
workZone.addEventListener("dragover", e => { e.preventDefault(); workZone.classList.add("drag"); });
workZone.addEventListener("dragleave", () => workZone.classList.remove("drag"));
workZone.addEventListener("drop", e => { e.preventDefault(); workZone.classList.remove("drag"); addWorkFiles(e.dataTransfer.files); });

/* ── Score ring ── */
function animateScore(score) {
  const arc = document.getElementById("scoreArc");
  arc.style.strokeDashoffset = 326.7 - (score / 100) * 326.7;
  const numEl = document.getElementById("scoreDisplay");
  let current = 0;
  const step = score / 60;
  const interval = setInterval(() => {
    current = Math.min(current + step, score);
    numEl.textContent = Math.round(current);
    if (current >= score) clearInterval(interval);
  }, 16);
}

/* ── Edit grade modal ── */
document.getElementById("editGradeBtn").addEventListener("click", () => {
  document.getElementById("editScore").value  = document.getElementById("scoreDisplay").textContent;
  document.getElementById("editLetter").value = document.getElementById("letterGrade").textContent;
  document.getElementById("editModal").classList.remove("hidden");
});
document.getElementById("editCancelBtn").addEventListener("click", () => {
  document.getElementById("editModal").classList.add("hidden");
});
document.getElementById("editSaveBtn").addEventListener("click", () => {
  const newScore  = parseInt(document.getElementById("editScore").value);
  const newLetter = document.getElementById("editLetter").value.trim();
  if (!isNaN(newScore) && newScore >= 0 && newScore <= 100) {
    document.getElementById("scoreDisplay").textContent = newScore;
    animateScore(newScore);
  }
  if (newLetter) {
    document.getElementById("letterGrade").textContent = newLetter;
  }
  document.getElementById("editModal").classList.add("hidden");
});

/* ── Edit text buttons ── */
document.querySelectorAll(".edit-text-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    const isEditing = target.getAttribute("contenteditable") === "true";
    if (isEditing) {
      target.setAttribute("contenteditable", "false");
      btn.textContent = "✏️ Edit";
      btn.classList.remove("active");
    } else {
      target.setAttribute("contenteditable", "true");
      target.focus();
      btn.textContent = "✓ Done";
      btn.classList.add("active");
    }
  });
});

/* ── Approve button ── */
document.getElementById("approveBtn").addEventListener("click", () => {
  const btn        = document.getElementById("approveBtn");
  const status     = document.getElementById("approveStatus");
  const dot        = status.querySelector(".approve-dot");

  // Lock all editing
  document.querySelectorAll(".editable-text").forEach(el => {
    el.setAttribute("contenteditable", "false");
  });
  document.querySelectorAll(".edit-text-btn").forEach(b => {
    b.textContent = "✏️ Edit";
    b.classList.remove("active");
  });

  dot.classList.replace("pending", "approved");
  status.childNodes[1].textContent = " Approved by teacher";
  btn.textContent = "✓ Approved — Print";
  btn.classList.add("approved");

  setTimeout(() => window.print(), 300);
});

/* ── Render results ── */
function renderResults(data) {
  currentData = data;

  setTimeout(() => animateScore(data.score || 0), 100);
  document.getElementById("letterGrade").textContent = data.letter || "—";

  const score = data.score || 0;
  const subtitle = score >= 90 ? "Excellent work" : score >= 80 ? "Good performance" : score >= 70 ? "Satisfactory" : score >= 60 ? "Needs improvement" : "Significant work needed";
  document.getElementById("scoreSubtitle").textContent = subtitle;

  // Confidence
  const conf      = data.confidence || 0;
  const confLabel = data.confidence_label || "";
  const confNote  = data.confidence_note  || "";
  document.getElementById("confidenceBar").style.width    = conf + "%";
  document.getElementById("confidenceLabel").textContent  = `Confidence: ${conf}% — ${confLabel}`;
  document.getElementById("confidenceNote").textContent   = confNote;

  // Grading logic
  if (data.grading_logic) {
    document.getElementById("logicText").textContent = data.grading_logic;
    document.getElementById("logicBar").classList.remove("hidden");
  } else {
    document.getElementById("logicBar").classList.add("hidden");
  }

  // Criteria
  const criteriaList = document.getElementById("criteriaList");
  criteriaList.innerHTML = "";
  if (Array.isArray(data.criteria) && data.criteria.length) {
    document.getElementById("criteriaSection").classList.remove("hidden");
    data.criteria.forEach(c => {
      const badgeClass = c.status === "pass" ? "badge-pass" : c.status === "partial" ? "badge-partial" : "badge-fail";
      const weightTag  = c.weight && c.weight !== "N/A" ? `<span class="criteria-weight">${c.weight}</span>` : "";
      const row = document.createElement("div");
      row.className = "criteria-row";
      row.innerHTML = `
        <div class="criteria-badge ${badgeClass}">${c.points_earned}/${c.points_possible}</div>
        <div class="criteria-content">
          <div class="criteria-name">${c.name}${weightTag}</div>
          <div class="criteria-feedback">${c.feedback}</div>
        </div>`;
      criteriaList.appendChild(row);
    });
  }

  // Text sections
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

  // Reset approve state
  const dot    = document.querySelector(".approve-dot");
  const status = document.getElementById("approveStatus");
  dot.className = "approve-dot pending";
  status.childNodes[1].textContent = " Pending teacher review";
  const approveBtn = document.getElementById("approveBtn");
  approveBtn.textContent = "✓ Approve & Print";
  approveBtn.classList.remove("approved");

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

  const dots = loadingBox.querySelectorAll(".step-dot");
  dots.forEach(d => d.classList.remove("active", "done"));
  let i = 0;
  const stepInterval = setInterval(() => {
    if (i > 0) dots[i - 1].classList.replace("active", "done");
    if (i < dots.length) { dots[i].classList.add("active"); i++; }
    else clearInterval(stepInterval);
  }, 900);

  try {
    const form = new FormData();
    rubricFiles.forEach(f => form.append("rubric_files", f, f.name));
    workFiles.forEach(f => form.append("work_files", f, f.name));
    const instr = specialInstructions.value.trim();
    if (instr)          form.append("special_instructions", instr);
    if (selectedGrade)  form.append("grade_level", selectedGrade);

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
  rubricFiles = []; workFiles = []; selectedGrade = null; currentData = null;
  document.querySelectorAll(".grade-level-btn").forEach(b => b.classList.remove("selected"));
  renderFileList(rubricFiles, rubricList, rubricEmpty, rubricFileArea, rubricZone, rubricInput);
  renderFileList(workFiles, workList, workEmpty, workFileArea, workZone, workInput);
  specialInstructions.value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
});
