// Clear, short synthesized craft foley. No files or background music.
// Call unlock() synchronously inside a trusted pointer/keyboard handler. Neither
// play() nor the ironing controls create or resume an AudioContext themselves.
export function createCraftAudio({ enabled = true, volume = .65, onState = () => {} } = {}) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  const clamp = (value, fallback = .65) => Number.isFinite(Number(value)) ? Math.min(1, Math.max(0, Number(value))) : fallback;
  let isEnabled = Boolean(enabled), level = clamp(volume), disposed = false;
  let context = null, master = null, outputGuard = null, noise = null, taps = [], uiImpacts = [], unlocking = null;
  let queuedKind = null, ironRequested = false, ironVoice = null, uiVoice = null, lastPlacement = -Infinity, lastUi = -Infinity, lastError = null;
  const voices = new Set();
  const status = () => ({ enabled: isEnabled, volume: level, supported: Boolean(AudioContextClass),
    unlocked: context?.state === 'running', state: disposed ? 'disposed' : (context?.state || 'locked'),
    ironing: ironRequested, audible: Boolean(ironVoice && isEnabled && level > 0 && context?.state === 'running'),
    activeVoices: voices.size, uiVoiceActive: Boolean(uiVoice && !uiVoice.cleaned), error: lastError });
  const notify = () => { try { onState(status()); } catch { /* UI callbacks must never interrupt a craft action. */ } };
  const report = error => { lastError = error?.name || 'AudioUnavailable'; notify(); return false; };
  const canPlay = () => !disposed && isEnabled && level > 0 && context?.state === 'running' && master;
  const time = () => context?.currentTime || 0;
  const clock = () => globalThis.performance?.now?.() ?? Date.now();
  const isUiSound = kind => kind === 'tap' || kind === 'select' || kind === 'ui';

  function cleanVoice(voice) {
    if (!voice || voice.cleaned) return;
    voice.cleaned = true;
    voice.source.onended = null;
    for (const node of voice.nodes) { try { node.disconnect(); } catch {} }
    voices.delete(voice);
    if (ironVoice === voice) ironVoice = null;
    if (uiVoice === voice) uiVoice = null;
  }

  function haltVoice(voice, fade = 0) {
    if (!voice || voice.cleaned) return;
    try {
      if (fade && context?.state === 'running') {
        const now = time();
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + fade);
        voice.source.stop(now + fade + .005);
      } else {
        voice.source.stop();
        cleanVoice(voice);
      }
    } catch { cleanVoice(voice); }
  }

  function makeVoice(buffer, { high = 250, low = 5200, gain = .2, duration = .1, loop = false, rate = 1, attack = .002 } = {}) {
    if (!canPlay()) return null;
    // Long drag strokes must not create an unbounded stack of removal sounds.
    if (voices.size >= 10) haltVoice([...voices].find(voice => voice !== ironVoice));
    const source = context.createBufferSource(), highpass = context.createBiquadFilter(), lowpass = context.createBiquadFilter(), envelope = context.createGain();
    const voice = { source, gain: envelope, nodes: [source, highpass, lowpass, envelope], cleaned: false };
    try {
      source.buffer = buffer;
      source.loop = loop;
      source.playbackRate.value = rate;
      highpass.type = 'highpass'; highpass.frequency.value = high; highpass.Q.value = .55;
      lowpass.type = 'lowpass'; lowpass.frequency.value = low; lowpass.Q.value = .55;
      source.connect(highpass); highpass.connect(lowpass); lowpass.connect(envelope); envelope.connect(master);
      const now = time();
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(gain, now + attack);
      if (!loop) {
        envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
      }
      voices.add(voice);
      source.onended = () => cleanVoice(voice);
      const offset = loop || buffer !== noise ? 0 : Math.random() * Math.max(0, buffer.duration - duration - .03);
      source.start(now, offset);
      if (!loop) source.stop(now + duration + .012);
      return voice;
    } catch (error) { haltVoice(voice); report(error); return null; }
  }

  function makeBuffers() {
    // A tiny broadband contact and inharmonic, quickly damped resonances give
    // controls the feel of a small wood/plastic mechanism, rather than a beep.
    uiImpacts = Array.from({ length: 6 }, () => {
      const length = Math.ceil(context.sampleRate * .038), buffer = context.createBuffer(1, length, context.sampleRate), samples = buffer.getChannelData(0);
      const variation = .98 + Math.random() * .04;
      let previous = 0, peak = 0;
      for (let i = 0; i < length; i++) {
        const t = i / context.sampleRate, attack = Math.min(1, t / .00035);
        previous = previous * .28 + (Math.random() * 2 - 1) * .72;
        samples[i] = attack * (previous * .31 * Math.exp(-t / .0038)
          + Math.sin(t * 1070 * variation * Math.PI * 2) * .18 * Math.exp(-t / .0048)
          + Math.sin(t * 1889 * variation * Math.PI * 2) * .095 * Math.exp(-t / .0032)
          + Math.sin(t * 2917 * variation * Math.PI * 2) * .055 * Math.exp(-t / .002));
        peak = Math.max(peak, Math.abs(samples[i]));
      }
      const scale = .78 / Math.max(.001, peak);
      for (let i = 0; i < length; i++) samples[i] *= scale;
      return buffer;
    });
    // Broadband impact followed by a very short, damped plastic resonance.
    // Its frequencies vary slightly, but it never becomes a pitched UI note.
    taps = Array.from({ length: 8 }, () => {
      const length = Math.ceil(context.sampleRate * .085), buffer = context.createBuffer(1, length, context.sampleRate), samples = buffer.getChannelData(0);
      const resonance = 1350 + Math.random() * 450, second = 2650 + Math.random() * 600;
      for (let i = 0; i < length; i++) {
        const t = i / context.sampleRate, attack = Math.min(1, t / .0007);
        samples[i] = attack * ((Math.random() * 2 - 1) * .42 * Math.exp(-t / .010)
          + Math.sin(t * resonance * Math.PI * 2) * .065 * Math.exp(-t / .008)
          + Math.sin(t * second * Math.PI * 2) * .028 * Math.exp(-t / .005));
      }
      // Consistent impact loudness across variants without making the gentle
      // resonance longer or sharper. Volume remains under the user's control.
      let peak = 0;
      for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(samples[i]));
      const scale = .82 / Math.max(.001, peak);
      for (let i = 0; i < length; i++) samples[i] *= scale;
      return buffer;
    });
    const length = Math.ceil(context.sampleRate * 1.5);
    noise = context.createBuffer(1, length, context.sampleRate);
    const samples = noise.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < length; i++) {
      previous = previous * .78 + (Math.random() * 2 - 1) * .22;
      const phase = i / length;
      samples[i] = previous * .75 * (.72 + .18 * Math.sin(phase * Math.PI * 4));
    }
    // Both loop ends meet at silence, avoiding a seam click. The very brief,
    // gentle dip also keeps the rubbing texture from sounding like static.
    const seam = Math.ceil(context.sampleRate * .015);
    for (let i = 0; i < seam; i++) {
      const blend = i / seam;
      samples[i] *= blend;
      samples[length - 1 - i] *= blend;
    }
  }

  function applyVolume() {
    if (!master || !context) return;
    const now = time();
    master.gain.cancelScheduledValues(now);
    // Mute is immediate; ordinary volume changes take 8 ms to avoid clicks.
    if (!isEnabled || level === 0) master.gain.setValueAtTime(0, now);
    else {
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(level * .9, now + .008);
    }
  }

  function ensureIroning() {
    if (!ironRequested || ironVoice || !canPlay()) return;
    ironVoice = makeVoice(noise, { high: 160, low: 1750, gain: .18, loop: true, attack: .055 });
  }

  function contextChanged() {
    if (disposed) return;
    if (context?.state === 'running') ensureIroning();
    notify();
  }

  function unlock() {
    if (disposed || !isEnabled || level === 0 || !AudioContextClass) return Promise.resolve(false);
    if (context?.state === 'running') return Promise.resolve(true);
    // Older Safari lacks UserActivation. The caller still has to use a trusted
    // event handler; on browsers exposing it, reject non-gesture unlock calls.
    if (globalThis.navigator?.userActivation && !globalThis.navigator.userActivation.isActive) return Promise.resolve(false);
    if (unlocking) return unlocking;
    try {
      if (!context) {
        try { context = new AudioContextClass({ latencyHint: 'interactive' }); }
        catch { context = new AudioContextClass(); }
        master = context.createGain();
        master.gain.value = isEnabled ? level * .9 : 0;
        // A soft peak guard keeps fast drags and overlapping tool sounds clear.
        // The uncompressed fallback is already bounded by the voice limit.
        if (typeof context.createDynamicsCompressor === 'function') {
          outputGuard = context.createDynamicsCompressor();
          outputGuard.threshold.value = -9; outputGuard.knee.value = 14;
          outputGuard.ratio.value = 8; outputGuard.attack.value = .003; outputGuard.release.value = .06;
          master.connect(outputGuard); outputGuard.connect(context.destination);
        } else master.connect(context.destination);
        makeBuffers();
        context.addEventListener?.('statechange', contextChanged);
      }
      const result = context.state === 'running' ? Promise.resolve() : context.resume();
      unlocking = Promise.resolve(result).then(() => {
        if (disposed) return false;
        lastError = null;
        applyVolume();
        ensureIroning();
        const first = queuedKind;
        queuedKind = null;
        // A slow browser resume must never play an old click seconds later.
        // Only the latest recent gesture can produce the first sound.
        if (first && clock() - first.at <= (isUiSound(first.kind) ? 90 : 180)) play(first.kind);
        notify();
        return context.state === 'running';
      }).catch(error => { queuedKind = null; return report(error); }).finally(() => { unlocking = null; });
      return unlocking;
    } catch (error) {
      if (context && (!master || !noise)) {
        try { master?.disconnect(); outputGuard?.disconnect(); Promise.resolve(context.close()).catch(() => {}); } catch {}
        context = null; master = null; outputGuard = null; noise = null; taps = []; uiImpacts = [];
      }
      return Promise.resolve(report(error));
    }
  }

  function play(kind) {
    if (disposed || !isEnabled || level === 0) return false;
    if (!canPlay()) {
      if (unlocking) { queuedKind = { kind, at: clock() }; return true; }
      return false;
    }
    try {
      if (isUiSound(kind)) {
        const now = time();
        // There is one short UI voice. Repeated events within 48 ms are dropped
        // immediately; no timer or audio queue can accumulate rapid clicks.
        if (now - lastUi < .048) return false;
        lastUi = now;
        haltVoice(uiVoice);
        uiVoice = makeVoice(uiImpacts[Math.floor(Math.random() * uiImpacts.length)],
          { gain: .46, duration: .034, high: 180, low: 4300, attack: .0008 });
        return Boolean(uiVoice);
      }
      if (kind === 'place') {
        const now = time();
        if (now - lastPlacement < .035) return false;
        lastPlacement = now;
      }
      if (kind === 'place' || kind === 'remove' || kind === 'finished') {
        const config = kind === 'place' ? { gain: .68, duration: .075, high: 380, low: 5600 }
          : kind === 'remove' ? { gain: .50, duration: .052, high: 560, low: 6000 }
          : { gain: .48, duration: .085, high: 180, low: 3200 };
        return Boolean(makeVoice(taps[Math.floor(Math.random() * taps.length)], { ...config, rate: .93 + Math.random() * .14 }));
      }
      const config = kind === 'paper' ? { gain: .48, duration: .32, high: 300, low: 3200, attack: .035 }
        : kind === 'peel' ? { gain: .54, duration: .46, high: 430, low: 3900, attack: .045 }
        : kind === 'cool' ? { gain: .20, duration: .24, high: 140, low: 1800, attack: .04 }
        : null;
      return config ? Boolean(makeVoice(noise, config)) : false;
    } catch (error) { return report(error); }
  }

  function startIroning() {
    if (disposed) return false;
    ironRequested = true;
    try { ensureIroning(); } catch (error) { report(error); }
    notify();
    return Boolean(ironVoice);
  }

  function stopIroning() {
    ironRequested = false;
    const voice = ironVoice;
    ironVoice = null;
    haltVoice(voice, .018);
    notify();
  }

  function setEnabled(value) {
    if (disposed) return;
    isEnabled = Boolean(value);
    if (!isEnabled) {
      queuedKind = null;
      for (const voice of [...voices]) haltVoice(voice);
      ironVoice = null;
      uiVoice = null;
    }
    try { applyVolume(); ensureIroning(); } catch (error) { report(error); }
    notify();
  }

  function setVolume(value) {
    if (disposed) return;
    level = clamp(value, level);
    if (!level) {
      queuedKind = null;
      for (const voice of [...voices]) haltVoice(voice);
      ironVoice = null;
      uiVoice = null;
    }
    try { applyVolume(); ensureIroning(); } catch (error) { report(error); }
    notify();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    queuedKind = null;
    ironRequested = false;
    for (const voice of [...voices]) haltVoice(voice);
    ironVoice = null;
    try { master?.disconnect(); outputGuard?.disconnect(); } catch {}
    context?.removeEventListener?.('statechange', contextChanged);
    if (context && context.state !== 'closed') { try { Promise.resolve(context.close()).catch(() => {}); } catch {} }
    noise = null;
    taps = [];
    uiImpacts = [];
    notify();
  }

  return { unlock, play, startIroning, stopIroning, setEnabled, setVolume, dispose, get status() { return status(); } };
}
