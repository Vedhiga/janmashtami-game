/* ============================================================
   VRINDAVAN QUEST — app.js
   Core state manager. Chunk 1: station navigation shell only.
   Later chunks hang activity logic, meter state, and Firestore
   calls off this same VrindavanQuest object.
   ============================================================ */

const VrindavanQuest = (() => {
  const STATIONS = ["1", "2", "3", "final"];

  const state = {
    activeStation: "1",
    completed: new Set(),
    soundOn: false,
  };

  const els = {};

  function cacheEls() {
    els.nodes = Array.from(document.querySelectorAll(".node"));
    els.panels = Array.from(document.querySelectorAll(".panel"));
    els.riverProgress = document.getElementById("river-progress");
    els.ambientToggle = document.getElementById("ambient-toggle");
  }

  function goToStation(stationId) {
    if (!STATIONS.includes(stationId)) return;
    state.activeStation = stationId;

    els.panels.forEach((panel) => {
      panel.dataset.active = panel.id === `station-${stationId}` ? "true" : "false";
    });

    els.nodes.forEach((node) => {
      const isActive = node.dataset.station === stationId;
      if (isActive) {
        node.setAttribute("aria-current", "step");
      } else {
        node.removeAttribute("aria-current");
      }
    });

    updateRiverProgress();

    const panel = document.getElementById(`station-${stationId}`);
    if (panel) panel.focus?.();
  }

  function markComplete(stationId) {
    state.completed.add(stationId);
    const node = els.nodes.find((n) => n.dataset.station === stationId);
    if (node) node.classList.add("is-complete");
    updateRiverProgress();
  }

  function updateRiverProgress() {
    if (!els.riverProgress) return;
    const idx = STATIONS.indexOf(state.activeStation);
    const total = els.riverProgress.getTotalLength ? els.riverProgress.getTotalLength() : 1400;
    const completedCount = Math.max(state.completed.size, idx);
    const ratio = completedCount / (STATIONS.length - 1);
    const offset = total - total * Math.min(ratio, 1);
    els.riverProgress.style.strokeDasharray = String(total);
    els.riverProgress.style.strokeDashoffset = String(offset);
    els.riverProgress.style.transition = "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)";
  }

  function bindNav() {
    els.nodes.forEach((node) => {
      node.addEventListener("click", () => goToStation(node.dataset.station));
    });
  }

  function bindAmbientToggle() {
    if (!els.ambientToggle) return;
    els.ambientToggle.addEventListener("click", () => {
      const isRunning = window.AudioEngine ? window.AudioEngine.toggle() : (state.soundOn = !state.soundOn);
      state.soundOn = isRunning;
      els.ambientToggle.setAttribute("aria-pressed", String(state.soundOn));
      els.ambientToggle.querySelector(".ambient-toggle__label").textContent = state.soundOn ? "Sound On" : "Sound";
    });
  }

  function init() {
    cacheEls();
    bindNav();
    bindAmbientToggle();
    goToStation(state.activeStation);
  }

  return { init, goToStation, markComplete, state };
})();

document.addEventListener("DOMContentLoaded", VrindavanQuest.init);
