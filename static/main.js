/* ── State ── */
let rubricFiles   = [];
let workFiles     = [];
let selectedGrade = null;

/* ── DOM refs ── */
const rubricInput        = document.getElementById("rubricInput");
const rubricZone         = document.getElementById("rubricZone");
const rubricEmpty        = document.getElementById("rubricEmpty");
const rubricFileArea     = document.getElementById("rubricFileArea");
const rubricList         = document.getElementById("rubricList");
const addMoreRubricInput = document.getElementById("addMoreRubricInput");
const workZone           = document.getElementById("workZone");
const workInput          = document.getElementById("workInput");
const workEmpty          = document.getElementById("workEmpty");
const workFileArea       = document.getElementById("workFileArea");
const workList           = document.getElementById("workList");
const addMoreInput       = document.getElementById("addMoreInput");
const specialInstructions= document.getElementById("specialInstructions");
const gradeBtn           = document.getElementById("gradeBtn");
const gradeHint          = document.getElementById("gradeHint");
const statusBar          = document.getElementById("statusBar");
const statusText         = document.getElementById("statusText");
const errorBox           = document.getElementById("errorBox");
const errorText          = document.getElementById("errorText");
const loadingBox         = document.getElementById("loadingBox");
const resultsBox         = document.getElementById("resultsBox");
const gradeAgainBtn      = document.getElementById("gradeAgainBtn");
const authArea           = document.getElementById("authArea");

/* ── Auth ── */
async function loadAuth() {
  try {
    const resp = await fetch("/auth/me");
    const data = await resp.json();
    renderAuth(data.user);
  } catch { renderAuth(null); }
}

function renderAuth(user) {
  if (!authArea) return;
  if (user) {
    authArea.innerHTML = `
      <div class="auth-user">
        ${user.avatar ? `<img src="${user.avatar}" class="auth-avatar" alt=""/>` : ""}
        <span class="auth-name">${user.name || user.email}</span>
        <button class="auth-btn auth-btn-logout" onclick="logout()">Sign Out</button>
      </div>`;
  } else {
    authArea.innerHTML = `
      <button class="auth-btn auth-btn-google" onclick="window.location.href='/auth/google'">
        <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Sign in
      </button>
      <button class="auth-btn auth-btn-signup" onclick="window.location.href='/auth/google'">
        Sign up free
      </button>`;
  }
}

async function logout() {
  await fetch("/auth/logout", { method: "POST" });
  renderAuth(null);
}

loadAuth();

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
    : rubricFiles.length === 0 ? "Upload a rubric or answer key to get started" : "Upload student work to enable grading";
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
    emptyEl.classList.add("hidden"); fileAreaEl.classList.remove("hidden");
    zoneEl.querySelector(".upload-icon-wrap").classList.add("hidden");
    zoneEl.querySelector(".upload-card-title").classList.add("hidden");
    inputEl.style.pointerEvents = "none";
  } else {
    emptyEl.classList.remove("hidden"); fileAreaEl.classList.add("hidden");
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
rubricList.addEventListener("click", e => { const b = e.target.closest(".pill-remove[data-name]"); if (b) { e.stopPropagation(); removeRubricFile(b.dataset.name); } });
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
workList.addEventListener("click", e => { const b = e.target.closest(".pill-remove[data-name]"); if (b) { e.stopPropagation(); removeWorkFile(b.dataset.name); } });
workInput.addEventListener("change", e => addWorkFiles(e.target.files));
addMoreInput.addEventListener("change", e => addWorkFiles(e.target.files));
workZone.addEventListener("dragover", e => { e.preventDefault(); workZone.classList.add("drag"); });
workZone.addEventListener("dragleave", () => workZone.classList.remove("drag"));
workZone.addEventListener("drop", e => { e.preventDefault(); workZone.classList.remove("drag"); addWorkFiles(e.dataTransfer.files); });

/* ── Score ring ── */
function animateScore(score) {
  const arc = document.getElementById("scoreArc");
  if (arc) arc.style.strokeDashoffset = 326.7 - (score / 100) * 326.7;
  const numEl = document.getElementById("scoreDisplay");
  let current = 0; const step = score / 60;
  const interval = setInterval(() => {
    current = Math.min(current + step, score);
    if (numEl) numEl.textContent = Math.round(current);
    if (current >= score) clearInterval(interval);
  }, 16);
}

/* ── Edit grade ── */
document.getElementById("editGradeBtn").addEventListener("click", () => {
  document.getElementById("editScore").value  = document.getElementById("scoreDisplay").textContent;
  document.getElementById("editLetter").value = document.getElementById("letterGrade").textContent;
  document.getElementById("editModal").classList.remove("hidden");
});
document.getElementById("editCancelBtn").addEventListener("click", () => document.getElementById("editModal").classList.add("hidden"));
document.getElementById("editSaveBtn").addEventListener("click", () => {
  const s = parseInt(document.getElementById("editScore").value);
  const l = document.getElementById("editLetter").value.trim();
  if (!isNaN(s) && s >= 0 && s <= 100) { document.getElementById("scoreDisplay").textContent = s; animateScore(s); }
  if (l) document.getElementById("letterGrade").textContent = l;
  document.getElementById("editModal").classList.add("hidden");
});

/* ── Edit text buttons ── */
document.querySelectorAll(".edit-text-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target   = document.getElementById(btn.dataset.target);
    const isEditing= target.getAttribute("contenteditable") === "true";
    target.setAttribute("contenteditable", isEditing ? "false" : "true");
    if (!isEditing) target.focus();
    btn.textContent = isEditing ? "✏️ Edit" : "✓ Done";
    btn.classList.toggle("active", !isEditing);
  });
});

