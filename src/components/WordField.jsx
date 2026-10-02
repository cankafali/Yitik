import { useEffect, useMemo, useRef, useState } from 'react'
import { words } from '../data/words'
import { playHoverTone } from '../audio/soundEngine'

// ─── Ayar sabitleri ──────────────────────────────────────────────────────
// Koordinatlar viewport'a göre normalize tutulur: x genişliğin kesri (0–1),
// y yüksekliğin kesri (0 = üst kenar, 1 = alt kenar), hızlar da
// "viewport yüksekliği / saniye" cinsinden. Ekrana yazarken o anki viewport
// boyutuyla çarpılır; böylece zoom ve resize'da kelimeler şeritlerinde kalır,
// düşüş hızı da görsel olarak aynı kalır.

// Yerleşim
const LANE_COUNT = 14
const LANE_JITTER = 0.03 // şerit merkezinden ± sapma (genişliğin kesri)
const PLACEMENT_CANDIDATES = 16 // açılışta her kelime için denenen rastgele konum sayısı
const H_MARGIN_PX = 12 // yatay kesişme kontrolünde kelimeler arası pay (px)
// Alttan çıkan kelimenin ekran dışında bekleme süresi, kendi düşüş süresinin
// (ekran yüksekliği / hız) 0 ile bu kat arasında rastgele bir oranı. Ortalama
// 0,6 → kelimelerin ~%60'ı aynı anda ekranda, açılıştaki yoğunlukla aynı.
const RESPAWN_IDLE = 1.2
const MOBILE_BREAKPOINT = 768 // px; bu genişliğin altı mobil düzen
const RESIZE_DEBOUNCE_MS = 150
const RELAYOUT_FADE_MS = 400 // mobil ↔ masaüstü geçişinde alanın sönüp yeniden kurulma süresi

// Düşüş — kâğıt/yaprak modeli: v += (g − k·v)·dt, terminal hız = g / k.
// Kelime üstten yavaş girer, hızlanır ve kendi terminal hızına oturur.
const DRAG = 1.1 // hava direnci k (1/s); büyüdükçe terminal hıza daha çabuk oturur
const TERMINAL_MIN = 0.022 // en küçük (uzak) kelimenin terminal hızı (yükseklik/s)
const TERMINAL_MAX = 0.075 // en büyük (yakın) kelimenin terminal hızı
const TERMINAL_JITTER = 0.15 // kelimeye özgü ± terminal hız sapması (oran)
const ENTRY_SPEED = 0.2 // üstten girişteki başlangıç hızı (terminal hızın oranı)

// Yaprak salınımı
const SWAY_AMP_MIN = 0.012 // yatay salınım genliği (genişliğin kesri)
const SWAY_AMP_MAX = 0.045
const SWAY_FREQ_MIN = 0.22 // salınım frekansı (Hz)
const SWAY_FREQ_MAX = 0.45
const SWAY_LIFT = 0.55 // dönüş noktalarında dikey hızın düşme oranı (0 = etkisiz, 1 = durur)
const ROT_AMP_MIN = 3 // yatay hareket yönüne bağlı eğilme (derece)
const ROT_AMP_MAX = 8

// Kelimeler arası kaçınma: dikeyde yaklaşan ve yatayda kesişen kelimeler
// değmeden önce birbirinden yana açılır, geçtikten sonra şeritlerine döner.
const AVOID_LOOKAHEAD_PX = 30 // dikeyde ne kadar önceden açılmaya başlanacağı
const AVOID_GAP_PX = 10 // açıldıktan sonra kalacak yatay boşluk
const AVOID_RESPONSE = 4 // kesişmenin saniyede giderilme hızı (1/s); küçük = daha yumuşak
const AVOID_RETURN = 0.6 // açılan kelimenin şeridine geri dönme hızı (1/s)
const AVOID_ITERATIONS = 2 // kalabalıkta çözücünün kare başına tur sayısı
const AVOID_MAX = 0.2 // en fazla yana açılma (genişliğin kesri)
const AVOID_MAX_SPEED = 90 // yana açılmanın en yüksek hızı (px/s)
const PLACEMENT_HORIZON_S = 6 // yerleşimde "yakalama" öngörüsünün süresi (s)

// İmleç itmesi — vmin (= min(genişlik, yükseklik)) cinsinden
const PUSH_RADIUS = 0.26
const MAX_PUSH = 0.1
const PUSH_RESPONSE = 5 // itmenin hedefe yaklaşma hızı (1/s); küçük = daha yumuşak

