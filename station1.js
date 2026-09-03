/* ============================================================
   VRINDAVAN QUEST — station1.js
   Station 1, Activity A: the Identity Spin Wheel.

   The wheel's 7 slices are generated from CATEGORIES below using
   simple trig (see buildWheel). The exact same SLICE_ANGLE and
   angle convention is reused by getLandedIndex() so the visual
   wheel and the landing math can never drift out of sync with
   each other.

   Angle convention: theta = degrees clockwise from the top (12
   o'clock), matching how CSS `rotate()` and the wheel pointer
   both work. Slice i is centered at theta = i * SLICE_ANGLE.
   ============================================================ */

const Station1 = (() => {
  const CATEGORIES = [
    {
      key: "name",
      label: "Name",
      icon: "🪪",
      explanation:
        "The name you answer to today isn't the one you were first given a nickname for, and it won't be the last thing you're ever called. A name is a label placed on you — useful, but not you.",
    },
    {
      key: "age",
      label: "Age",
      icon: "⏳",
      explanation:
        "The number keeps climbing every single year, yet nothing about being \u201cyou\u201d required that number to be true. Age describes your body's calendar, not your essence.",
    },
    {
      key: "body",
      label: "Body",
      icon: "🧍",
      explanation:
        "Nearly every cell you're wearing has been replaced many times since childhood. The hand you write with today isn't made of the same matter it was a decade ago.",
    },
    {
      key: "emotions",
      label: "Emotions",
      icon: "💗",
      explanation:
        "Joy arrives, sits with you a while, and leaves. Grief does the same. Something in you notices them coming and going — and that noticer isn't the emotion itself.",
    },
    {
      key: "career",
      label: "Career",
      icon: "💼",
      explanation:
        "Titles are earned, outgrown, then replaced with new ones. The desk, the badge, the business card — none of it existed before this job, and none of it will remain after.",
    },
    {
      key: "relationships",
      label: "Relationships",
      icon: "🤝",
      explanation:
        "Friendships fade and form. Even the closest bonds change shape as years pass. Who you are to others keeps shifting — stranger, friend, family, memory.",
    },
    {
      key: "memories",
      label: "Memories",
      icon: "🧠",
      explanation:
        "The clearest memory you have has almost certainly drifted from what actually happened. Memory reconstructs itself a little every time you recall it — it isn't a fixed record.",
    },
  ];

  const SLICE_COUNT = CATEGORIES.length;
  const SLICE_ANGLE = 360 / SLICE_COUNT;
  const REVEAL_THRESHOLD = 4;

  const SLICE_FILLS = ["#0d2847", "#0d3b52"]; // alternating deep peacock tones

  const state = {
    currentRotation: 0,
    isSpinning: false,
    visited: new Set(),
    pendingIndex: null,
    revealed: false,
  };

  const els = {};

  /* ---------------- Geometry helpers ---------------- */
  function point(cx, cy, radius, thetaDeg) {
    const rad = (thetaDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.sin(rad),
      y: cy - radius * Math.cos(rad),
    };
  }

  function buildWheel() {
    const svg = els.wheel;
    const cx = 160, cy = 160, r = 150;
    const NS = "http://www.w3.org/2000/svg";

    CATEGORIES.forEach((cat, i) => {
      const start = i * SLICE_ANGLE - SLICE_ANGLE / 2;
      const end = i * SLICE_ANGLE + SLICE_ANGLE / 2;
      const p1 = point(cx, cy, r, start);
      const p2 = point(cx, cy, r, end);
      const large = end - start > 180 ? 1 : 0;

      const path = document.createElementNS(NS, "path");
      path.setAttribute(
        "d",
        `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`
      );
      path.setAttribute("fill", SLICE_FILLS[i % 2]);
      path.setAttribute("stroke", "rgba(245,158,11,0.35)");
      path.setAttribute("stroke-width", "1");
      path.setAttribute("id", `slice-path-${i}`);
      path.classList.add("wheel-slice");
      svg.appendChild(path);

      const mid = i * SLICE_ANGLE;
      const iconPt = point(cx, cy, r * 0.68, mid);
      const labelPt = point(cx, cy, r * 0.88, mid);

      const icon = document.createElementNS(NS, "text");
      icon.setAttribute("x", iconPt.x);
      icon.setAttribute("y", iconPt.y);
      icon.setAttribute("text-anchor", "middle");
      icon.setAttribute("dominant-baseline", "central");
      icon.setAttribute("font-size", "22");
      icon.textContent = cat.icon;
      svg.appendChild(icon);

      const label = document.createElementNS(NS, "text");
      label.setAttribute("x", labelPt.x);
      label.setAttribute("y", labelPt.y);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "central");
      label.setAttribute("font-size", "10.5");
      label.setAttribute("font-family", "Mukta, sans-serif");
      label.setAttribute("fill", "#f6f1e4");
      label.setAttribute("id", `slice-label-${i}`);
      label.textContent = cat.label;
      svg.appendChild(label);
    });

    // Outer chakra ring for ornamentation
    const ring = document.createElementNS(NS, "circle");
    ring.setAttribute("cx", cx);
    ring.setAttribute("cy", cy);
    ring.setAttribute("r", r);
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "#f59e0b");
    ring.setAttribute("stroke-width", "3");
    svg.appendChild(ring);
  }

  function getLandedIndex(totalRotationDeg) {
    const normalized = (((-totalRotationDeg) % 360) + 360) % 360;
    return Math.round(normalized / SLICE_ANGLE) % SLICE_COUNT;
  }

  /* ---------------- Spin ---------------- */
  function spin() {
    if (state.isSpinning || state.revealed) return;
    state.isSpinning = true;
    els.spinBtn.disabled = true;
    els.spinBtn.setAttribute("aria-disabled", "true");

    if (window.AudioEngine) AudioEngine.playWhoosh({ rising: true, duration: 0.4, volume: 0.16 });

    const extraSpins = 4 + Math.floor(Math.random() * 3); // 4–6 full turns
    const randomOffset = Math.random() * 360;
    const targetRotation = state.currentRotation + extraSpins * 360 + randomOffset;

    const durationMs = 3800;
    els.wheel.style.transition = `transform ${durationMs}ms cubic-bezier(0.14, 0.67, 0.16, 1)`;
    els.wheel.style.transform = `rotate(${targetRotation}deg)`;
    state.currentRotation = targetRotation;

    scheduleTicks(durationMs);

    const onEnd = () => {
      els.wheel.removeEventListener("transitionend", onEnd);
      state.isSpinning = false;
      const index = getLandedIndex(state.currentRotation);
      highlightSlice(index);
      openInquiry(index);
    };
    els.wheel.addEventListener("transitionend", onEnd);
  }

  function scheduleTicks(durationMs) {
    if (!window.AudioEngine) return;
    let elapsed = 0;
    let interval = 90;
    const grow = 1.16;
    function tick() {
      if (elapsed >= durationMs - 200) return;
      AudioEngine.playTick({ volume: 0.14 });
      elapsed += interval;
      interval *= grow;
      setTimeout(tick, interval);
    }
    setTimeout(tick, 120);
  }

  function highlightSlice(index) {
    els.wheel.querySelectorAll(".wheel-slice").forEach((p) => p.classList.remove("wheel-slice--active"));
    const path = document.getElementById(`slice-path-${index}`);
    if (path) path.classList.add("wheel-slice--active");
  }

  /* ---------------- Inquiry modal ---------------- */
  function openInquiry(index) {
    state.pendingIndex = index;
    const cat = CATEGORIES[index];

    els.modal.hidden = false;
    els.sliceLabel.textContent = `${cat.icon}  ${cat.label}`;
    els.question.textContent = "Can this change?";
    els.answers.hidden = false;
    els.explanation.hidden = true;
    els.explanation.textContent = "";
    els.continueBtn.hidden = true;

    if (window.AudioEngine) AudioEngine.playChime({ volume: 0.12 });

    const firstBtn = els.answers.querySelector("button");
    if (firstBtn) firstBtn.focus();
  }

  function answerInquiry() {
    const cat = CATEGORIES[state.pendingIndex];
    if (window.AudioEngine) AudioEngine.playClick();

    els.answers.hidden = true;
    els.explanation.hidden = false;
    els.explanation.textContent = cat.explanation;
    els.continueBtn.hidden = false;
    els.continueBtn.focus();
  }

  function closeInquiry() {
    els.modal.hidden = true;
    const index = state.pendingIndex;
    state.pendingIndex = null;
    state.visited.add(index);

    updateCounter();
    els.spinBtn.disabled = false;
    els.spinBtn.removeAttribute("aria-disabled");
    els.spinBtn.focus();

    if (state.visited.size >= REVEAL_THRESHOLD && !state.revealed) {
      showReveal();
    }
  }

  function updateCounter() {
    const n = state.visited.size;
    if (n >= REVEAL_THRESHOLD) {
      els.counter.textContent = `Slices explored: ${n} of 7 \u00b7 the soul is ready to reveal itself`;
    } else {
      els.counter.textContent = `Slices explored: ${n} of 7 \u00b7 need ${REVEAL_THRESHOLD} to continue`;
    }
  }

  function showReveal() {
    state.revealed = true;
    els.spinBtn.hidden = true;
    els.reveal.hidden = false;
    els.reveal.focus();

    if (window.ParticleEngine) ParticleEngine.burst(0.5, 0.35, { count: 55 });
    if (window.AudioEngine) AudioEngine.playCelebration();

    els.reveal.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ---------------- Wiring ---------------- */
  function cacheEls() {
    els.wheel = document.getElementById("identity-wheel");
    els.spinBtn = document.getElementById("spin-btn");
    els.counter = document.getElementById("spin-counter");
    els.reveal = document.getElementById("soul-reveal-a");

    els.modal = document.getElementById("inquiry-modal");
    els.sliceLabel = document.getElementById("inquiry-slice-label");
    els.question = document.getElementById("inquiry-question");
    els.answers = document.getElementById("inquiry-answers");
    els.explanation = document.getElementById("inquiry-explanation");
    els.continueBtn = document.getElementById("inquiry-continue");
  }

  function bind() {
    els.spinBtn.addEventListener("click", spin);
    els.answers.querySelectorAll("button[data-answer]").forEach((btn) => {
      btn.addEventListener("click", answerInquiry);
    });
    els.continueBtn.addEventListener("click", closeInquiry);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.modal.hidden && !els.continueBtn.hidden) {
        closeInquiry();
      }
    });
  }

  function init() {
    if (!document.getElementById("identity-wheel")) return; // not on this page
    cacheEls();
    buildWheel();
    bind();
    updateCounter();
  }

  return { init };
})();