/* ── Approve ── */
document.getElementById("approveBtn").addEventListener("click", () => {
  document.querySelectorAll(".editable-text").forEach(el => el.setAttribute("contenteditable","false"));
  document.querySelectorAll(".edit-text-btn").forEach(b => { b.textContent="✏️ Edit"; b.classList.remove("active"); });
  const dot    = document.querySelector(".approve-dot");
  const status = document.getElementById("approveStatus");
  dot.classList.replace("pending","approved");
  status.childNodes[1].textContent = " Approved by teacher";
  const btn = document.getElementById("approveBtn");
  btn.textContent = "✓ Approved — Print";
  btn.classList.add("approved");
  setTimeout(() => window.print(), 300);
});

/* ── Render results ── */
function renderResults(data) {
  setTimeout(() => animateScore(data.score || 0), 100);
  document.getElementById("letterGrade").textContent = data.letter || "—";
  const score = data.score || 0;
  const subtitle = score>=90?"Excellent work":score>=80?"Good performance":score>=70?"Satisfactory":score>=60?"Needs improvement":"Significant work needed";
  document.getElementById("scoreSubtitle").textContent = subtitle;

  const conf = data.confidence || 0;
  document.getElementById("confidenceBar").style.width   = conf + "%";
  document.getElementById("confidenceLabel").textContent = `Confidence: ${conf}% — ${data.confidence_label || ""}`;
  document.getElementById("confidenceNote").textContent  = data.confidence_note || "";

  const logicBar = document.getElementById("logicBar");
  if (data.grading_logic) { document.getElementById("logicText").textContent = data.grading_logic; logicBar.classList.remove("hidden"); }
  else { logicBar.classList.add("hidden"); }

  const criteriaList = document.getElementById("criteriaList");
  criteriaList.innerHTML = "";
  if (Array.isArray(data.criteria) && data.criteria.length) {
    document.getElementById("criteriaSection").classList.remove("hidden");
    data.criteria.forEach(c => {
      const badgeClass = c.status==="pass"?"badge-pass":c.status==="partial"?"badge-partial":"badge-fail";
      const weightTag  = c.weight && c.weight!=="N/A" ? `<span class="criteria-weight">${c.weight}</span>` : "";
      const row = document.createElement("div");
      row.className = "criteria-row";
      row.innerHTML = `<div class="criteria-badge ${badgeClass}">${c.points_earned}/${c.points_possible}</div>
        <div class="criteria-content">
          <div class="criteria-name">${c.name}${weightTag}</div>
          <div class="criteria-feedback">${c.feedback}</div>
        </div>`;
      criteriaList.appendChild(row);
    });
  }

  [["strengthsText","strengthsSection",data.strengths],["improvementsText","improvementsSection",data.improvements],["summaryText","summarySection",data.summary]]
    .forEach(([textId, sectionId, content]) => {
      if (content) { document.getElementById(textId).textContent = content; document.getElementById(sectionId).classList.remove("hidden"); }
      else { document.getElementById(sectionId).classList.add("hidden"); }
    });

  const dot    = document.querySelector(".approve-dot");
  const status = document.getElementById("approveStatus");
  dot.className = "approve-dot pending";
  status.childNodes[1].textContent = " Pending teacher review";
  const approveBtn = document.getElementById("approveBtn");
  approveBtn.textContent = "✓ Approve & Print";
  approveBtn.classList.remove("approved");

  loadingBox.classList.add("hidden");
  resultsBox.classList.remove("hidden");
  resultsBox.scrollIntoView({ behavior:"smooth", block:"start" });
}

/* ── Grade ── */
gradeBtn.addEventListener("click", async () => {
  hideError();
  gradeBtn.disabled = true;
  loadingBox.classList.remove("hidden");
  resultsBox.classList.add("hidden");
  setStatus("Analyzing submission with AI...");

  const dots = loadingBox.querySelectorAll(".step-dot");
  dots.forEach(d => d.classList.remove("active","done"));
  let i = 0;
  const stepInterval = setInterval(() => {
    if (i > 0) dots[i-1].classList.replace("active","done");
    if (i < dots.length) { dots[i].classList.add("active"); i++; }
    else clearInterval(stepInterval);
  }, 900);

  try {
    const form = new FormData();
    rubricFiles.forEach(f => form.append("rubric_files", f, f.name));
    workFiles.forEach(f => form.append("work_files", f, f.name));
    const instr = specialInstructions.value.trim();
    if (instr)         form.append("special_instructions", instr);
    if (selectedGrade) form.append("grade_level", selectedGrade);

    const resp = await fetch("/grade", { method:"POST", body:form });
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
  rubricFiles = []; workFiles = []; selectedGrade = null;
  document.querySelectorAll(".grade-level-btn").forEach(b => b.classList.remove("selected"));
  renderFileList(rubricFiles, rubricList, rubricEmpty, rubricFileArea, rubricZone, rubricInput);
  renderFileList(workFiles, workList, workEmpty, workFileArea, workZone, workInput);
  specialInstructions.value = "";
  window.scrollTo({ top:0, behavior:"smooth" });
});
