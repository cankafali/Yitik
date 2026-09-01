import { useEffect, useMemo, useRef, useState } from 'react'
import { words } from '../data/words'
import { playHoverTone } from '../audio/soundEngine'

const LANE_COUNT = 14
const LANE_WIDTH = 100 / LANE_COUNT // ~7.14%
const LANE_JITTER = 3 // ±3%
const MIN_LANE_Y_GAP = 250 // aynı şeritteki kelimeler arası minimum başlangıç mesafesi (px)
const PUSH_RADIUS = 220 // imleç itmesinin etki yarıçapı (px)
const MAX_PUSH = 90 // maksimum itme mesafesi (px)

function rand(min, max) {
  return min + Math.random() * (max - min)
}

// Bazı ortamlarda (ör. henüz boyutlanmamış bir iframe) mount anında
// window.innerWidth/innerHeight geçici olarak 0 okunabilir. Böyle bir anda
// ölçüm alıp state'e gömmek tüm kelimeleri ekranın tek noktasına çöktürür —
// bu yüzden anlamsız derecede küçük bir okumayı makul bir varsayılanla değiştiriyoruz.
function safeDim(value, fallback) {
  return value && value > 50 ? value : fallback
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

// Kelimeleri 14 dikey şeride, sırayla ve karıştırılmış biçimde dağıtır —
// böylece şeritler arasında kaba bir denge kalır ama sıralama öngörülebilir olmaz.
function assignLanesShuffled(count, laneCount) {
  const lanes = []
  for (let i = 0; i < count; i++) lanes.push(i % laneCount)
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[lanes[i], lanes[j]] = [lanes[j], lanes[i]]
  }
  return lanes
}

// Aynı şeride düşen kelimelerin başlangıç y'lerini -viewportHeight ile
// +viewportHeight arasına yayar ve aralarında en az MIN_LANE_Y_GAP bırakır.
function computeInitialYs(laneAssignment, viewportHeight, laneCount, minGap) {
  const byLane = Array.from({ length: laneCount }, () => [])
  laneAssignment.forEach((lane, idx) => byLane[lane].push(idx))

  const ys = new Array(laneAssignment.length)
  byLane.forEach((indices) => {
    if (indices.length === 0) return
    const localYs = indices.map(() => rand(-viewportHeight, viewportHeight))
    const order = indices.map((_, k) => k).sort((a, b) => localYs[a] - localYs[b])
    for (let k = 1; k < order.length; k++) {
      const prev = order[k - 1]
      const curr = order[k]
      if (localYs[curr] - localYs[prev] < minGap) {
        localYs[curr] = localYs[prev] + minGap
      }
    }
    indices.forEach((idx, k) => {
      ys[idx] = localYs[k]
    })
  })
  return ys
}

// Yatay konum: şerit merkezi + küçük bir jitter. KURAL 6 gereği, kelime
// genişliğini ve salınım genliğini hesaba katarak ekran kenarından taşmayı
// engelleyecek şekilde kırpılır.
function computeXPercentForLane(lane, text, size, amplitude) {
  const vw = safeDim(typeof window !== 'undefined' ? window.innerWidth : 0, 1280)
  const approxWidthPx = text.length * size * 0.58 // Bodoni Moda için ortalama glif genişliği
  const widthPct = (approxWidthPx / vw) * 100
  const ampPct = (amplitude / vw) * 100

  const center = (lane + 0.5) * LANE_WIDTH
  const x = center + rand(-LANE_JITTER, LANE_JITTER)

  const minX = Math.max(0, ampPct)
  const maxX = Math.max(minX, 100 - widthPct - ampPct)
  return Math.min(Math.max(x, minX), maxX)
}

// Kelime ekranın üst/alt kenarına yaklaşırken soluklaştırır — böylece alta
// varınca ışınlanmak yerine sönüyor, üstte de sönük girip netleşiyor.
function edgeFade(y, h, elHeight) {
  const FADE = 180
  if (y < FADE - elHeight) {
    return Math.max(0, (y + elHeight) / FADE)
  }
  if (y > h - FADE) {
    return Math.max(0, (h - y) / FADE)
  }
  return 1
}

