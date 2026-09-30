import { AnimatePresence, motion } from 'framer-motion'

export default function DefinitionPanel({ word }) {
  // Canlı bölge kalıcı olmalı (koşullu render edilen içerik değil) ki ekran
  // okuyucular seçilen kelimeyi ve anlamını duyursun.
  return (
    <div aria-live="polite" aria-atomic="true">
      <AnimatePresence mode="wait">
        {word && (
          <motion.div
            key={word.text}
            // Mobilde alt köşelerdeki ipucu/ses butonunun üstünde, iki kenar
            // arasında durur; masaüstünde sol altta, genişliği sınırlı.
            className="fixed bottom-16 left-[6vw] right-[6vw] md:bottom-[8vh] md:right-auto md:max-w-xl z-50 pointer-events-none"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 mb-3 font-mono text-xs tracking-[0.25em] text-ui uppercase">
              <span>Anlamı</span>
              {word.origin && (
                <span className="border border-ui/60 px-2 py-0.5 text-[0.65rem] tracking-[0.2em]">
                  {word.origin}
                </span>
              )}
            </div>
            <h2 className="text-3xl md:text-5xl text-accent mb-2">{word.text}</h2>
            <p className="text-base md:text-xl text-word/80 leading-relaxed">
              {word.meaning}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
