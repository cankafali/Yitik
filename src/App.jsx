import { useEffect, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import WordField from './components/WordField'
import DefinitionPanel from './components/DefinitionPanel'
import Chrome from './components/Chrome'
import IntroTitle from './components/IntroTitle'
import { ensureAudioStarted, setMuted } from './audio/soundEngine'

const MUTE_STORAGE_KEY = 'yitik:muted'

// Depolama gizli pencerede ya da engellenmiş site verisinde hata atabilir;
// o durumda tercih yalnızca bu oturum için geçerli olur.
function readStoredMuted() {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function storeMuted(muted) {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0')
  } catch {
    // depolama kullanılamıyor — sessizce geç
  }
}

export default function App() {
  const [selected, setSelected] = useState(null) // { text, meaning, origin, category } | null
  const [touched, setTouched] = useState(false)
  const [phase, setPhase] = useState('intro') // 'intro' -> 'reveal' -> 'live'
  const [muted, setMutedState] = useState(readStoredMuted)
  const [audioStarted, setAudioStarted] = useState(false)

  useEffect(() => {
    const toReveal = setTimeout(() => setPhase('reveal'), 1400)
    const toLive = setTimeout(() => setPhase('live'), 3000)
    return () => {
      clearTimeout(toReveal)
      clearTimeout(toLive)
    }
  }, [])

  // Ses bağlamı ancak bir kullanıcı hareketinden sonra başlatılabilir.
  // Kullanıcı sesi daha önce kapatmadıysa ilk tıklama/dokunmada bir kez
  // başlatılır; kapattıysa ses butonuna basılana kadar hiç başlatılmaz.
  // Başlatma başarısız olursa dinleyici yerinde kalır, sonraki dokunuşta
  // yeniden dener; başarılı olunca efekt temizliği dinleyiciyi kaldırır.
  useEffect(() => {
    if (muted || audioStarted) return
    const onFirstInteraction = () => {
      ensureAudioStarted().then((ok) => {
        if (ok) setAudioStarted(true)
      })
    }
    window.addEventListener('pointerdown', onFirstInteraction)
    return () => window.removeEventListener('pointerdown', onFirstInteraction)
  }, [muted, audioStarted])

  const handleSoundButton = () => {
    if (!audioStarted) {
      // "SESİ AÇ": bağlamı başlat ve (önceden kapatılmış olsa bile) sesi aç.
      setMutedState(false)
      storeMuted(false)
      setMuted(false)
      ensureAudioStarted().then((ok) => {
        if (ok) setAudioStarted(true)
      })
      return
    }
    const next = !muted
    setMutedState(next)
    setMuted(next)
    storeMuted(next)
  }

  let soundLabel = 'SESİ AÇ'
  if (audioStarted) soundLabel = muted ? 'SES KAPALI' : 'SES AÇIK'

  // reducedMotion="user": işletim sisteminde hareket azaltma açıksa framer-motion
  // konum/ölçek animasyonlarını atlar, yalnızca opaklık geçişlerini korur.
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative w-screen h-screen overflow-hidden bg-bg">
        <WordField
          phase={phase}
          onSelect={(w) => { setSelected(w); setTouched(true) }}
          onClear={() => setSelected(null)}
        />
        <Chrome
          hideHint={touched}
          phase={phase}
          soundLabel={soundLabel}
          onSoundButton={handleSoundButton}
        />
        <DefinitionPanel word={selected} />
        <IntroTitle phase={phase} />
      </div>
    </MotionConfig>
  )
}