// Derinlik bulanıklığı: 34px altındaki kelimeler hafifçe bulanık, üstündekiler net.
// Mount'ta bir kez hesaplanır (boyut değişmediği için karede güncellenmez).
const BLUR_THRESHOLD = 34
const MAX_BLUR = 1.8

function computeBaseBlur(size, isMobile) {
  if (isMobile) return 0 // mobilde bulanıklık tamamen kapalı
  return size < BLUR_THRESHOLD ? ((BLUR_THRESHOLD - size) / 16) * MAX_BLUR : 0
}

function createWordState(word, sizeMin, sizeMax, lane, initialY, isMobile) {
  const size = pickTieredSize(sizeMin, sizeMax)
  const range = sizeMax - sizeMin
  const speed = 15 + ((size - sizeMin) / range) * 40
  const depthOpacity = 0.35 + ((size - sizeMin) / range) * 0.65
  const amplitude = rand(20, 90)

  return {
    text: word.text,
    meaning: word.meaning,
    size,
    lane,
    xPercent: 0, // aşağıda dolduruluyor
    y: initialY,
    width: 0, // ölçüm efekti mount sonrası bir kez dolduruyor
    height: size * 1.3, // ölçüm efekti çalışana kadarki yaklaşık değer
    pushX: 0,
    pushY: 0,
    speed,
    amplitude,
    frequency: rand(0.2, 0.6),
    phase: rand(0, Math.PI * 2),
    rotAmp: rand(2, 6),
    rotFreq: rand(0.15, 0.4),
    rotPhase: rand(0, Math.PI * 2),
    frozen: false,
    depthOpacity,
    baseBlur: computeBaseBlur(size, isMobile),
    isItalic: Math.random() < 1 / 3,
    fontWeight: Math.round(rand(400, 900)),
  }
}

