/* ── Auth ── */
const authArea = document.getElementById("authArea");

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
      <button class="auth-btn auth-btn-google" onclick="window.location.href='/auth/google'">Sign in</button>
      <button class="auth-btn auth-btn-signup" onclick="window.location.href='/auth/google'">Sign up free</button>`;
  }
}

async function logout() {
  await fetch("/auth/logout", { method:"POST" });
  window.location.href = "/";
}

/* ── State ── */
let allGrades  = [];
let filteredGrades = [];

/* ── Load grades ── */
async function loadGrades() {
  try {
    const resp = await fetch("/api/grades");
    if (resp.status === 401) {
      document.getElementById("gradesLoading").classList.add("hidden");
      document.getElementById("gradesEmpty").classList.remove("hidden");
      document.querySelector(".dash-empty-title").textContent = "Sign in to view your grades";
      document.querySelector(".dash-empty-sub").textContent = "Create a free account to save and review all your grading history.";
      return;
    }
    const data = await resp.json();
    allGrades = data.grades || [];
    filteredGrades = [...allGrades];
    renderStats();
    renderGrades();
    document.getElementById("gradesLoading").classList.add("hidden");
  } catch (e) {
    document.getElementById("gradesLoading").classList.add("hidden");
    document.getElementById("gradesEmpty").classList.remove("hidden");
  }
}

/* ── Stats ── */
function renderStats() {
  const total = allGrades.length;
  const avg   = total > 0 ? Math.round(allGrades.reduce((s, g) => s + (g.score || 0), 0) / total) : 0;
  const high  = total > 0 ? Math.max(...allGrades.map(g => g.score || 0)) : 0;
  document.getElementById("statTotal").textContent = total;
  document.getElementById("statAvg").textContent   = total > 0 ? avg + "%" : "—";
  document.getElementById("statHigh").textContent  = total > 0 ? high + "%" : "—";
}

/* ── Render grades list ── */
function renderGrades() {
  const listEl = document.getElementById("gradesList");
  const emptyEl = document.getElementById("gradesEmpty");

  if (filteredGrades.length === 0) {
    listEl.classList.add("hidden");
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  listEl.classList.remove("hidden");
  listEl.innerHTML = "";

  filteredGrades.forEach(g => {
    const files    = Array.isArray(g.work_files) ? g.work_files.join(", ") : "Unknown file";
    const dateStr  = g.created_at ? new Date(g.created_at).toLocaleDateString("en-CA", {year:"numeric",month:"short",day:"numeric"}) : "—";
    const gradeTag = g.grade_level ? `<span class="grade-card-tag">Grade ${g.grade_level}</span>` : "";
    const confTag  = g.confidence  ? `<span class="grade-card-conf">${g.confidence}% confidence</span>` : "";

    const card = document.createElement("div");
    card.className = "grade-card";
    card.innerHTML = `
      <div class="grade-card-score">
        <div class="grade-card-num">${g.score ?? "—"}</div>
        <div class="grade-card-letter">${g.letter ?? ""}</div>
      </div>
      <div class="grade-card-info">
        <div class="grade-card-files">${files}</div>
        <div class="grade-card-meta">
          <span class="grade-card-date">${dateStr}</span>
          ${gradeTag}
          ${confTag}
        </div>
      </div>
      <div class="grade-card-actions">
        <button class="grade-delete-btn" data-id="${g.id}">🗑 Delete</button>
      </div>`;

    card.addEventListener("click", e => {
      if (!e.target.closest(".grade-card-actions")) openDetail(g);
    });

    card.querySelector(".grade-delete-btn").addEventListener("click", async e => {
      e.stopPropagation();
      if (!confirm("Delete this grade record?")) return;
      await deleteGrade(g.id);
    });

    listEl.appendChild(card);
  });
}

/* ── Delete ── */
async function deleteGrade(id) {
  try {
    await fetch(`/api/grades/${id}`, { method:"DELETE" });
    allGrades = allGrades.filter(g => g.id !== id);
    applyFilters();
    renderStats();
  } catch (e) {
    alert("Could not delete grade.");
  }
}

/* ── Detail modal ── */
function openDetail(g) {
  const overlay = document.getElementById("detailOverlay");
  const body    = document.getElementById("detailBody");
  const title   = document.getElementById("detailTitle");
  const files   = Array.isArray(g.work_files) ? g.work_files.join(", ") : "Unknown";
  title.textContent = files;

  const r = g.result || {};
  let html = `
    <div class="detail-section">
      <div class="detail-section-title">Score</div>
      <p style="font-size:32px;font-weight:800;color:#818cf8;font-family:'JetBrains Mono',monospace;">${g.score ?? "—"} <span style="font-size:18px;color:#64748b;">/ 100 · ${g.letter ?? ""}</span></p>
      ${r.grading_logic ? `<p style="font-size:12px;color:#64748b;margin-top:8px;line-height:1.6;">${r.grading_logic}</p>` : ""}
    </div>`;

  if (Array.isArray(r.criteria) && r.criteria.length) {
    html += `<div class="detail-section"><div class="detail-section-title">Rubric Breakdown</div>`;
    r.criteria.forEach(c => {
      const color = c.status==="pass"?"#4ade80":c.status==="partial"?"#fbbf24":"#f87171";
      html += `<div class="detail-criteria-row">
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:${color};min-width:50px;">${c.points_earned}/${c.points_possible}</span>
        <div><div style="font-weight:600;color:#fff;font-size:13px;margin-bottom:3px;">${c.name}</div>
        <div style="font-size:12px;color:#94a3b8;line-height:1.6;">${c.feedback}</div></div>
      </div>`;
    });
    html += `</div>`;
  }

  if (r.strengths)    html += `<div class="detail-section"><div class="detail-section-title">Strengths</div><p class="detail-text">${r.strengths}</p></div>`;
  if (r.improvements) html += `<div class="detail-section"><div class="detail-section-title">Improvements</div><p class="detail-text">${r.improvements}</p></div>`;
  if (r.summary)      html += `<div class="detail-section"><div class="detail-section-title">Summary</div><p class="detail-text">${r.summary}</p></div>`;

  body.innerHTML = html;
  overlay.classList.remove("hidden");
}

document.getElementById("detailClose").addEventListener("click", () => {
  document.getElementById("detailOverlay").classList.add("hidden");
});
document.getElementById("detailOverlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});

/* ── Filters ── */
function applyFilters() {
  const search = document.getElementById("filterInput").value.toLowerCase();
  const grade  = document.getElementById("filterGrade").value.replace("Grade ", "");
  const sort   = document.getElementById("filterSort").value;

  filteredGrades = allGrades.filter(g => {
    const files = Array.isArray(g.work_files) ? g.work_files.join(" ").toLowerCase() : "";
    const letter = (g.letter || "").toLowerCase();
    const matchSearch = !search || files.includes(search) || letter.includes(search);
    const matchGrade  = !grade || String(g.grade_level) === grade;
    return matchSearch && matchGrade;
  });

  filteredGrades.sort((a, b) => {
    if (sort === "newest")  return new Date(b.created_at) - new Date(a.created_at);
    if (sort === "oldest")  return new Date(a.created_at) - new Date(b.created_at);
    if (sort === "highest") return (b.score || 0) - (a.score || 0);
    if (sort === "lowest")  return (a.score || 0) - (b.score || 0);
    return 0;
  });

  renderGrades();
}

document.getElementById("filterInput").addEventListener("input",  applyFilters);
document.getElementById("filterGrade").addEventListener("change", applyFilters);
document.getElementById("filterSort").addEventListener("change",  applyFilters);

/* ── Init ── */
loadAuth();
loadGrades();
