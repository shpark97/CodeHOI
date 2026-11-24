/* CodeHOI project page. Everything shown comes from static/data/site.js (window.SITE), which
   paper/fig_code/project_page.py of the CodeHOI repository writes from the runs themselves. */
(() => {
  "use strict";
  const SITE = window.SITE;
  if (!SITE) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const MATTERS = ["rigid", "deformable", "codim", "flowing"];
  const MATTER = { rigid: "Rigid", deformable: "Deformable", codim: "Co-dimensional", flowing: "Flowing" };
  const MODE = { image: "Image + Text", instruction: "3D Scene + Text", text: "Text Only", video: "Video" };
  const VIEW = { input: "Input Video", camera: "Camera View", novel: "Novel View" };
  const AGENT = { object: "Object Agent", hoi: "HOI Agent" };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------ videos: loaded and played only while on screen */
  const controllers = new WeakMap();
  const onScreen = new IntersectionObserver(entries => {
    for (const e of entries) {
      const c = controllers.get(e.target);
      if (c) (e.isIntersecting ? c.show : c.hide)();
    }
  }, { rootMargin: "160px 0px", threshold: 0.01 });
  const watch = (host, controller) => { controllers.set(host, controller); onScreen.observe(host); };

  function video(src, label, loop) {
    const v = document.createElement("video");
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = loop; v.preload = "none";
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    v.poster = src.replace(/\.mp4$/, ".jpg");
    v.dataset.src = src;
    v.setAttribute("aria-label", label);
    if (reduce) v.controls = true;
    return v;
  }
  const load = v => { if (!v.getAttribute("src")) { v.src = v.dataset.src; v.load(); } };
  const play = v => { if (!reduce) { const p = v.play(); if (p) p.catch(() => {}); } };

  const solo = v => ({ show() { load(v); play(v); }, hide() { v.pause(); } });

  /* several views of one clip, frame for frame: they start together, the first leads, the others are pulled back
     onto its time when they drift, and all restart together when it ends */
  function together(videos) {
    const [lead, ...rest] = videos;
    let visible = false, raf = 0;
    const ready = () => videos.every(v => v.readyState >= 3);
    const tick = () => {
      if (!visible) return;
      const t = lead.currentTime;
      for (const v of rest) if (!v.seeking && Math.abs(v.currentTime - t) > 0.07) v.currentTime = t;
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!visible || !ready() || reduce) return;
      videos.forEach(play);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    videos.forEach(v => v.addEventListener("canplay", start));
    lead.addEventListener("ended", () => {
      videos.forEach(v => { v.currentTime = 0; });
      videos.forEach(play);
    });
    return {
      show() { visible = true; videos.forEach(load); start(); },
      hide() { visible = false; cancelAnimationFrame(raf); videos.forEach(v => v.pause()); },
    };
  }

  const tags = (host, solvers) => {
    host.textContent = "";
    for (const s of solvers) host.append(el("span", "tag", s));
    return host;
  };
  const BUBBLE = '<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M8 2h32a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H20l-9 8v-8H8a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z" fill="#fff"/><circle cx="14" cy="16" r="3" fill="#a0457a"/><circle cx="24" cy="16" r="3" fill="#a0457a"/><circle cx="34" cy="16" r="3" fill="#a0457a"/></svg>';
  /* a task's input: the photograph or the 3D scene at rest, or a speech bubble when the task is text alone */
  function inputOf(item) {
    if (item.input) {
      const im = new Image();
      im.src = `static/img/input/${item.id}.jpg`;
      im.alt = item.mode === "image" ? "The input photograph" : "The input 3D scene";
      im.loading = "lazy";
      return im;
    }
    const b = el("span", "bubble");
    b.innerHTML = BUBBLE;
    b.setAttribute("role", "img");
    b.setAttribute("aria-label", "Text only");
    return b;
  }
  const quote = text => el("blockquote", "", `“${text}”`);

  /* ------------------------------------------------------------ the kinds of matter follow one another
     Each stays for its dwell (ten seconds) while it is on screen and stops for good once the reader
     chooses one; a holder, if given, makes it wait while the pointer rests there (the code, which takes time to read).
     The chosen button shows the time spent as --p (0 to 1). */
  const DWELL = 10;
  function rotate({ watched, held: holder, buttons, dwell, pick }) {
    let i = 0, spent = 0, last = 0, seen = false, fits = true, held = false, on = !reduce, raf = 0;
    const mark = p => buttons.forEach((b, k) => {
      if (on && k === i) b.style.setProperty("--p", p.toFixed(4)); else b.style.removeProperty("--p");
    });
    const step = now => {
      raf = 0;
      if (!on || !seen) return;
      if (!held && fits && !document.hidden) spent += Math.min(now - last, 120) / 1000;
      last = now;
      if (spent >= dwell(i)) { spent = 0; i = (i + 1) % buttons.length; pick(i); }
      mark(Math.min(spent / dwell(i), 1));
      raf = requestAnimationFrame(step);
    };
    const run = () => { if (on && seen && !raf) { last = performance.now(); raf = requestAnimationFrame(step); } };
    /* a set much taller than the screen (a phone's list of cards) is read by scrolling: it is left alone */
    const measure = () => { fits = watched.offsetHeight <= innerHeight * 1.5; };
    new IntersectionObserver(es => { seen = es[es.length - 1].intersectionRatio >= 0.2; measure(); run(); }, { threshold: [0, 0.2] }).observe(watched);
    addEventListener("resize", measure);
    if (holder) {
      holder.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") held = true; });
      holder.addEventListener("pointerleave", () => { held = false; });
    }
    return { stop() { on = false; mark(0); } };
  }

  /* ------------------------------------------------------------ the first card: one run */
  function initRun() {
    const root = $("#run");
    const view = $(".run-view", root), v = $("video", view);
    const side = $(".run-side", root), picker = $(".picker", root);
    const tabsHost = $(".code-tabs", root), fileLab = $(".code-file", root), body = $(".code-body", root);
    const runs = SITE.stage;
    const stacked = matchMedia("(max-width: 1020px)");
    let cur = -1, tabName = null, visible = false, swapTimer = 0, turn = null;
    const ICON = {
      accept: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.6l3 3 6-7"/></svg>',
      revise: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12.6 6.2A5 5 0 1 0 13 9.6M12.9 2.8v3.6H9.3"/></svg>',
    };
    const SCORES = ["Hands", "Contact", "Objects", "Motion"];

    runs.forEach((r, i) => {
      const b = el("button", "pick");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.dataset.matter = r.matter;
      b.setAttribute("aria-selected", "false");
      const frame = el("span", "pick-img"), im = new Image();
      im.src = `static/img/stage/${r.id}.jpg`;
      im.alt = "";
      frame.append(im);
      b.append(frame, el("span", "pick-lab", MATTER[r.matter]));
      b.addEventListener("click", () => select(i));
      picker.append(b);
    });
    /* the runs follow one another until the reader touches the card */
    const stop = () => { if (turn) turn.stop(); };
    root.addEventListener("pointerdown", stop);
    root.addEventListener("keydown", stop);
    body.addEventListener("wheel", stop, { passive: true });

    function rounds(run) {
      const host = $('[data-run="rounds"]', root);
      host.textContent = "";
      for (const r of run.rounds) {
        const li = el("li", `round ${r.verdict === "accept" ? "accept" : "revise"}`);
        const ic = el("span", "r-ic");
        ic.innerHTML = ICON[r.verdict === "accept" ? "accept" : "revise"];
        const box = el("div");
        const h = el("p", "r-h", `Round ${r.round} `);
        h.style.margin = "0";
        h.append(el("span", "", r.verdict === "accept" ? "Accept" : "Revise"));
        box.append(h);
        for (const s of r.said) box.append(el("q", "", s));
        if (r.verdict === "accept") {
          h.append(el("small", "", `${r.checks} checks passed`));
          const sc = el("div", "scores");
          r.scores.forEach((n, k) => {
            const one = el("span", "score", SCORES[k]);
            const pips = el("span", "pips");
            for (let j = 1; j <= 5; j++) pips.append(el("i", j <= n ? "on" : ""));
            pips.setAttribute("role", "img");
            pips.setAttribute("aria-label", `${n} of 5`);
            one.append(pips);
            sc.append(one);
          });
          box.append(sc);
        }
        li.append(ic, box);
        host.append(li);
      }
    }

    function code(run) {
      tabsHost.textContent = "";
      /* a task on a 3D scene is given its objects: no object program exists, and the Objects tab says so on its line 1 */
      const parts = run.mode === "instruction" && !run.code.some(c => c.tab === "Objects")
        ? [{ tab: "Objects", agent: "object", given: true, parts: [{ from: 1, lines: ['<span class="c"># given as the 3D scene</span>'] }] }, ...run.code]
        : run.code;
      const pickTab = parts.find(c => c.tab === tabName) || parts[parts.length - 1];
      for (const c of parts) {
        const b = el("button", `code-tab${c.given ? " given" : ""}`, c.tab);
        b.type = "button";
        b.setAttribute("role", "tab");
        b.dataset.agent = c.agent;
        b.setAttribute("aria-selected", String(c === pickTab));
        b.addEventListener("click", () => { tabName = c.tab; code(run); });
        tabsHost.append(b);
      }
      fileLab.textContent = "";
      if (pickTab.file) fileLab.append(`${AGENT[pickTab.agent]} · `, el("b", "", pickTab.file));
      body.textContent = "";
      pickTab.parts.forEach((part, k) => {
        if (k) {
          const skip = el("div", "cl skip");
          skip.append(el("span", "n", ""), el("span", "t", "⋯"));
          body.append(skip);
        }
        part.lines.forEach((html, j) => {
          const line = el("div", "cl");
          const t = el("span", "t");
          t.innerHTML = html || "​";          /* the builder's own escaped HTML */
          line.append(el("span", "n", String(part.from + j)), t);
          body.append(line);
        });
      });
      body.scrollTop = 0; body.scrollLeft = 0;
    }

    function fill(run) {
      tags($(".tags", side), run.solvers);
      side.dataset.matter = run.matter;
      $('[data-run="mode"]', root).textContent = MODE[run.mode];
      const inRow = $('[data-run="input"]', root);
      inRow.textContent = "";
      inRow.append(inputOf(run), quote(run.text));
      rounds(run);
    }
    /* every run takes the height of the tallest, so the card keeps its size as the runs follow one another */
    function level() {
      side.style.minHeight = "";
      if (stacked.matches) return;                      /* the panel is under the video: nothing beside it to keep level */
      let tall = 0;
      for (const run of runs) { fill(run); tall = Math.max(tall, side.offsetHeight); }
      side.style.minHeight = `${tall}px`;
      if (cur >= 0) fill(runs[cur]);
    }

    function select(i) {
      if (i === cur) return;
      const first = cur < 0;
      cur = i;
      const run = runs[i];
      root.dataset.matter = run.matter;
      $$(".pick", picker).forEach((b, k) => b.setAttribute("aria-selected", String(k === i)));
      fill(run);
      code(run);
      const src = `static/video/stage/${run.id}.mp4`;
      const swap = () => {
        v.poster = src.replace(/\.mp4$/, ".jpg");
        v.src = src;
        v.load();
        if (visible) play(v);
      };
      clearTimeout(swapTimer);
      if (first) swap();
      else { view.classList.add("swap"); swapTimer = setTimeout(swap, 240); }
    }
    v.addEventListener("loadeddata", () => view.classList.remove("swap"));
    v.loop = true;
    if (reduce) v.controls = true;
    watch(view, { show() { visible = true; play(v); }, hide() { visible = false; v.pause(); } });
    level();
    let resized = 0;
    addEventListener("resize", () => { clearTimeout(resized); resized = setTimeout(level, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(level);
    select(0);
    turn = rotate({ watched: root, held: $(".run-code", root), buttons: $$(".pick", picker), dwell: () => DWELL, pick: select });
  }

  /* ------------------------------------------------------------ results by kind of matter */
  function matterTabs(host, results, pick, dwell) {
    let turn = null;
    const choose = k => {
      buttons.forEach((x, j) => x.setAttribute("aria-selected", String(j === k)));
      pick(MATTERS[k]);
    };
    const buttons = MATTERS.map((m, k) => {
      const b = el("button", "mtab", MATTER[m]);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.dataset.matter = m;
      b.addEventListener("click", () => { if (turn) turn.stop(); choose(k); });
      host.append(b);
      return b;
    });
    choose(0);
    turn = rotate({ watched: results, buttons, dwell: k => dwell(MATTERS[k]), pick: choose });
  }
  /* each kind's results are built when first chosen; the others stay in the page, hidden and paused */
  function byMatter(host, build) {
    const made = new Map();
    return m => {
      if (!made.has(m)) { const set = build(m); made.set(m, set); host.append(set); }
      for (const [k, set] of made) set.hidden = k !== m;
    };
  }

  function initRec() {
    const host = $("#rec"), solvers = $("[data-rec-solvers]");
    /* a kind of matter stays until its longest clip has played once: the pours are longer than the others */
    const dwell = m => Math.max(DWELL, ...SITE.rec[m].map(c => c.seconds + 0.4));
    const show = byMatter(host, m => {
      const set = el("div", "rec-rows");
      set.dataset.matter = m;
      for (const c of SITE.rec[m]) {
        const row = el("div", "rec-row");
        const vids = Object.keys(VIEW).map(view => {
          const fig = el("figure", "vp");
          const v = video(`static/video/rec/${c.id}_${view}.mp4`, `${c.text}: ${VIEW[view].toLowerCase()}`, false);
          fig.append(v, el("figcaption", "vp-lab", VIEW[view]));
          row.append(fig);
          return v;
        });
        watch(row, together(vids));
        set.append(row);
      }
      return set;
    });
    /* the clips carry no captions: only the solvers of the kind shown, beside the tabs */
    matterTabs($('[data-tabs="rec"]'), host, m => {
      show(m);
      solvers.dataset.matter = m;
      tags(solvers, [...new Set(SITE.rec[m].flatMap(c => c.solvers))]);
    }, dwell);
  }

  function initGen() {
    const host = $("#gen");
    matterTabs($('[data-tabs="gen"]'), host, byMatter(host, m => {
      const set = el("div", "ggrid");
      set.dataset.matter = m;
      for (const g of SITE.gen[m]) {
        const card = el("article", "gcard");
        const top = el("div", "g-top");
        top.append(el("span", "mode", MODE[g.mode]), tags(el("span", "tags"), g.solvers));
        const fig = el("figure", "vp");
        const v = video(`static/video/gen/${g.id}.mp4`, g.text, true);
        fig.append(v);
        const input = el("div", "g-in");
        input.append(inputOf(g), quote(g.text));
        card.append(top, fig, input);
        watch(fig, solo(v));
        set.append(card);
      }
      return set;
    }), () => DWELL);
  }

  /* each example: the CodeHOI result (Reference) over the robot hands tracking it in Genesis (Tracking), frame for
     frame, under the input it came from; the row names stand upright at the left, as in the supplementary's figures */
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5v10.5M7.5 12.8 12 17.3l4.5-4.5"/></svg>';
  const ROWS = { ref: "Reference", trk: "Tracking" };
  function initSim() {
    const host = $("#sim");
    const dwell = m => Math.max(DWELL, ...SITE.sim[m].map(c => c.seconds + 0.4));
    matterTabs($('[data-tabs="sim"]'), host, byMatter(host, m => {
      const set = el("div", "sgrid");
      set.dataset.matter = m;
      for (const [k, name] of Object.entries(ROWS)) set.append(el("span", `s-row s-${k}`, name));
      for (const c of SITE.sim[m]) {
        const col = el("div", "scol");
        const vids = Object.entries(ROWS).map(([k, name]) => {
          const fig = el("figure", `vp s-${k}`);
          const v = video(`static/video/sim/${c.id}_${k}.mp4`, `${name}: ${c.text}`, false);
          fig.append(v, el("figcaption", "vp-lab", name));
          return [fig, v];
        });
        const arrow = el("span", "s-arrow");
        arrow.innerHTML = ARROW;
        col.append(el("span", "mode", MODE[c.mode]), vids[0][0], arrow, vids[1][0]);
        watch(col, together(vids.map(x => x[1])));
        set.append(col);
      }
      return set;
    }), dwell);
  }

  /* ------------------------------------------------------------ benchmark */
  function initWaffle() {
    const host = $("#waffle");
    const tasks = [
      { name: "Reconstruction", unit: "clips", blocks: [["Video", 5]] },
      { name: "Generation", unit: "tasks", blocks: [["Image + Text", 5], ["3D Scene + Text", 10], ["Text Only", 5]] },
    ];
    for (const t of tasks) {
      const box = el("div", "w-task"), row = el("div", "w-blocks");
      for (const [name, per] of t.blocks) {
        const g = el("div", "w-group");
        g.setAttribute("role", "img");
        g.setAttribute("aria-label", `${t.name}, ${name}: ${per * 4} ${t.unit}, ${per} per kind of matter`);
        const cells = el("div", "w-cells");
        for (let c = 0; c < per; c++) for (const m of MATTERS) { const i = el("i"); i.dataset.matter = m; cells.append(i); }
        const lab = el("div", "w-lab");
        lab.append(el("b", "", String(per * 4)), el("span", "", name));
        g.append(cells, lab);
        row.append(g);
      }
      box.append(el("div", "w-head", t.name), row);
      host.append(box);
    }
  }

  function initMeters() {
    const T = SITE.table, host = $("#meters"), note = $("#measure-note"), tip = $("#tip");
    const MEASURE = {
      sr: { note: "Share of the 20 tasks solved per kind of matter.", lo: 30, hi: 100, ticks: ["30%", "65%", "100%"], show: v => `${v.toFixed(0)}%`, name: "Success rate" },
      phys: { note: "Worst physical check score per result, averaged over tasks.", lo: 0.7, hi: 1, ticks: ["0.70", "0.85", "1.00"], show: v => v.toFixed(2), name: "Physical plausibility" },
    };
    /* a bar's length within the measure's range: the axis under each group names its ends */
    const share = v => { const M = MEASURE[measure]; return Math.min(Math.max((v - M.lo) / (M.hi - M.lo), 0), 1); };
    let measure = "sr", byPointer = false;
    const showTip = (row, x, y) => {
      const d = row._d;
      tip.textContent = "";
      tip.append(el("b", "", MEASURE[measure].show(d.model[measure][d.k])),
        el("span", "", `${d.model.name} · ${MATTER[T.order[d.k]]}`),
        el("span", "", `Success rate ${d.model.sr[d.k].toFixed(0)}% · Phys ${d.model.phys[d.k].toFixed(2)} · Elo ${d.model.elo[d.k].toFixed(0)}`));
      tip.hidden = false;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = `${Math.max(8, Math.min(x + 14, innerWidth - w - 8))}px`;
      tip.style.top = `${y + 18 + h > innerHeight ? y - h - 10 : y + 18}px`;
    };
    const draw = () => {
      host.textContent = "";
      note.textContent = MEASURE[measure].note;
      T.order.forEach((m, k) => {
        const g = el("div", "mgroup");
        g.dataset.matter = m;
        const h = el("h4", "mdot", MATTER[m]);
        g.append(h);
        const best = Math.max(...T.models.map(x => x[measure][k]));
        for (const model of T.models) {
          const val = model[measure][k];
          const row = el("div", `mrow${val === best ? " best" : ""}`);
          row.tabIndex = 0;
          row._d = { model, k };
          const track = el("div", "mtrack"), fill = el("i");
          fill.style.setProperty("--v", share(val).toFixed(3));
          track.append(fill);
          row.append(el("span", "mname", model.name), el("span", "mval", MEASURE[measure].show(val)), track);
          row.setAttribute("aria-label", `${model.name}, ${MATTER[m]}: ${MEASURE[measure].name} ${MEASURE[measure].show(val)}`);
          const atRow = () => { const r = row.getBoundingClientRect(); showTip(row, r.left + 20, r.bottom - 14); };
          row.addEventListener("pointermove", e => { byPointer = true; showTip(row, e.clientX, e.clientY); });
          row.addEventListener("pointerleave", () => { tip.hidden = true; });
          row.addEventListener("focus", () => { byPointer = false; atRow(); });
          row.addEventListener("blur", () => { tip.hidden = true; });
          g.append(row);
        }
        const axis = el("div", "maxis");
        axis.setAttribute("aria-hidden", "true");
        for (const t of MEASURE[measure].ticks) axis.append(el("span", "", t));
        g.append(axis);
        host.append(g);
      });
    };
    draw();
    $$("#measure button").forEach(b => b.addEventListener("click", () => {
      measure = b.dataset.measure;
      $$("#measure button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      draw();
    }));
    new IntersectionObserver((es, o) => {
      if (es.some(e => e.isIntersecting)) { host.classList.add("in"); o.disconnect(); }
    }, { threshold: 0.25 }).observe(host);
    addEventListener("scroll", () => {                  /* a pointer's tip is left behind; a focused row keeps its tip beside it */
      const row = document.activeElement;
      if (!byPointer && row && row._d && !tip.hidden) { const r = row.getBoundingClientRect(); showTip(row, r.left + 20, r.bottom - 14); }
      else tip.hidden = true;
    }, { passive: true });

    /* the same numbers as a table */
    const cols = [["sr", "SR", v => v.toFixed(1)], ["phys", "Phys", v => v.toFixed(2)], ["elo", "Elo", v => v.toFixed(1)]];
    const table = el("table"), head = el("thead"), tb = el("tbody");
    const r1 = el("tr"), r2 = el("tr");
    r1.append(el("th"));
    r2.append(el("th", "", "Backbone"));
    for (const m of T.order) {                         /* each kind of matter: its colour under its name, a rule before its columns */
      const th = el("th", "gs", MATTER[m]);
      th.colSpan = cols.length;
      th.dataset.matter = m;
      r1.append(th);
      cols.forEach((c, i) => r2.append(el("th", i ? "" : "gs", c[1])));
    }
    head.append(r1, r2);
    for (const model of T.models) {
      const tr = el("tr");
      const th = el("th", "", model.name);
      th.scope = "row";
      tr.append(th);
      T.order.forEach((m, k) => {
        cols.forEach(([key, , fmt], i) => {
          const top = Math.max(...T.models.map(x => x[key][k])) === model[key][k];
          tr.append(el("td", [i ? "" : "gs", top ? "top" : ""].join(" ").trim(), fmt(model[key][k])));
        });
      });
      tb.append(tr);
    }
    table.append(el("caption", "sr", "Generation on CodeHOI-Bench by kind of matter: success rate (percent), physical plausibility and Elo, higher is better"), head, tb);
    const tnote = el("p", "tnote");
    tnote.append(el("b", "", "SR"), ": success rate (%) · ", el("b", "", "Phys"), ": physical plausibility · ", el("b", "", "Elo"),
      ": pairwise rating. Higher is better; the best value in each column is in bold.");
    $("#table").append(table, tnote);
  }

  /* ------------------------------------------------------------ chrome */
  function initNav() {
    const nav = $("#nav");
    const onScroll = () => nav.classList.toggle("scrolled", scrollY > 8);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    const links = new Map($$(".nav-links a").map(a => [a.getAttribute("href").slice(1), a]));
    const seen = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        for (const [id, a] of links) a.classList.toggle("on", id === e.target.id);
      }
    }, { rootMargin: "-45% 0px -50% 0px" });
    for (const id of links.keys()) { const s = document.getElementById(id); if (s) seen.observe(s); }
  }
  function initCopy() {
    for (const b of $$("[data-copy]")) {
      b.addEventListener("click", async () => {
        const text = $(b.dataset.copy).textContent;
        try { await navigator.clipboard.writeText(text); }
        catch { const r = document.createRange(); r.selectNodeContents($(b.dataset.copy)); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand("copy"); }
        b.textContent = "Copied";
        setTimeout(() => { b.textContent = "Copy"; }, 1600);
      });
    }
  }

  initNav();
  initRun();
  initRec();
  initGen();
  initSim();
  initWaffle();
  initMeters();
  initCopy();
})();