export default function WordField({ onSelect, onClear, phase }) {
  const isMobile = useMemo(
    () => safeDim(typeof window !== 'undefined' ? window.innerWidth : 0, 1280) < 768,
    []
  )
  const count = isMobile ? 18 : 48
  const sizeMin = isMobile ? 16 : 18
  const sizeMax = isMobile ? 56 : 68

  const selectedWords = useMemo(() => pickRandomWords(count), [])

  const refs = useRef([])
  const state = useRef(null)
  if (state.current === null) {
    const h = safeDim(typeof window !== 'undefined' ? window.innerHeight : 0, 800)
    const laneAssignment = assignLanesShuffled(selectedWords.length, LANE_COUNT)
    const initialYs = computeInitialYs(laneAssignment, h, LANE_COUNT, MIN_LANE_Y_GAP)

    state.current = selectedWords.map((w, i) =>
      createWordState(w, sizeMin, sizeMax, laneAssignment[i], initialYs[i], isMobile)
    )
    state.current.forEach((sw) => {
      sw.xPercent = computeXPercentForLane(sw.lane, sw.text, sw.size, sw.amplitude)
    })
  }

  const [hoveredIndex, setHoveredIndex] = useState(null)

  // Gerçek genişlik/yükseklikleri mount'tan hemen sonra bir kez ölç ve
  // önbelleğe al. rAF döngüsü içinde getBoundingClientRect/offsetWidth
  // ÇAĞIRMA — pahalıdır, layout thrashing yapar.
  useEffect(() => {
    refs.current.forEach((el, i) => {
      if (el) {
        state.current[i].height = el.offsetHeight
        state.current[i].width = el.offsetWidth
      }
    })
  }, [])

  // Mouse konumu React state'te DEĞİL, bir ref'te tutulur (KURAL 2 ile aynı
  // gerekçe: her mousemove'da re-render tetiklemek performansı bozar).
  const mouse = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const onMove = (e) => {
      mouse.current.x = e.clientX
      mouse.current.y = e.clientY
    }
    const onLeave = () => {
      mouse.current.x = -9999
      mouse.current.y = -9999
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  useEffect(() => {
    let rafId
    let last = performance.now()
    let elapsed = 0

    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05) // sekme arka plandayken sıçramayı engelle
      last = now
      elapsed += dt

      const h = safeDim(window.innerHeight, 800)
      const vw = safeDim(window.innerWidth, 1280)

      state.current.forEach((w, i) => {
        const el = refs.current[i]
        if (w.frozen) return // dondurulmuş kelime tamamen atlanır, son hali korunur

        w.y += w.speed * dt
        if (w.y > h + 20) {
          // En boş şeridi bul: her şeritteki en üstteki (en küçük y'li) kelimenin
          // y değerine bak, en düşük olanı seç. Hiç kelimesi olmayan bir şerit
          // otomatik olarak en boş kabul edilir.
          const laneMinY = new Array(LANE_COUNT).fill(Infinity)
          state.current.forEach((other, j) => {
            if (j === i) return
            if (other.y < laneMinY[other.lane]) laneMinY[other.lane] = other.y
          })
          let bestLane = 0
          let bestVal = Infinity
          for (let l = 0; l < LANE_COUNT; l++) {
            const val = laneMinY[l] === Infinity ? -Infinity : laneMinY[l]
            if (val < bestVal) {
              bestVal = val
              bestLane = l
            }
          }

          w.lane = bestLane
          w.y = -w.height - 40
          w.xPercent = computeXPercentForLane(w.lane, w.text, w.size, w.amplitude)
          if (el) el.style.left = w.xPercent + '%'
        }

        const dx = w.amplitude * Math.sin(elapsed * w.frequency + w.phase)
        const rot = w.rotAmp * Math.sin(elapsed * w.rotFreq + w.rotPhase)

        // İmleç itmesi: kelimenin ekrandaki merkezini bul, imleçten uzaklığa
        // göre yumuşak bir kaçış kuvveti uygula (lerp ile, sıçramasız).
        const baseX = (w.xPercent / 100) * vw
        const cx = baseX + dx + w.width / 2
        const cy = w.y + w.height / 2
        const mdx = cx - mouse.current.x
        const mdy = cy - mouse.current.y
        const dist = Math.hypot(mdx, mdy)

        let tx = 0
        let ty = 0
        if (dist < PUSH_RADIUS && dist > 0.1) {
          const depthFactor = 0.3 + ((w.size - 18) / 50) * 0.7
          const force = (1 - dist / PUSH_RADIUS) * MAX_PUSH * depthFactor
          tx = (mdx / dist) * force
          ty = (mdy / dist) * force
        }
        w.pushX += (tx - w.pushX) * 0.08
        w.pushY += (ty - w.pushY) * 0.08

        if (el) {
          el.style.transform = `translate3d(${dx + w.pushX}px, ${w.y + w.pushY}px, 0) rotate(${rot}deg)`

          const fade = edgeFade(w.y, h, w.height)
          const inner = el.firstChild
          if (inner) {
            inner.style.opacity = (w.depthOpacity * fade).toFixed(3)
            inner.style.filter = `blur(${(w.baseBlur + (1 - fade) * 2).toFixed(2)}px)`
          }
        }
      })

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Açılış animasyonu bitene kadar (faz 3 / 'live') hover devre dışı —
  // aksi halde kelimeler daha belirmeden dondurulup seçilebilir, açılışı bozar.
  const hoverEnabled = phase === 'live'

  const handleEnter = (i) => {
    if (!hoverEnabled) return
    const w = state.current[i]
    w.frozen = true
    setHoveredIndex(i)
    playHoverTone(w.size)
    onSelect({ text: w.text, meaning: w.meaning })
  }

  const handleLeave = () => {
    setHoveredIndex((prev) => {
      if (prev !== null && state.current[prev]) {
        state.current[prev].frozen = false
      }
      return null
    })
    onClear()
  }

  const handleBackgroundClick = () => {
    if (hoveredIndex !== null) {
      handleLeave()
    }
  }

  return (
    <div className="absolute inset-0" onClick={handleBackgroundClick}>
      {selectedWords.map((_, i) => {
        const w = state.current[i]
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
            className="absolute top-0 cursor-pointer select-none whitespace-nowrap"
            style={{
              left: w.xPercent + '%',
              transform: `translate3d(0px, ${w.y}px, 0) rotate(0deg)`,
              willChange: 'transform',
              opacity: revealOpacity,
              transitionDelay: phase === 'reveal' ? `${i * 0.025}s` : '0s',
              transition: phase === 'reveal' ? 'opacity 0.8s ease' : 'opacity 0.4s ease',
            }}
            onMouseEnter={() => handleEnter(i)}
            onMouseLeave={handleLeave}
            onClick={(e) => {
              e.stopPropagation()
              handleEnter(i)
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
    </div>
  )
}
