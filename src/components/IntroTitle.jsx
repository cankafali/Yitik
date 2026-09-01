import { motion } from 'framer-motion'

const TITLE = 'YİTİK SÖZLÜK'
const EASE = [0.22, 1, 0.36, 1]

// Faz 1'de ortada büyük beliren başlık, faz 2'de tek bir eleman olarak
// (sıçramadan) sol üst köşedeki küçük haline kayıp ölçekleniyor. Bu andan
// itibaren Chrome.jsx'in kalıcı site adı etiketinin yerini bu eleman alır.
export default function IntroTitle({ phase }) {
  const landed = phase !== 'intro'
  const chars = Array.from(TITLE)

  return (
    <motion.div
      className="fixed z-50 pointer-events-none"
      style={{ transformOrigin: 'top left' }}
      initial={false}
      animate={{
        top: landed ? '2rem' : '50%',
        left: landed ? '6vw' : '50%',
        x: landed ? '0%' : '-50%',
        y: landed ? '0%' : '-50%',
        scale: landed ? 0.18 : 1,
      }}
      transition={{ duration: 1.2, ease: EASE }}
    >
      <div className="whitespace-pre text-5xl md:text-7xl tracking-[0.12em] text-word">
        {chars.map((ch, i) => (
          <motion.span
            key={i}
            className="inline-block"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05, ease: EASE }}
          >
            {ch}
          </motion.span>
        ))}
      </div>
      <motion.div
        className="h-px bg-accent mt-3"
        style={{ width: '4rem', transformOrigin: 'left' }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, delay: 0.8, ease: EASE }}
      />
    </motion.div>
  )
}
