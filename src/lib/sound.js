/**
 * Sonido de aviso tipo "moneda", sintetizado con Web Audio API (dos tonos
 * cortos ascendentes) — así no dependemos de bajar/alojar un archivo de
 * audio externo. Se usa al aparecer un popup de aviso (ver OutbidWatcher).
 */
let audioCtx

function getAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    audioCtx = new Ctx()
  }
  return audioCtx
}

export function playCoinSound() {
  try {
    const ctx = getAudioContext()
    // Los navegadors arrancan el AudioContext "suspendido" hasta que hay
    // alguna interacción del usuario en la página — para cuando entra un
    // aviso, ya hubo alguna (togglear el checkbox, pujar, navegar), pero
    // el resume() de acá es un resguardo extra sin costo.
    if (ctx.state === 'suspended') ctx.resume()

    const now = ctx.currentTime
    const notes = [
      { freq: 988, start: 0, duration: 0.09 }, // B5
      { freq: 1319, start: 0.09, duration: 0.2 }, // E6
    ]
    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.15, now + start)
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + duration)
    })
  } catch {
    // Si el navegador bloquea el audio, el popup visual ya cumple el aviso.
  }
}
