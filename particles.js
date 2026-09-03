/* ============================================================
   VRINDAVAN QUEST — particles.js
   Two canvases:
     #particle-canvas    — quiet ambient layer, behind the content
                            (drifting peacock feathers, golden
                            sparks, Kadamba blossom petals, fireflies)
     #celebration-canvas — sits above the content, stays empty
                            until ParticleEngine.burst() is called
                            for a milestone/reveal moment

   Public API (used now by the temp dev panel, and by later
   station chunks on milestone events):
     ParticleEngine.burst(xRatio, yRatio, opts)
   ============================================================ */

const ParticleEngine = (() => {
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PALETTE = {
    feather: ["#14b8a6", "#0d9488", "#00695c"],
    featherEye: "#f59e0b",
    petal: ["#f59e0b", "#fbbf24", "#ff7a4d"],
    spark: ["#fef08a", "#fbbf24"],
    firefly: "#fef08a",
  };

  let ambientCanvas, ambientCtx;
  let burstCanvas, burstCtx;
  let width = 0, height = 0, dpr = 1;

  let ambientParticles = [];
  let burstParticles = [];

  const AMBIENT_MAX = reducedMotion ? 0 : window.innerWidth < 640 ? 16 : 30;
  let ambientSpawnAcc = 0;

  let rafId = null;
  let lastTime = 0;
  let visible = true;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    [ambientCanvas, burstCanvas].forEach((c) => {
      if (!c) return;
      c.width = width * dpr;
      c.height = height * dpr;
      c.style.width = width + "px";
      c.style.height = height + "px";
    });
    if (ambientCtx) ambientCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (burstCtx) burstCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* ---------------- Ambient particle factory ---------------- */
  function spawnAmbient() {
    const roll = Math.random();
    let type;
    if (roll < 0.45) type = "spark";
    else if (roll < 0.7) type = "petal";
    else if (roll < 0.9) type = "feather";
    else type = "firefly";

    const base = {
      type,
      x: rand(0, width),
      y: type === "firefly" ? rand(height * 0.2, height * 0.9) : -20,
      rotation: rand(0, Math.PI * 2),
      rotSpeed: rand(-0.6, 0.6),
      swayPhase: rand(0, Math.PI * 2),
      swaySpeed: rand(0.4, 1.1),
      swayAmp: rand(10, 30),
      life: 0,
      opacity: 0,
    };

    if (type === "spark") {
      Object.assign(base, {
        size: rand(1.5, 3),
        vy: rand(8, 16),
        color: pick(PALETTE.spark),
        maxLife: rand(6, 10),
        flicker: rand(2, 4),
      });
    } else if (type === "petal") {
      Object.assign(base, {
        size: rand(5, 9),
        vy: rand(10, 20),
        color: pick(PALETTE.petal),
        maxLife: rand(7, 11),
      });
    } else if (type === "feather") {
      Object.assign(base, {
        size: rand(14, 22),
        vy: rand(6, 12),
        color: pick(PALETTE.feather),
        maxLife: rand(9, 14),
      });
    } else if (type === "firefly") {
      Object.assign(base, {
        size: rand(2, 3.5),
        vy: rand(-3, 3),
        vx: rand(-6, 6),
        color: PALETTE.firefly,
        maxLife: rand(8, 14),
        flicker: rand(1.5, 3),
      });
    }
    ambientParticles.push(base);
  }

  /* ---------------- Burst particle factory (celebration) ---------------- */
  function spawnBurst(x, y, opts) {
    const count = opts.count || 60;
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(60, 220);
      const roll = Math.random();
      const type = roll < 0.5 ? "petal" : roll < 0.8 ? "feather" : "spark";
      burstParticles.push({
        type,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(40, 120), // initial upward kick
        gravity: rand(140, 220),
        drag: 0.985,
        rotation: rand(0, Math.PI * 2),
        rotSpeed: rand(-4, 4),
        size: type === "feather" ? rand(14, 24) : type === "petal" ? rand(6, 11) : rand(2, 4),
        color: type === "feather" ? pick(PALETTE.feather) : type === "petal" ? pick(PALETTE.petal) : pick(PALETTE.spark),
        life: 0,
        maxLife: rand(1.6, 2.6),
        opacity: 1,
      });
    }
  }

  /* ---------------- Drawing ---------------- */
  function drawFeather(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = p.opacity;
    const s = p.size;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.32, s * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.6);
    ctx.lineTo(0, s * 0.6);
    ctx.stroke();
    ctx.fillStyle = PALETTE.featherEye;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.1, s * 0.14, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPetal(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.5, p.size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSpark(ctx, p) {
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.size * 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFirefly(ctx, p, t) {
    const flicker = 0.55 + 0.45 * Math.sin(t * p.flicker + p.swayPhase);
    ctx.save();
    ctx.globalAlpha = p.opacity * flicker;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.size * 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------------- Update + render loops ---------------- */
  function updateAmbient(dt, t) {
    ambientSpawnAcc += dt;
    const spawnInterval = 0.5;
    if (ambientSpawnAcc > spawnInterval && ambientParticles.length < AMBIENT_MAX) {
      ambientSpawnAcc = 0;
      spawnAmbient();
    }

    ambientCtx.clearRect(0, 0, width, height);

    ambientParticles = ambientParticles.filter((p) => {
      p.life += dt;
      const lifeRatio = p.life / p.maxLife;
      p.opacity = lifeRatio < 0.1 ? lifeRatio / 0.1 : lifeRatio > 0.85 ? (1 - lifeRatio) / 0.15 : 1;
      p.opacity = Math.max(0, Math.min(1, p.opacity)) * (p.type === "firefly" ? 0.9 : 0.55);
      p.rotation += p.rotSpeed * dt;

      if (p.type === "firefly") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < height * 0.1) p.vy = Math.abs(p.vy);
        if (p.y > height * 0.95) p.vy = -Math.abs(p.vy);
        drawFirefly(ambientCtx, p, t);
      } else {
        p.x += Math.sin(t * p.swaySpeed + p.swayPhase) * p.swayAmp * dt * 0.6;
        p.y += p.vy * dt;
        if (p.type === "spark") drawSpark(ambientCtx, p);
        else if (p.type === "petal") drawPetal(ambientCtx, p);
        else drawFeather(ambientCtx, p);
      }

      return p.life < p.maxLife && p.y < height + 40;
    });
  }

  function updateBurst(dt) {
    if (burstParticles.length === 0) {
      burstCtx.clearRect(0, 0, width, height);
      return;
    }
    burstCtx.clearRect(0, 0, width, height);
    burstParticles = burstParticles.filter((p) => {
      p.life += dt;
      const lifeRatio = p.life / p.maxLife;
      p.opacity = Math.max(0, 1 - lifeRatio);
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotSpeed * dt;

      if (p.type === "spark") drawSpark(burstCtx, p);
      else if (p.type === "petal") drawPetal(burstCtx, p);
      else drawFeather(burstCtx, p);

      return p.life < p.maxLife;
    });
  }

  function loop(now) {
    if (!visible) {
      rafId = requestAnimationFrame(loop);
      return;
    }
    const t = now / 1000;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;

    if (!reducedMotion) updateAmbient(dt, t);
    updateBurst(dt);

    rafId = requestAnimationFrame(loop);
  }

  function handleVisibility() {
    visible = document.visibilityState === "visible";
  }

  function init() {
    ambientCanvas = document.getElementById("particle-canvas");
    burstCanvas = document.getElementById("celebration-canvas");
    if (!ambientCanvas || !burstCanvas) return;
    ambientCtx = ambientCanvas.getContext("2d");
    burstCtx = burstCanvas.getContext("2d");

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibility);

    rafId = requestAnimationFrame(loop);
  }

  /**
   * Trigger a celebration burst — peacock feathers, Kadamba petals, and
   * golden sparks exploding outward from a point, then falling with gravity.
   * @param {number} xRatio 0–1 horizontal position (0.5 = center)
   * @param {number} yRatio 0–1 vertical position (0.5 = middle of viewport)
   * @param {object} opts   { count }
   */
  function burst(xRatio = 0.5, yRatio = 0.4, opts = {}) {
    if (!burstCanvas) return;
    const x = xRatio * width;
    const y = yRatio * height;
    spawnBurst(x, y, opts);
  }

  return { init, burst };
})();

document.addEventListener("DOMContentLoaded", ParticleEngine.init);