/* ============================================================
   Station 1, Activity B: Remove the Layers.

   Six independent "shells" wrap a central figure. Layers can be
   tapped in any order (either the shell itself or its matching
   chip in the list below the avatar) — each dissolves on its own,
   the figure's glow grows with every layer gone, and once all six
   are released the figure settles into its final radiant state.
   ============================================================ */
const Station1Layers = (() => {
  const LAYERS = [
    { key: "body", label: "Body", icon: "\ud83d\udc57" },
    { key: "emotions", label: "Emotions", icon: "\ud83d\ude0a" },
    { key: "profession", label: "Profession", icon: "\ud83d\udcbc" },
    { key: "name", label: "Name", icon: "\ud83e\udea9" },
    { key: "identity", label: "Identity & Status", icon: "\ud83d\udcf1" },
    { key: "thoughts", label: "Thoughts & Ego", icon: "\ud83e\udde0" },
  ];
  const LAYER_COUNT = LAYERS.length;

  const state = {
    removed: new Set(),
    revealed: false,
  };

  const els = {};

  function cacheEls() {
    els.root = document.getElementById("layers-activity");
    els.stage = document.getElementById("avatar-stage");
    els.figure = document.getElementById("avatar-figure");
    els.shells = Array.from(document.querySelectorAll(".layer-shell"));
    els.chips = Array.from(document.querySelectorAll(".layer-chip"));
    els.counter = document.getElementById("layers-counter");
    els.reveal = document.getElementById("soul-reveal-b");
  }

  function shellFor(index) {
    return els.shells.find((el) => Number(el.dataset.layer) === index);
  }
  function chipFor(index) {
    return els.chips.find((el) => Number(el.dataset.layer) === index);
  }

  function removeLayer(index) {
    if (state.revealed || state.removed.has(index) || Number.isNaN(index)) return;
    state.removed.add(index);

    const shell = shellFor(index);
    const chip = chipFor(index);

    if (window.AudioEngine) AudioEngine.playWhoosh({ rising: false, duration: 0.5, volume: 0.18 });

    if (shell) {
      shell.classList.add("layer-shell--dissolving");
      shell.addEventListener(
        "animationend",
        () => shell.classList.add("layer-shell--removed"),
        { once: true }
      );
    }

    if (chip) {
      chip.classList.add("layer-chip--removed");
      chip.disabled = true;
    }

    if (window.ParticleEngine) {
      const rect = els.stage.getBoundingClientRect();
      const xRatio = (rect.left + rect.width / 2) / window.innerWidth;
      const yRatio = (rect.top + rect.height / 2) / window.innerHeight;
      ParticleEngine.burst(xRatio, yRatio, { count: 26 });
    }

    els.stage.dataset.removed = String(state.removed.size);
    els.stage.style.setProperty("--glow-level", String(state.removed.size));

    updateCounter();

    if (state.removed.size >= LAYER_COUNT) {
      showReveal();
    }
  }

  function updateCounter() {
    const remaining = LAYER_COUNT - state.removed.size;
    els.counter.textContent =
      remaining > 0
        ? `Layers remaining: ${remaining} of ${LAYER_COUNT}`
        : "Layers remaining: 0 of 6 \u00b7 nothing external is left";
  }

  function showReveal() {
    state.revealed = true;
    els.stage.classList.add("avatar-stage--radiant");
    els.reveal.hidden = false;
    els.reveal.focus();

    if (window.ParticleEngine) ParticleEngine.burst(0.5, 0.35, { count: 70 });
    if (window.AudioEngine) AudioEngine.playCelebration();

    els.reveal.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function bind() {
    // Shells are purely decorative (the avatar's glow builds up behind
    // them) and are deliberately non-interactive — they're allowed to
    // visually bleed past the avatar stage as they get bigger, and giving
    // them pointer-events would let a big outer shell block taps on the
    // chip list underneath it. The chips are the actual tap targets.
    els.chips.forEach((chip) => {
      chip.addEventListener("click", () => removeLayer(Number(chip.dataset.layer)));
    });
  }

  function init() {
    if (!document.getElementById("avatar-stage")) return; // not on this page
    cacheEls();
    els.stage.style.setProperty("--glow-level", "0");
    bind();
    updateCounter();
  }

  return { init };
})();

/* ============================================================
   Station 1 sub-station switcher — flips between Activity A
   (Spin the Wheel) and Activity B (Remove the Layers) without
   touching either activity's internal state.
   ============================================================ */
const Station1Switcher = (() => {
  const els = {};

  function activate(which) {
    const isA = which === "a";

    els.tabA.setAttribute("aria-selected", String(isA));
    els.tabB.setAttribute("aria-selected", String(!isA));

    els.activityA.dataset.active = String(isA);
    els.activityB.dataset.active = String(!isA);

    els.introA.hidden = !isA;
    els.introB.hidden = isA;

    if (window.AudioEngine) AudioEngine.playClick({ volume: 0.1 });
  }

  function bind() {
    els.tabA.addEventListener("click", () => activate("a"));
    els.tabB.addEventListener("click", () => activate("b"));
  }

  function init() {
    els.tabA = document.getElementById("substation-tab-a");
    els.tabB = document.getElementById("substation-tab-b");
    if (!els.tabA || !els.tabB) return; // not on this page

    els.activityA = document.getElementById("wheel-activity");
    els.activityB = document.getElementById("layers-activity");
    els.introA = document.getElementById("station1-intro-a");
    els.introB = document.getElementById("station1-intro-b");

    bind();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => {
  Station1.init();
  Station1Layers.init();
  Station1Switcher.init();
});
