/* ============================================================
   VRINDAVAN QUEST — audio.js
   Native Web Audio API synthesis. No external audio files, so
   nothing to download or buffer. Everything below is generated
   at runtime: oscillators for the flute and bell tones, filtered
   noise buffers for the river, ticks, whooshes, and clicks.

   Public API (used by app.js now, and by later station chunks):
     AudioEngine.toggle()        -> starts/stops ambient loop, returns isRunning
     AudioEngine.isRunning()
     AudioEngine.playFluteNote(freq, opts)
     AudioEngine.playChime(opts)
     AudioEngine.playTick(opts)
     AudioEngine.playWhoosh(opts)
     AudioEngine.playClick(opts)
     AudioEngine.playCelebration()
   ============================================================ */

const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;   // overall volume, always audible once created
  let sfxGain = null;      // one-off sounds (ticks, whooshes, celebration, test panel) — never gated by the ambient toggle
  let ambientGain = null;  // the continuous background bed — this is what the Sound toggle actually mutes
  let reverbSend = null;
  let convolver = null;
  let running = false;

  let ambientSourceNodes = [];
  let ambientTimers = [];

  // Bansuri-style major pentatonic (key of D): D E G A C
  const PENTATONIC = [293.66, 329.63, 392.0, 440.0, 523.25, 587.33];

  function ensureContext() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.85;
    masterGain.connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 1;
    sfxGain.connect(masterGain);

    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.0001;
    ambientGain.connect(masterGain);

    convolver = ctx.createConvolver();
    convolver.buffer = buildImpulseResponse(2.4, 2.8);

    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.45;
    reverbSend.connect(convolver);
    convolver.connect(masterGain);
  }

  // Generates a synthetic reverb impulse: exponentially decaying noise.
  // Gives the flute/bell a soft temple-hall tail without any audio file.
  function buildImpulseResponse(duration, decay) {
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  function noiseBuffer(durationSeconds, shape = "white") {
    const length = Math.max(1, Math.floor(ctx.sampleRate * durationSeconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    if (shape === "brown") {
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (last + 0.02 * white) / 1.02;
        last = data[i];
      }
    } else {
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }
    }
    return buffer;
  }

  /* ---------------- Bansuri flute tone ---------------- */
  function playFluteNote(freq, { duration = 1.4, delay = 0, volume = 0.18, bus = null } = {}) {
    ensureContext();
    const t0 = ctx.currentTime + delay;
    const outputBus = bus || sfxGain;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    const breathOsc = ctx.createOscillator();
    breathOsc.type = "triangle";
    breathOsc.frequency.value = freq;
    breathOsc.detune.value = 7;

    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 4.8;
    const vibratoGain = ctx.createGain();
    vibratoGain.gain.value = 3.5;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    vibratoGain.connect(breathOsc.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.18);
    gain.gain.linearRampToValueAtTime(volume * 0.65, t0 + duration * 0.65);
    gain.gain.linearRampToValueAtTime(0, t0 + duration);

    osc.connect(gain);
    breathOsc.connect(gain);
    gain.connect(outputBus);
    gain.connect(reverbSend);

    osc.start(t0);
    breathOsc.start(t0);
    vibrato.start(t0);
    osc.stop(t0 + duration + 0.05);
    breathOsc.stop(t0 + duration + 0.05);
    vibrato.stop(t0 + duration + 0.05);
  }

  /* ---------------- Temple bell chime ---------------- */
  function playChime({ delay = 0, volume = 0.22, bus = null } = {}) {
    ensureContext();
    const t0 = ctx.currentTime + delay;
    const outputBus = bus || sfxGain;
    // Inharmonic partials give a metallic bell/singing-bowl character.
    const partials = [880, 880 * 2.41, 880 * 3.88];
    partials.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const g = volume / (i + 1.6);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(g, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6 - i * 0.35);

      osc.connect(gain);
      gain.connect(outputBus);
      gain.connect(reverbSend);
      osc.start(t0);
      osc.stop(t0 + 2.8);
    });
  }

  /* ---------------- Wheel-spin ratchet tick ---------------- */
  function playTick({ delay = 0, volume = 0.15 } = {}) {
    ensureContext();
    const t0 = ctx.currentTime + delay;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(0.03, "white");

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 2200;
    bandpass.Q.value = 6;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(sfxGain);
    noise.start(t0);
  }

  /* ---------------- Whoosh (layer peel / transition) ---------------- */
  function playWhoosh({ delay = 0, duration = 0.55, rising = true, volume = 0.18 } = {}) {
    ensureContext();
    const t0 = ctx.currentTime + delay;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(duration, "white");

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(rising ? 300 : 3200, t0);
    filter.frequency.linearRampToValueAtTime(rising ? 3200 : 300, t0 + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + duration * 0.3);
    gain.gain.linearRampToValueAtTime(0, t0 + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    noise.start(t0);
    noise.stop(t0 + duration + 0.05);
  }

  /* ---------------- UI click feedback ---------------- */
  function playClick({ delay = 0, volume = 0.12 } = {}) {
    ensureContext();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 740;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);

    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + 0.1);
  }

  /* ---------------- Celebration fanfare ---------------- */
  function playCelebration() {
    ensureContext();
    const notes = [523.25, 659.25, 783.99, 880.0, 1046.5]; // C5 E5 G5 A5 C6
    notes.forEach((freq, i) => playFluteNote(freq, { duration: 0.9, delay: i * 0.11, volume: 0.24 }));
    playChime({ delay: notes.length * 0.11, volume: 0.3 });
  }

  /* ---------------- Ambient soundscape ---------------- */
  function startRiver() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(4, "brown");
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 650;

    const gain = ctx.createGain();
    gain.gain.value = 0.05;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ambientGain);

    src.start();
    lfo.start();
    ambientSourceNodes.push(src, lfo);
  }

  function scheduleAmbientMelody() {
    const loopNote = () => {
      if (!running) return;
      const freq = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
      playFluteNote(freq, { duration: 2 + Math.random() * 1.5, volume: 0.09, bus: ambientGain });
      ambientTimers.push(setTimeout(loopNote, 3500 + Math.random() * 4000));
    };
    ambientTimers.push(setTimeout(loopNote, 800));
  }

  function scheduleAmbientChimes() {
    const loopChime = () => {
      if (!running) return;
      playChime({ volume: 0.08, bus: ambientGain });
      ambientTimers.push(setTimeout(loopChime, 14000 + Math.random() * 10000));
    };
    ambientTimers.push(setTimeout(loopChime, 6000));
  }

  function start() {
    ensureContext();
    if (running) return;
    running = true;
    ambientGain.gain.cancelScheduledValues(ctx.currentTime);
    ambientGain.gain.setValueAtTime(ambientGain.gain.value, ctx.currentTime);
    ambientGain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.6);
    startRiver();
    scheduleAmbientMelody();
    scheduleAmbientChimes();
  }

  function stop() {
    if (!ctx || !running) return;
    running = false;
    ambientGain.gain.cancelScheduledValues(ctx.currentTime);
    ambientGain.gain.setValueAtTime(ambientGain.gain.value, ctx.currentTime);
    ambientGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.5);

    ambientTimers.forEach(clearTimeout);
    ambientTimers = [];

    const nodesToStop = ambientSourceNodes;
    ambientSourceNodes = [];
    setTimeout(() => {
      nodesToStop.forEach((n) => {
        try {
          n.stop();
        } catch (e) {
          /* already stopped */
        }
      });
    }, 600);
  }

  function toggle() {
    if (running) stop();
    else start();
    return running;
  }

  return {
    toggle,
    isRunning: () => running,
    playFluteNote,
    playChime,
    playTick,
    playWhoosh,
    playClick,
    playCelebration,
    debugInfo: () => {
      ensureContext();
      return {
        contextState: ctx.state,
        sampleRate: ctx.sampleRate,
        masterGainValue: masterGain.gain.value,
        sfxGainValue: sfxGain.gain.value,
        ambientGainValue: ambientGain.gain.value,
        running,
      };
    },
  };
})();
