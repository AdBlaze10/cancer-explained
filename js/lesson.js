function getParam(name){
  const params = new URLSearchParams(location.search);
  return params.get(name);
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function toEmbedUrl(url){
  const u = String(url || "").trim();
  if (!u) return "";
  if (u.includes("youtube.com/embed/")) return u;

  let id = "";
  try{
    const parsed = new URL(u);
    if (parsed.hostname.includes("youtu.be")){
      id = parsed.pathname.replace("/","").trim();
    }else{
      id = parsed.searchParams.get("v") || "";
    }
  }catch{
    id = u;
  }
  if (!id) return "";
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
}

function setBanner(src){
  const img = document.getElementById("titleBanner");
  if (img && src) img.setAttribute("src", src);
}

async function loadLesson(){
  const sectionId = getParam("section") || "";
  const subId = getParam("sub") || "";

  const titleEl = document.querySelector("#lessonTitle");
  const descEl = document.querySelector("#lessonDesc");
  const metaEl = document.querySelector("#lessonMeta");
  const videoWrap = document.querySelector("#videoWrap");
  const textEl = document.querySelector("#lessonText");
  const qWrap = document.querySelector("#questionsWrap");
  const navEl = document.querySelector("#sideNav");

  try{
    const res = await fetch("data/content.json", {cache:"no-store"});
    if(!res.ok) throw new Error("Could not load content.json");
    const data = await res.json();
    const sections = data.sections || [];

    const section = sections.find(s => s.id === sectionId) || sections[0];
    if(!section){
      titleEl.textContent = "Section not found";
      return;
    }

    setBanner(section.banner || "assets/banners/default.svg");

    navEl.innerHTML = sections.map(s=>{
      const subs = (s.subsections||[]).map(ssShow=>{
        const active = (s.id === sectionId && ssShow.id === subId) ? "style='border-color: rgba(124,58,237,.35); background: rgba(124,58,237,.06)'" : "";
        return `<li style="margin-top:8px;"><a ${active} href="lesson.html?section=${encodeURIComponent(s.id)}&sub=${encodeURIComponent(ssShow.id)}">${escapeHtml(ssShow.title)}</a></li>`;
      }).join("");
      return `
        <li class="card" style="padding:12px;">
          <div class="kicker">Section</div>
          <div style="font-weight:950; margin-top:6px;">${escapeHtml(s.title)}</div>
          <ul class="topic-list" style="margin-top:10px;">
            ${subs || "<li><span class='pill'>No sub-sections</span></li>"}
          </ul>
        </li>
      `;
    }).join("");

    const lesson = (section.subsections||[]).find(ss => ss.id === subId) || (section.subsections||[])[0];
    if(!lesson){
      titleEl.textContent = "Sub-section not found";
      descEl.textContent = "Could not find a matching sub-section in this section.";
      return;
    }

    const newUrl = new URL(location.href);
    if (!newUrl.searchParams.get("section")) newUrl.searchParams.set("section", section.id);
    if (!newUrl.searchParams.get("sub")) newUrl.searchParams.set("sub", lesson.id);
    history.replaceState({}, "", newUrl.toString());

    titleEl.textContent = lesson.title || "Untitled sub-section";
    descEl.textContent = lesson.description || "";
    metaEl.innerHTML = `
      ${section.title ? `<span class="pill">${escapeHtml(section.title)}</span>` : ""}
      ${lesson.duration ? `<span class="pill">${escapeHtml(lesson.duration)}</span>` : ""}
    `;

    const embed = toEmbedUrl(lesson.videoUrl || "");
    videoWrap.innerHTML = embed
      ? `<div class="iframe-wrap"><iframe src="${embed}" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`
      : `<div class="card">No video URL found for this sub-section. Add one in <code>data/content.json</code>.</div>`;

    const paras = Array.isArray(lesson.text) ? lesson.text : [lesson.text].filter(Boolean);
    textEl.innerHTML = paras.map(p => `<p>${escapeHtml(p)}</p>`).join("");

    const formId = lesson.quizFormId || "";
    const questions = (lesson.questions || []); //.slice(0,5);
    qWrap.innerHTML = "";

    const form = document.createElement("form");
    form.id = "quizForm";
    // form.addEventListener("submit", e => e.preventDefault());
    form.method = "POST";
    form.action = `https://docs.google.com/forms/d/e/${formId}/formResponse`;
    form.target = "hidden_iframe";
    form.onsubmit = "submitted = true"
    qWrap.appendChild(form);
    
    questions.forEach((q, idx)=>{
      const idBase = `q${idx}`;
      const fieldName = q.fieldName || idBase;
      const opts = (q.options || []).map((opt, oi)=>{
        const oid = `${idBase}_o${oi}`;
        return `
          <label class="opt" for="${oid}">
            <input type="radio" id="${oid}" name="${fieldName}" required value="${escapeHtml(opt)}">
            <span>${escapeHtml(opt)}</span>
          </label>
        `;
      }).join("");

      const block = document.createElement("div");
      block.className = "q";
      block.innerHTML = `
        <h4>${idx+1}. ${escapeHtml(q.question || "")}</h4>
        <div class="opts">${opts}</div>
        <div class="feedback" id="${idBase}_fb"></div>
      `;
      form.appendChild(block);
    });

    const buttonsWrap = document.createElement("div");
    buttonsWrap.style = "display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;";
    buttonsWrap.innerHTML = `
    <button class="btn" id="submitAnswers" type="button">Submit answers</button>
    <button class="btn secondary" id="resetQuiz" type="button">Reset</button>
    <span class="pill" id="score"></span>
    `;
    form.appendChild(buttonsWrap);

    const submitBtn = document.querySelector("#submitAnswers");
    const resetBtn = document.querySelector("#resetQuiz");
    const scoreEl = document.querySelector("#score");

    const compute = ()=>{
      let correct = 0;
      questions.forEach((q, idx)=>{
        const idBase = `q${idx}`;
        const fieldName = q.fieldName || idBase;
        const picked = document.querySelector(`input[name="${fieldName}"]:checked`);
        const fb = document.querySelector(`#${idBase}_fb`);
        const correctIndex = q.correctIndex;
        const correctValue = escapeHtml((q.options || [])[correctIndex] ?? "");

        if(!picked){
          fb.className = "feedback";
          fb.textContent = "Pick an answer to see feedback.";
          return;
        }

        const chosen = picked.value;
        if(chosen === correctValue){
          correct += 1;
          fb.className = "feedback good";
          fb.textContent = q.explanation ? `Correct. ${q.explanation}` : "Correct.";
        }else{
          fb.className = "feedback bad";
          const correctText = (q.options || [])[correctIndex] ?? "the correct option";
          fb.textContent = q.explanation
            ? `Not quite. Correct answer: ${correctText}. ${q.explanation}`
            : `Not quite. Correct answer: ${correctText}.`;
        }
      });
      scoreEl.textContent = `Score: ${correct}/${questions.length}`;
      form.submit();
      document.getElementById('thankyou').style.display = 'block';
    };

    const reset = ()=>{
      document.querySelectorAll(`#questionsWrap input[type="radio"]`).forEach(r => r.checked = false);
      document.querySelectorAll(`#questionsWrap .feedback`).forEach(f => { f.className = "feedback"; f.textContent = ""; });
      scoreEl.textContent = "";
      window.scrollTo({top:0, behavior:"smooth"});
    };

    submitBtn.addEventListener("click", compute);
    resetBtn.addEventListener("click", reset);

  }catch(err){
    console.error(err);
    titleEl.textContent = "Could not load lesson";
    descEl.textContent = "Run this site via a local server (not file://) so JSON fetch works.";
  }
}

document.addEventListener("DOMContentLoaded", loadLesson);