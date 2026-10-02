// Kelime verisini (src/data/words.js) denetler. Bağımlılık gerektirmez:
//
//   npm run check:words                 → projedeki listeyi denetler
//   node scripts/check-words.mjs <dosya> → başka bir dosyayı denetler
//
// Hata bulursa çıkış kodu 1'dir (CI'da ya da build öncesinde kullanılabilir).
// Uyarılar (ör. boş köken) çıkışı başarısız yapmaz.

import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const target = resolve(process.argv[2] ?? 'src/data/words.js')
const { words, CATEGORIES } = await import(pathToFileURL(target).href)

const lower = (s) => s.toLocaleLowerCase('tr')
// "yâran" ile "yaran" aynı kelime sayılsın: yalnızca düzeltme işareti (^)
// atılır; ç, ğ, ı, ö, ş, ü gibi Türkçe harflere dokunulmaz.
const key = (s) => lower(s).normalize('NFD').replace(/̂/g, '').normalize('NFC')

const errors = []
const warnings = []
const seen = new Map()

if (!Array.isArray(words)) {
  console.error(`✗ ${target}: "words" dizisi dışa aktarılmamış.`)
  process.exit(1)
}
if (!Array.isArray(CATEGORIES) || CATEGORIES.length === 0) {
  errors.push('"CATEGORIES" dizisi dışa aktarılmamış ya da boş.')
}

words.forEach((w, i) => {
  const at = `#${i + 1}${w && typeof w.text === 'string' ? ` "${w.text}"` : ''}`

  for (const field of ['text', 'meaning', 'origin', 'category']) {
    if (typeof w?.[field] !== 'string') errors.push(`${at}: "${field}" alanı eksik ya da metin değil.`)
  }
  if (typeof w?.text !== 'string' || typeof w?.meaning !== 'string') return

  const { text, meaning, origin, category } = w
  if (!text.trim()) errors.push(`${at}: kelime boş.`)
  if (!meaning.trim()) errors.push(`${at}: tanım boş.`)
  for (const [name, value] of [['text', text], ['meaning', meaning], ['origin', origin]]) {
    if (typeof value === 'string' && value !== value.trim()) errors.push(`${at}: "${name}" başında/sonunda boşluk var.`)
    if (typeof value === 'string' && /\s{2,}/.test(value)) errors.push(`${at}: "${name}" içinde art arda boşluk var.`)
  }
  if (text !== lower(text)) errors.push(`${at}: kelime küçük harfle yazılmalı ("${lower(text)}").`)

  const k = key(text)
  if (seen.has(k)) errors.push(`${at}: tekrar eden kelime (ilk kez #${seen.get(k) + 1}).`)
  else seen.set(k, i)

  if (Array.isArray(CATEGORIES) && !CATEGORIES.includes(category)) {
    errors.push(`${at}: geçersiz kategori "${category}" (geçerliler: ${CATEGORIES.join(', ')}).`)
  }

  // Tanım kelimenin kendisini tekrar etmesin (ör. "bihaber: olup bitenden bihaber").
  const self = new RegExp(`(^|[^\\p{L}])${lower(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u')
  if (self.test(lower(meaning))) errors.push(`${at}: tanım kelimenin kendisini tekrar ediyor.`)

  if (meaning.trim() && !/[.!?]$/.test(meaning.trim())) warnings.push(`${at}: tanım nokta ile bitmiyor.`)
  if (origin === '') warnings.push(`${at}: köken boş.`)
})

const counts = (CATEGORIES ?? []).map((c) => `${c} ${words.filter((w) => w?.category === c).length}`)
console.log(`${words.length} kelime · ${counts.join(' · ')}`)
warnings.forEach((m) => console.log(`  uyarı  ${m}`))
errors.forEach((m) => console.error(`  HATA   ${m}`))

if (errors.length > 0) {
  console.error(`✗ ${errors.length} hata, ${warnings.length} uyarı.`)
  process.exit(1)
}
console.log(`✓ Hata yok${warnings.length ? `, ${warnings.length} uyarı` : ''}.`)
