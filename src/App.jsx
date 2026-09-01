import { useEffect, useState } from 'react'
import WordField from './components/WordField'
import DefinitionPanel from './components/DefinitionPanel'
import Chrome from './components/Chrome'
import IntroTitle from './components/IntroTitle'
import { ensureAudioStarted, setMuted } from './audio/soundEngine'

export default function App() {
  const [selected, setSelected] = useState(null) // { text, meaning } | null
  const [touched, setTouched] = useState(false)
  const [phase, setPhase] = useState('intro') // 'intro' -> 'reveal' -> 'live'
  const [muted, setMutedState] = useState(false) // ses varsayılan AÇIK

  useEffect(() => {
    const toReveal = setTimeout(() => setPhase('reveal'), 1400)
    const toLive = setTimeout(() => setPhase('live'), 3000)
    return () => {
      clearTimeout(toReveal)
      clearTimeout(toLive)
    }
  }, [])

  // Ses bağlamı ancak bir kullanıcı hareketinden sonra başlatılabilir.
  // İlk tıklama/dokunmada bir kez çağrılır, sonra kendini kaldırır.
  useEffect(() => {
    const onFirstInteraction = () => {
      ensureAudioStarted()
      window.removeEventListener('pointerdown', onFirstInteraction)
    }
    window.addEventListener('pointerdown', onFirstInteraction)
    return () => window.removeEventListener('pointerdown', onFirstInteraction)
  }, [])

  const handleToggleMute = () => {
    setMutedState((prev) => {
      const next = !prev
      setMuted(next)
      return next
    })
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <WordField
        phase={phase}
        onSelect={(w) => { setSelected(w); setTouched(true) }}
        onClear={() => setSelected(null)}
      />
      <Chrome
        hideHint={touched}
        phase={phase}
        muted={muted}
        onToggleMute={handleToggleMute}
      />
      <DefinitionPanel word={selected} />
      <IntroTitle phase={phase} />
    </div>
  )
}
