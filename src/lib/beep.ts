let shared: AudioContext | undefined

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!shared) {
    try {
      shared = new Ctor()
    } catch {
      return null
    }
  }
  if (shared.state === 'suspended') void shared.resume()
  return shared
}

/** Create the audio context during the tap that starts a session. */
export function primeAudio(): void {
  context()
}

/** A short tone when a countdown reaches zero. No audio files. */
export function playBeep(): void {
  const ctx = context()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const tone = ctx.createOscillator()
    const gain = ctx.createGain()
    tone.type = 'sine'
    tone.frequency.setValueAtTime(880, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    tone.connect(gain)
    gain.connect(ctx.destination)
    tone.start(now)
    tone.stop(now + 0.2)
  } catch {
    // A missing output or a rejected autoplay grant should not stop the session.
  }
}
