import { motion } from 'framer-motion'

const UI_FONT = '"JetBrains Mono", monospace'

// Sol üstteki site adı artık IntroTitle.jsx tarafından yönetiliyor — açılış
// animasyonunun tek elemanı, faz 2 sonunda bu köşeye yerleşiyor.
export default function Chrome({ hideHint, phase, soundLabel, onSoundButton }) {
  const labelClass = 'text-xs tracking-[0.25em] uppercase text-ui'

  return (
    <>
      <motion.div
        className={`fixed top-8 right-[6vw] z-40 max-w-[38vw] text-right pointer-events-none ${labelClass}`}
        style={{ fontFamily: UI_FONT }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 2.4 }}
      >
        DÜŞMEKTE OLAN KELİMELER
      </motion.div>
      <div
        className={`fixed bottom-6 md:bottom-10 left-[6vw] z-40 pointer-events-none ${labelClass}`}
        style={{
          fontFamily: UI_FONT,
          opacity: phase === 'live' && !hideHint ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}
      >
        BİR KELİMEYE DOKUN
      </div>
      {/*
        Diğer Chrome öğelerinin aksine tıklanabilir olması gerekiyor.
        pointerdown'ı durduruyoruz ki App'teki "ilk etkileşimde sesi başlat"
        dinleyicisi bu butonun kendi davranışıyla yarışmasın.
      */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onSoundButton}
        className={`fixed bottom-6 md:bottom-10 right-[6vw] z-40 pointer-events-auto bg-transparent border-none cursor-pointer ${labelClass}`}
        style={{ fontFamily: UI_FONT }}
      >
        {soundLabel}
      </button>
    </>
  )
}