// prefers-reduced-motion açıkken: düşüş bu oranda yavaşlar; salınım,
// eğilme ve imleç itmesi kapanır.
const REDUCED_MOTION_SPEED = 0.2

// Görünüm
const EDGE_FADE_PX = 180
const EDGE_BLUR = 2 // kenarda sönerken eklenen bulanıklık (px)
const BLUR_THRESHOLD = 34 // bu boyutun altındaki kelimeler hafif bulanık (px)
const MAX_BLUR = 1.8
// Stil yazımı eşikleri: değer bundan az değiştiyse DOM'a yazılmaz. Özellikle
// `filter` her yazımda yeniden rasterize tetiklediği için pahalı.
const BLUR_EPSILON = 0.05
const OPACITY_EPSILON = 0.01
const MAX_DT = 0.05 // sekme arka plandan dönünce zaman sıçramasını kırp (s)

// Tipografi
const WEIGHT_MIN = 400 // en uzak kelimenin font ağırlığı
const WEIGHT_MAX = 850 // en yakın kelimenin font ağırlığı
const WEIGHT_JITTER = 50 // ± rastgele sapma
const ITALIC_RATIO = 0.12 // italik yazılan kelimelerin oranı

const TAU = Math.PI * 2

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi)
}

// Bazı ortamlarda (ör. henüz boyutlanmamış bir iframe) mount anında
// window.innerWidth/innerHeight geçici olarak 0 okunabilir. Böyle bir anda
// ölçüm alıp state'e gömmek tüm kelimeleri ekranın tek noktasına çöktürür —
// bu yüzden anlamsız derecede küçük bir okumayı makul bir varsayılanla değiştiriyoruz.
function safeDim(value, fallback) {
  return value && value > 50 ? value : fallback
}

function readViewport() {
  const hasWindow = typeof window !== 'undefined'
  return {
    vw: safeDim(hasWindow ? window.innerWidth : 0, 1280),
    vh: safeDim(hasWindow ? window.innerHeight : 0, 800),
  }
}

function readIsMobile() {
  return readViewport().vw < MOBILE_BREAKPOINT
}

// Alttan çıkan kelimenin yerine, o anda ekranda olmayan rastgele bir kelime seçer.
function pickReplacementWord(all) {
  const onScreen = new Set(all.map((w) => w.text))
  const pool = words.filter((entry) => !onScreen.has(entry.text))
  return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
}

function pickRandomWords(count) {
  const pool = [...words]
  const picked = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    picked.push(pool[idx])
    pool.splice(idx, 1)
  }
  return picked
}

// Boyut dağılımını kademelendirir: %55 küçük, %30 orta, %15 büyük.
// Eşikler, 18-68 aralığındaki 30/46 sınırlarının oranına göre genelleştirilmiştir
// (mobildeki 16-56 aralığında da aynı oranlarla ölçeklenir).
const SMALL_TIER_FRAC = (30 - 18) / (68 - 18) // 0.24
const MEDIUM_TIER_FRAC = (46 - 18) / (68 - 18) // 0.56

function pickTieredSize(sizeMin, sizeMax) {
  const range = sizeMax - sizeMin
  const smallEnd = sizeMin + SMALL_TIER_FRAC * range
  const mediumEnd = sizeMin + MEDIUM_TIER_FRAC * range
  const r = Math.random()
  if (r < 0.55) return rand(sizeMin, smallEnd)
  if (r < 0.85) return rand(smallEnd, mediumEnd)
  return rand(mediumEnd, sizeMax)
}

// Şerit merkezi + küçük bir jitter (genişliğin kesri olarak). Ekran kenarından
// taşmayı önleyen kırpma, güncel kelime genişliğiyle her karede yapılır.
function laneToX(lane) {
  return (lane + 0.5) / LANE_COUNT + rand(-LANE_JITTER, LANE_JITTER)
}

// Kelime ekranın üst/alt kenarına yaklaşırken soluklaştırır — böylece alta
// varınca ışınlanmak yerine sönüyor, üstte de sönük girip netleşiyor.
function edgeFade(y, h, elHeight) {
  if (y < EDGE_FADE_PX - elHeight) {
    return Math.max(0, (y + elHeight) / EDGE_FADE_PX)
  }
  if (y > h - EDGE_FADE_PX) {
    return Math.max(0, (h - y) / EDGE_FADE_PX)
  }
  return 1
}

// Derinlik bulanıklığı: küçük (uzak) kelimeler hafifçe bulanık, büyükler net.
function computeBaseBlur(size, isMobile) {
  if (isMobile) return 0 // mobilde bulanıklık tamamen kapalı
  return size < BLUR_THRESHOLD ? ((BLUR_THRESHOLD - size) / 16) * MAX_BLUR : 0
}

