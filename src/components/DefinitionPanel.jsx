import { AnimatePresence, motion } from 'framer-motion'

export default function DefinitionPanel({ word }) {
  return (
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
          <p
            className="text-xs tracking-[0.25em] text-ui uppercase mb-3"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            Anlamı
          </p>
          <h2 className="text-3xl md:text-5xl text-accent mb-2">{word.text}</h2>
          <p className="text-base md:text-xl text-word/80 leading-relaxed">
            {word.meaning}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
