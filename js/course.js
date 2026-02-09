function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function loadCourse(){
  const listEl = document.querySelector("#sectionList");
  const statusEl = document.querySelector("#status");
  const searchEl = document.querySelector("#search");

  try{
    statusEl.textContent = "Loading sections…";
    const res = await fetch("data/content.json", {cache:"no-store"});
    if(!res.ok) throw new Error("Could not load content.json");
    const data = await res.json();
    const sections = data.sections || [];

    const render = (q)=>{
      const ql = (q || "").trim().toLowerCase();
      listEl.innerHTML = "";

      const visible = [];
      for (const s of sections){
        const sMatch =
          (s.title||"").toLowerCase().includes(ql) ||
          (s.summary||"").toLowerCase().includes(ql);

        const subs = (s.subsections||[]).filter(ss =>
          (ss.title||"").toLowerCase().includes(ql) ||
          (ss.description||"").toLowerCase().includes(ql)
        );

        if (!ql || sMatch || subs.length){
          visible.push({
            ...s,
            subsections: !ql ? (s.subsections||[]) : (sMatch ? (s.subsections||[]) : subs)
          });
        }
      }

      if (!visible.length){
        listEl.innerHTML = "<li class='card'>No sections match your search.</li>";
        statusEl.textContent = ql ? `No results for “${ql}”.` : "No sections found.";
        return;
      }

      for (const s of visible){
        const li = document.createElement("li");
        li.className = "card";

        const subLinks = (s.subsections||[]).map(ss => `
          <li style="margin-top:10px;">
            <a class="section-sub" href="lesson.html?section=${encodeURIComponent(s.id)}&sub=${encodeURIComponent(ss.id)}">
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                <div>
                  <div style="font-weight:850;">${escapeHtml(ss.title)}</div>
                  <div class="topic-meta">
                    ${ss.duration ? `<span class="pill">${escapeHtml(ss.duration)}</span>` : ""}
                  </div>
                  ${ss.description ? `<div style="color: var(--muted); margin-top:4px; font-size:13px;">${escapeHtml(ss.description)}</div>` : ""}
                </div>
              </div>
            </a>
          </li>
        `).join("");

        li.innerHTML = `
          <div class="kicker">Section</div>
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-top:4px;">
            <div>
              <div style="font-weight:950; font-size:20px;">${escapeHtml(s.title)}</div>
              ${s.summary ? `<p style="margin:10px 0 0; color: var(--muted);">${escapeHtml(s.summary)}</p>` : ""}
            </div>
            <div><span class="pill">${(s.subsections||[]).length} sub-section(s)</span></div>
          </div>
          <hr class="sep">
          <div class="kicker">Sub-sections</div>
          <ul style="list-style:none; padding:0; margin:8px 0 0;">${subLinks || "<li><span class='pill'>No sub-sections</span></li>"}</ul>
        `;
        listEl.appendChild(li);
      }

      statusEl.textContent = ql
        ? `Showing ${visible.length} section(s) matching “${ql}”.`
        : `Loaded ${sections.length} sections.`;
    };

    render("");
    searchEl.addEventListener("input", ()=> render(searchEl.value));

  }catch(err){
    console.error(err);
    statusEl.textContent = "Could not load sections. Run this site via a local server (not file://).";
    listEl.innerHTML = "<li class='card'>Tip: Use VS Code “Live Server” or `python -m http.server` so JSON fetch works.</li>";
  }
}

document.addEventListener("DOMContentLoaded", loadCourse);