// Bodoni Moda'nın ortalama glif genişliğiyle kaba genişlik tahmini (px);
// gerçek ölçüm gelene kadar kullanılır.
function estimateWidth(text, size) {
  return text.length * size * 0.58
}

// Konum (x, y) yerleştirme sırasında atanır; burada geçici değerler.
function createWordState(word, sizeMin, sizeMax, isMobile) {
  const size = pickTieredSize(sizeMin, sizeMax)
  // 0 = en küçük/uzak, 1 = en büyük/yakın
  const depth = (size - sizeMin) / (sizeMax - sizeMin)
  const terminal =
    (TERMINAL_MIN + depth * (TERMINAL_MAX - TERMINAL_MIN)) *
    (1 + rand(-TERMINAL_JITTER, TERMINAL_JITTER))

  return {
    text: word.text,
    entry: word, // { text, meaning, origin, category } — seçimde panele gider
    size,
    depth,
    x: 0,
    y: 0,
    vFall: terminal,
    terminal,
    swayAmp: rand(SWAY_AMP_MIN, SWAY_AMP_MAX),
    swayFreq: rand(SWAY_FREQ_MIN, SWAY_FREQ_MAX),
    swayPhase: rand(0, TAU),
    rotAmp: rand(ROT_AMP_MIN, ROT_AMP_MAX),
    // Ölçüm mount/resize sonrası gerçek değerlerle güncellenir.
    width: estimateWidth(word.text, size),
    height: size * 1.3,
    pushX: 0, // vmin cinsinden
    pushY: 0,
    idle: 0, // > 0 iken ekran dışında bekler (s)
    avoidX: 0, // komşulardan yana açılma ofseti (genişliğin kesri)
    prevAvoidX: 0, // önceki karedeki değer (hız sınırı için)
    baseLeft: 0, // karede hesaplanan kaçınmasız sol kenar (px)
    curLeft: 0, // çözücünün çalışma kopyası (px)
    rot: 0,
    frozen: false,
    // DOM'a en son yazılan değerler (-1 = bir sonraki karede mutlaka yaz)
    lastOpacity: -1,
    lastBlur: -1,
    tabbable: null, // yalnızca ekrandaki kelimeler Tab sırasına girer

    depthOpacity: 0.35 + depth * 0.65,
    baseBlur: computeBaseBlur(size, isMobile),
    isItalic: Math.random() < ITALIC_RATIO,
    // Ağırlık derinliği izler: uzak (küçük) kelimeler ince, yakın (büyük)
    // kelimeler kalın; küçük bir sapma tekdüzeliği kırar.
    fontWeight: Math.round(
      clamp(
        WEIGHT_MIN + depth * (WEIGHT_MAX - WEIGHT_MIN) + rand(-WEIGHT_JITTER, WEIGHT_JITTER),
        WEIGHT_MIN,
        WEIGHT_MAX
      )
    ),
  }
}

// Kelimenin ekrandaki sol kenarı (px): şerit konumu, ekran kenarından
// (salınım payıyla birlikte) taşmayacak şekilde kırpılır.
function baseLeftPx(w, vw) {
  const swayPx = w.swayAmp * vw
  const maxLeft = Math.max(swayPx, vw - w.width - swayPx)
  return clamp(w.x * vw, swayPx, maxLeft)
}

// Bir kelimenin (w) şu anki x/y'sinde ne kadar "rahat" olduğunu ölçer (px).
// Yalnızca yatayda kesişen kelimelere bakılır (salınım payı dahil; şeritler
// kelimelerden dar olduğu için komşu şeritler de kesişebilir). Her biri için
// dikey boşluk, üstteki kelime alttakinden hızlıysa yakın gelecekte
// (alttaki ekrandan çıkana kadar, en fazla PLACEMENT_HORIZON_S) kapanacağı
// kadar azaltılır. Daha uzak geçişleri döngüdeki kaçınma halleder. Sonuç bu
// öngörülen boşlukların en küçüğüdür; kesişen kelime yoksa Infinity.
function clearance(w, others, vw, vh) {
  const left = baseLeftPx(w, vw)
  const sway = w.swayAmp * vw
  const a0 = left - sway - H_MARGIN_PX
  const a1 = left + w.width + sway + H_MARGIN_PX
  let best = Infinity

  for (let j = 0; j < others.length; j++) {
    const o = others[j]
    if (o === w || o.idle > 0) continue // ekran dışında bekleyenler sayılmaz
    const oLeft = baseLeftPx(o, vw)
    const oSway = o.swayAmp * vw
    if (oLeft + o.width + oSway <= a0 || oLeft - oSway >= a1) continue

    const [upper, lower] = w.y <= o.y ? [w, o] : [o, w]
    let gap = lower.y * vh - (upper.y * vh + upper.height)
    if (upper.terminal > lower.terminal) {
      const exitTime = Math.min(Math.max(0, 1 - lower.y) / lower.terminal, PLACEMENT_HORIZON_S)
      gap -= (upper.terminal - lower.terminal) * vh * exitTime
    }
    if (gap < best) best = gap
  }
  return best
}

