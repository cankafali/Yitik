// Tone.js büyük bir kütüphane (paketin yarısından fazlası); açılışta değil,
// kullanıcı sesi ilk kez başlattığında ayrı bir parça olarak yüklenir. Bu hem
// ilk yüklemeyi hızlandırır hem de Tone'un import anında bağlam oluşturup
// tarayıcıya "AudioContext was not allowed to start" uyarısı verdirmesini önler.
let Tone = null

// Büyük kelime = kalın nota, küçük kelime = ince nota. Hangi sırayla çalarsa
// çalsın uyumlu kalması için pentatonik bir dizi kullanılıyor.
const PENTATONIC = ['C3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'Eb4', 'F4', 'G4', 'Bb4', 'C5']
const HOVER_DEBOUNCE_MS = 120

let started = false
let startingPromise = null
let hoverSynth = null
let lastHoverAt = 0
let mutedPref = false // Tone yüklenmeden önce gelen sessize alma isteği

function buildGraph() {
  const reverb = new Tone.Reverb({ decay: 6, wet: 0.4 }).toDestination()

  // Ambiyans: iki hafif detune edilmiş sine oscillator, lowpass filtre —
  // duyulur duyulmaz, çok kısık, geniş bir alan hissi.
  const ambientFilter = new Tone.Filter(400, 'lowpass').connect(reverb)
  const osc1 = new Tone.Oscillator(55, 'sine').connect(ambientFilter)
  const osc2 = new Tone.Oscillator(55.3, 'sine').connect(ambientFilter)
  osc1.volume.value = -34
  osc2.volume.value = -34
  osc1.start()
  osc2.start()

  // Hover tonu: kısa, tek nota.
  hoverSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.02, decay: 0.4, sustain: 0, release: 0.6 },
  }).connect(reverb)
  hoverSynth.volume.value = -20
}

// Tarayıcı kuralı: ses bağlamı ancak bir kullanıcı hareketinden sonra
// başlatılabilir. Bu fonksiyon hareketin olay yöneticisinden çağrılmalı.
// Ardışık çağrılar aynı promise'i paylaşır. Başarılıysa true, başlatılamazsa
// false ile çözülür (reddedilmez); başarısızlıkta sonraki çağrı yeniden dener.
export function ensureAudioStarted() {
  if (started) return Promise.resolve(true)
  if (startingPromise) return startingPromise

  // Yerel bağlam hareketin içinde senkron olarak oluşturulup başlatılır. Tone
  // dinamik olarak yüklenirken hareket penceresi kapansa bile (özellikle iOS
  // Safari'de) bağlam açık kalır; Tone yüklenince bu bağlamı kullanır.
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const ctx = AudioCtx ? new AudioCtx() : null
  ctx?.resume().catch(() => {})

  startingPromise = import('tone')
    .then(async (mod) => {
      Tone = mod
      if (ctx) Tone.setContext(ctx)
      await Tone.start()
      buildGraph()
      Tone.getDestination().mute = mutedPref
      started = true
      return true
    })
    .catch(() => {
      startingPromise = null
      return false
    })
  return startingPromise
}

// Perde kelimenin derinliğine bağlı (0 = en küçük/uzak, 1 = en büyük/yakın):
// derinlik 1 → index 0 (kalın), derinlik 0 → son index (ince). Derinlik boyut
// aralığına göre normalize olduğu için mobil ve masaüstünde aynı şekilde çalışır.
export function playHoverTone(depth) {
  if (!started || !hoverSynth) return

  const now = performance.now()
  if (now - lastHoverAt < HOVER_DEBOUNCE_MS) return
  lastHoverAt = now

  const raw = Math.round((1 - depth) * (PENTATONIC.length - 1))
  const idx = Math.min(PENTATONIC.length - 1, Math.max(0, raw))
  hoverSynth.triggerAttackRelease(PENTATONIC[idx], '8n')
}

export function setMuted(muted) {
  mutedPref = muted
  if (Tone) Tone.getDestination().mute = muted
}