// Açılış yerleşimi: kelimeler sırayla, her biri için birkaç rastgele aday
// konum (şerit + yükseklik) denenerek en rahat olanına yerleştirilir.
function placeInitial(all, vw, vh) {
  const placed = []
  all.forEach((w) => {
    let bestX = 0
    let bestY = 0
    let bestScore = -Infinity
    for (let k = 0; k < PLACEMENT_CANDIDATES; k++) {
      w.x = laneToX(Math.floor(Math.random() * LANE_COUNT))
      w.y = rand(-1, 1)
      const score = clearance(w, placed, vw, vh)
      if (score > bestScore) {
        bestScore = score
        bestX = w.x
        bestY = w.y
      }
    }
    w.x = bestX
    w.y = bestY
    // Ekranın içinde başlayanlar zaten terminal hızda; üstte bekleyenler
    // yavaş başlayıp hızlanır.
    w.vFall = w.y > 0 ? w.terminal : w.terminal * ENTRY_SPEED
    placed.push(w)
  })
}

// Yeniden doğuş: kelime ekranın hemen üstünde, şeritlerin en rahat
// olanından girer. Eşit derecede rahat şeritler (ör. hiç kesişen yok)
// arasından rastgele seçilir ki hep aynı şerit seçilmesin.
function placeAtTop(w, all, vw, vh) {
  w.y = -(w.height + 40) / vh
  let bestScore = -Infinity
  let bestXs = []
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    w.x = laneToX(lane)
    const score = clearance(w, all, vw, vh)
    if (score > bestScore) {
      bestScore = score
      bestXs = [w.x]
    } else if (score === bestScore) {
      bestXs.push(w.x)
    }
  }
  w.x = bestXs[Math.floor(Math.random() * bestXs.length)]
}

function Field({ onSelect, onClear, phase, isMobile }) {
  const count = isMobile ? 18 : 48
  const sizeMin = isMobile ? 16 : 18
  const sizeMax = isMobile ? 56 : 68

  const selectedWords = useMemo(() => pickRandomWords(count), [count])

  const refs = useRef([])
  const state = useRef(null)
  const viewport = useRef(null)
  // Lazy ref initialization (React'in önerdiği desen): pahalı başlangıç
  // hesaplamasını yalnızca ilk render'da bir kez yapıp ref'e gömüyoruz.
  /* oxlint-disable react/refs */
  if (state.current === null) {
    viewport.current = readViewport()
    state.current = selectedWords.map((w) => createWordState(w, sizeMin, sizeMax, isMobile))
    placeInitial(state.current, viewport.current.vw, viewport.current.vh)
  }
  /* oxlint-enable react/refs */

  const [hoveredIndex, setHoveredIndex] = useState(null)

  // Gerçek genişlik/yükseklikleri ölç ve önbelleğe al: mount'ta, fontlar
  // yüklendiğinde ve (debounce ile) her resize/zoom sonrasında. rAF döngüsü
  // içinde getBoundingClientRect/offsetWidth ÇAĞRILMAZ — layout thrashing yapar.
  useEffect(() => {
    let cancelled = false
    let timer = null

    const measure = () => {
      if (cancelled) return
      refs.current.forEach((el, i) => {
        if (el && state.current[i]) {
          state.current[i].height = el.offsetHeight
          state.current[i].width = el.offsetWidth
        }
      })
    }

    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        viewport.current = readViewport()
        measure()
      }, RESIZE_DEBOUNCE_MS)
    }

    measure()
    document.fonts?.ready.then(measure)
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // İmleç konumu React state'te değil bir ref'te tutulur: her pointermove'da
  // re-render tetiklemek performansı bozar. Dokunmatik girişler itmeye
  // katılmaz — aksi halde son dokunulan nokta kelimeleri kalıcı olarak iter.
  const mouse = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const onMove = (e) => {
      if (e.pointerType === 'touch') return
      mouse.current.x = e.clientX
      mouse.current.y = e.clientY
    }
    const onOut = (e) => {
      if (e.relatedTarget) return // pencere içinde başka bir öğeye geçiş
      mouse.current.x = -9999
      mouse.current.y = -9999
    }
    window.addEventListener('pointermove', onMove)
    document.addEventListener('pointerout', onOut)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerout', onOut)
    }
  }, [])

  // Hareket azaltma tercihi; işletim sistemi ayarı değişirse canlı güncellenir.
  const reducedMotion = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const update = () => {
      reducedMotion.current = mq.matches
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    let rafId
    let last = performance.now()
    // Salınımın ortalama dikey hızı değiştirmemesi için normalize çarpanı
    // (sin² ortalaması 1/2).
    const liftNorm = 1 / (1 - SWAY_LIFT / 2)

    // Metni değişen kelimelerin genişliği döngü içinde ölçülmez; bir sonraki
    // karenin başında (bu döngünün yazımlarından önce) tek seferde ölçülür.
    let pendingMeasure = []
    const measurePending = () => {
      pendingMeasure.forEach((i) => {
        const el = refs.current[i]
        if (el && state.current[i]) {
          state.current[i].width = el.offsetWidth
          state.current[i].height = el.offsetHeight
        }
      })
      pendingMeasure = []
    }

    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, MAX_DT)
      last = now

      const { vw, vh } = viewport.current
      const vmin = Math.min(vw, vh)
      const pushRadiusPx = PUSH_RADIUS * vmin
      const pushEase = 1 - Math.exp(-PUSH_RESPONSE * dt)
      const reduced = reducedMotion.current
      const all = state.current

      const avoidEase = 1 - Math.exp(-AVOID_RESPONSE * dt)
      const avoidReturn = 1 - Math.exp(-AVOID_RETURN * dt)

      // 1. geçiş — fizik: düşüş, salınım, yeniden doğuş. Kaçınmasız taban
      // konum (w.baseLeft) ve eğilme (w.rot) sonraki geçişler için saklanır.
      for (let i = 0; i < all.length; i++) {
        const w = all[i]
        // Dondurulmuş kelime tamamen atlanır; salınım fazı da ilerlemediği
        // için çözüldüğünde kaldığı yerden sıçramadan devam eder. Son taban
        // konumu kalır, diğer kelimeler ondan kaçınmaya devam eder.
        if (w.frozen) continue
        const el = refs.current[i]

        // Ekran dışında bekleyen kelime: süre dolunca o anki duruma göre en
        // rahat şeritte, ekranın hemen üstünden yavaşça girer.
        if (w.idle > 0) {
          w.idle -= dt
          if (w.idle > 0) {
            w.baseLeft = baseLeftPx(w, vw)
            continue
          }
          placeAtTop(w, all, vw, vh)
          w.vFall = w.terminal * ENTRY_SPEED
          w.avoidX = 0
          w.prevAvoidX = 0
        }

        // Yerçekimi + hava direnci → terminal hıza yaklaşma
        w.vFall += DRAG * (w.terminal - w.vFall) * dt

        // Yaprak salınımı: yatay konum sin(θ), yatay hız cos(θ) ile orantılı.
        // Dönüş noktalarında (|sin θ| → 1) dikey hız kısa süre düşer.
        w.swayPhase += TAU * w.swayFreq * dt
        const s = Math.sin(w.swayPhase)
        const c = Math.cos(w.swayPhase)
        const lift = reduced ? REDUCED_MOTION_SPEED : (1 - SWAY_LIFT * s * s) * liftNorm
        w.y += w.vFall * lift * dt

        if (w.y * vh > vh + 20) {
          // Aynı kelime geri dönmesin: havuzdan ekranda olmayan yeni bir
          // kelimeyle yeniden doğ. Metin DOM'a doğrudan yazılır (re-render
          // yok); React bir sonraki render'da aynı metni state'ten okur.
          // Yeni metnin genişliği yerleşimden önce tahmin edilir, gerçek
          // ölçüm bir sonraki karede gelir.
          const next = pickReplacementWord(all)
          if (next) {
            w.text = next.text
            w.entry = next
            w.width = estimateWidth(next.text, w.size)
            const inner = el && el.firstChild
            if (inner) inner.textContent = next.text
            if (pendingMeasure.length === 0) requestAnimationFrame(measurePending)
            pendingMeasure.push(i)
          }

          // Hemen değil, rastgele bir süre ekran dışında bekledikten sonra
          // girer. Aksi halde zamanla bütün kelimeler aynı anda ekranda
          // birikir (açılışta ~25 iken bir dakikada ~45) ve üst üste biner.
          // Süre kelimenin kendi düşüş süresiyle orantılı ki yoğunluk açılıştaki
          // seviyede kalsın.
          w.y = -(w.height + 40) / vh
          w.idle =
            rand(0, RESPAWN_IDLE) / (w.terminal * (reduced ? REDUCED_MOTION_SPEED : 1))
          w.baseLeft = baseLeftPx(w, vw)
          continue
        }

        // Eğilme yatay hıza bağlı: sola kayarken (cos < 0) sola yatar.
        w.rot = reduced ? 0 : w.rotAmp * c
        w.baseLeft = baseLeftPx(w, vw) + (reduced ? 0 : w.swayAmp * vw * s)
      }

      // 2. geçiş — kaçınma (konum kısıtı çözücüsü): önce her kelimeyi yay
      // gibi şeridine biraz geri çek, sonra şu anki konumlarda dikeyde
      // yaklaşan (ön görüş payıyla) ve yatayda kesişen her çifti kesişmenin
      // bir kısmı kadar ayır. Kalabalıkta zıt itmeler birbirini götürmesin
      // diye konumlar her düzeltmeden sonra güncellenir ve iki tur dönülür.
      for (let i = 0; i < all.length; i++) {
        const w = all[i]
        if (!w.frozen) w.avoidX *= 1 - avoidReturn
        w.curLeft = clamp(w.baseLeft + w.avoidX * vw, 0, Math.max(0, vw - w.width))
      }
      for (let iter = 0; iter < AVOID_ITERATIONS; iter++) {
        for (let i = 0; i < all.length; i++) {
          const a = all[i]
          const aTop = a.y * vh
          if (a.idle > 0 || aTop > vh || aTop + a.height < -AVOID_LOOKAHEAD_PX) continue
          for (let j = i + 1; j < all.length; j++) {
            const b = all[j]
            if (b.idle > 0 || (a.frozen && b.frozen)) continue
            const bTop = b.y * vh
            const overlapY =
              Math.min(aTop + a.height, bTop + b.height) - Math.max(aTop, bTop) + AVOID_LOOKAHEAD_PX
            if (overlapY <= 0) continue
            const overlapX =
              Math.min(a.curLeft + a.width, b.curLeft + b.width) -
              Math.max(a.curLeft, b.curLeft) +
              AVOID_GAP_PX
            if (overlapX <= 0) continue

            // Merkezi solda olan sola, sağda olan sağa açılır (dir: a'nın yönü).
            const dir = a.curLeft + a.width / 2 <= b.curLeft + b.width / 2 ? -1 : 1
            const corr = overlapX * avoidEase
            // Her birinin o yönde ne kadar yeri var: donmuş kelime hiç kıpırdamaz,
            // ekran kenarına dayanan da kenarı geçemez. Birinin yetmeyen payını
            // diğeri üstlenir.
            const roomA = a.frozen ? 0 : dir < 0 ? a.curLeft : vw - a.width - a.curLeft
            const roomB = b.frozen ? 0 : dir < 0 ? vw - b.width - b.curLeft : b.curLeft
            let moveA = Math.min(corr / 2, roomA)
            const moveB = Math.min(corr - moveA, roomB)
            moveA = Math.min(corr - moveB, roomA)

            a.curLeft += dir * moveA
            b.curLeft -= dir * moveB
            a.avoidX += (dir * moveA) / vw
            b.avoidX -= (dir * moveB) / vw
          }
        }
      }

      // 3. geçiş — itme ve DOM yazımı.
      for (let i = 0; i < all.length; i++) {
        const w = all[i]
        if (w.frozen) continue
        const el = refs.current[i]

        // Açılma hızını sınırla: yeni bir kesişme görüldüğünde kelime yana
        // seğirmesin, salınımla aynı yumuşaklıkta kaysın.
        const maxStep = (AVOID_MAX_SPEED * dt) / vw
        w.avoidX = clamp(
          clamp(w.avoidX, w.prevAvoidX - maxStep, w.prevAvoidX + maxStep),
          -AVOID_MAX,
          AVOID_MAX
        )
        w.prevAvoidX = w.avoidX
        const leftPx = clamp(w.baseLeft + w.avoidX * vw, 0, Math.max(0, vw - w.width))
        const topPx = w.y * vh
        const rot = w.rot

        // Ekrana girip çıktıkça Tab sırasına ekle/çıkar (yalnızca değişince yaz).
        const tabbable = topPx > -w.height && topPx < vh
        if (el && tabbable !== w.tabbable) {
          el.tabIndex = tabbable ? 0 : -1
          w.tabbable = tabbable
        }

        // İmleç itmesi: kelimenin merkezinden imlece uzaklığa göre yumuşak
        // bir kaçış hedefi; ofset bu hedefe üstel olarak yaklaşır (sıçramasız).
        const mdx = leftPx + w.width / 2 - mouse.current.x
        const mdy = topPx + w.height / 2 - mouse.current.y
        const dist = Math.hypot(mdx, mdy)
        let tx = 0
        let ty = 0
        if (!reduced && dist < pushRadiusPx && dist > 0.1) {
          const depthFactor = 0.3 + w.depth * 0.7
          const force = (1 - dist / pushRadiusPx) * MAX_PUSH * depthFactor
          tx = (mdx / dist) * force
          ty = (mdy / dist) * force
        }
        w.pushX += (tx - w.pushX) * pushEase
        w.pushY += (ty - w.pushY) * pushEase

        if (el) {
          el.style.transform = `translate3d(${leftPx + w.pushX * vmin}px, ${topPx + w.pushY * vmin}px, 0) rotate(${rot}deg)`

          const fade = edgeFade(topPx, vh, w.height)
          const settled = fade === 1 || fade === 0 // uç değerler her zaman tam yazılır
          const inner = el.firstChild
          if (inner) {
            const opacity = w.depthOpacity * fade
            const dOpacity = Math.abs(opacity - w.lastOpacity)
            if (dOpacity > OPACITY_EPSILON || (settled && dOpacity > 0)) {
              inner.style.opacity = opacity.toFixed(3)
              w.lastOpacity = opacity
            }
            const blur = w.baseBlur + (1 - fade) * EDGE_BLUR
            const dBlur = Math.abs(blur - w.lastBlur)
            if (dBlur > BLUR_EPSILON || (settled && dBlur > 0)) {
              inner.style.filter = `blur(${blur.toFixed(2)}px)`
              w.lastBlur = blur
            }
          }
        }
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Açılış animasyonu bitene kadar (faz 3 / 'live') hover devre dışı —
  // aksi halde kelimeler daha belirmeden dondurulup seçilebilir, açılışı bozar.
  const hoverEnabled = phase === 'live'

  // Seçili kelimenin index'i ayrıca ref'te tutulur ki olay yöneticileri
  // (render'ı beklemeden) önceki seçimi her zaman güvenilir biçimde çözebilsin.
  const selectedRef = useRef(null)
  // Klavye odağındaki kelime de (hover gibi) havada durur.
  const focusedRef = useRef(null)

  const unfreeze = (i) => {
    const w = state.current[i]
    if (!w) return
    if (focusedRef.current === i) return // odakta kaldıkça düşmeye başlamasın
    w.frozen = false
    // React hover sırasında filter'ı değiştirdi; önbelleği geçersiz kıl ki
    // döngü bir sonraki karede doğru değeri yazsın.
    w.lastBlur = -1
    w.lastOpacity = -1
  }

  const select = (i) => {
    if (!hoverEnabled) return
    const prev = selectedRef.current
    if (prev === i) return
    if (prev !== null) unfreeze(prev) // bir kelimeden diğerine geçerken önceki havada kalmasın
    const w = state.current[i]
    w.frozen = true
    selectedRef.current = i
    setHoveredIndex(i)
    playHoverTone(w.depth)
    onSelect(w.entry)
  }

  const clear = () => {
    const prev = selectedRef.current
    if (prev === null) return
    unfreeze(prev)
    selectedRef.current = null
    setHoveredIndex(null)
    onClear()
  }

  // Masaüstü (fare/kalem): üzerine gelince seç, ayrılınca kapat.
  // Dokunmatik: dokun-seç, başka kelimeye dokun-değiştir, boş alana dokun-kapat.
  const handlePointerEnter = (e, i) => {
    if (e.pointerType !== 'touch') select(i)
  }

  const handlePointerLeave = (e, i) => {
    if (e.pointerType !== 'touch' && selectedRef.current === i) clear()
  }

  // Klavye: Tab ile odaklanan kelime durur, Enter/Space seçer, Esc kapatır.
  const handleFocus = (i) => {
    if (!hoverEnabled) return
    focusedRef.current = i
    state.current[i].frozen = true
  }

  const handleBlur = (i) => {
    if (focusedRef.current !== i) return
    focusedRef.current = null
    if (selectedRef.current === i) clear()
    else unfreeze(i)
  }

  const handleKeyDown = (e, i) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(i)
    }
  }

  // Esc, seçim nasıl yapılmış olursa olsun (fare, dokunma, klavye) paneli kapatır.
  const clearRef = useRef(clear)
  useEffect(() => {
    clearRef.current = clear
  })
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') clearRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="absolute inset-0" onClick={clear}>
      {/*
        Ref'teki başlangıç değerlerini ilk JSX'i çizmek için okuyoruz;
        sonrasında konum güncellemeleri rAF döngüsünde doğrudan DOM'a
        yazılıyor (yeniden render tetiklenmiyor), bkz. yukarıdaki efekt.
      */}
      {/* oxlint-disable react/refs */}
      {selectedWords.map((_, i) => {
        const w = state.current[i]
        const { vw, vh } = viewport.current
        // Faz 1'de kelime tamamen görünmez ama düşme döngüsü arka planda
        // çalışmaya devam eder — faz 2'ye geçince zaten dağılmış olur.
        // Faz 2'de her kelime kendi index'ine göre kademeli beliriyor;
        // faz 3'te bu gecikme sıfırlanır ki hover geçişleri gecikmesin.
        const revealOpacity =
          phase === 'intro' ? 0 : hoveredIndex !== null && hoveredIndex !== i ? 0.12 : 1
        return (
          <div
            key={i}
            ref={(el) => (refs.current[i] = el)}
            role="button"
            aria-pressed={hoveredIndex === i}
            className="absolute top-0 left-0 cursor-pointer select-none whitespace-nowrap outline-none focus-visible:outline-1 focus-visible:outline-accent focus-visible:outline-offset-8"
            style={{
              transform: `translate3d(${baseLeftPx(w, vw)}px, ${w.y * vh}px, 0) rotate(0deg)`,
              willChange: 'transform',
              opacity: revealOpacity,
              transitionDelay: phase === 'reveal' ? `${i * 0.025}s` : '0s',
              transition: phase === 'reveal' ? 'opacity 0.8s ease' : 'opacity 0.4s ease',
            }}
            onPointerEnter={(e) => handlePointerEnter(e, i)}
            onPointerLeave={(e) => handlePointerLeave(e, i)}
            // Fare/dokunma tıklaması odak vermesin: odak yalnızca klavyeyle
            // gelsin, yoksa imleç ayrıldığında kelime odakta asılı kalır.
            onMouseDown={(e) => e.preventDefault()}
            onFocus={() => handleFocus(i)}
            onBlur={() => handleBlur(i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onClick={(e) => {
              e.stopPropagation()
              select(i)
            }}
          >
            <span
              style={{
                fontSize: w.size + 'px',
                opacity: w.depthOpacity,
                // Hover'da kamera odaklanıyormuş gibi netleşir; diğer zamanlarda
                // gerçek değeri rAF döngüsü (derinlik + kenar bulanıklığı) yazar.
                filter: `blur(${hoveredIndex === i ? 0 : w.baseBlur}px)`,
                color: hoveredIndex === i ? 'var(--color-accent)' : 'var(--color-word)',
                fontStyle: w.isItalic ? 'italic' : 'normal',
                fontWeight: w.fontWeight,
                transition: 'color 0.3s ease, filter 0.35s ease',
              }}
            >
              {w.text}
            </span>
          </div>
        )
      })}
      {/* oxlint-enable react/refs */}
    </div>
  )
}

// Mobil/masaüstü eşiği geçildiğinde (ör. telefon yan çevrildiğinde) kelime
// sayısı ve boyut aralığı değişir; alan kısa bir sönme ile yeniden kurulur.
export default function WordField({ onSelect, onClear, phase }) {
  const [isMobile, setIsMobile] = useState(readIsMobile)
  const [relayouting, setRelayouting] = useState(false)
  const isMobileRef = useRef(isMobile)
  const onClearRef = useRef(onClear)

  useEffect(() => {
    onClearRef.current = onClear
  }, [onClear])

  useEffect(() => {
    let debounceTimer = null
    let swapTimer = null

    const onResize = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        const next = readIsMobile()
        if (next === isMobileRef.current) return
        isMobileRef.current = next
        clearTimeout(swapTimer)
        setRelayouting(true)
        swapTimer = setTimeout(() => {
          onClearRef.current()
          setIsMobile(next)
          setRelayouting(false)
        }, RELAYOUT_FADE_MS)
      }, RESIZE_DEBOUNCE_MS)
    }

    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(debounceTimer)
      clearTimeout(swapTimer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: relayouting ? 0 : 1,
        transition: `opacity ${RELAYOUT_FADE_MS}ms ease`,
      }}
    >
      <Field
        key={isMobile ? 'mobile' : 'desktop'}
        isMobile={isMobile}
        phase={phase}
        onSelect={onSelect}
        onClear={onClear}
      />
    </div>
  )
}
