<!-- DEMO_LINK -->

<!-- DEMO_GIF -->

# Yitik Sözlük

Yitik Sözlük, Türkçenin unutulmaya yüz tutmuş, edebî kelimelerini keşfetmek için tasarlanmış etkileşimli bir web deneyimidir. Kelimeler ekranda kâğıt ya da yaprak gibi süzülerek düşer; bir kelimenin üzerine geldiğinizde (dokunmatik ekranda dokunduğunuzda) havada durur, anlamı ve kökeni belirir, boyutuna göre bir nota çalar.

## Özellikler

- **Havada süzülen kelimeler:** Her kelime yerçekimi ve hava direnciyle kendi terminal hızına ulaşır. Büyük (yakın) kelimeler daha hızlı, küçük (uzak) kelimeler daha yavaş düşer. Yaprak gibi sağa sola salınırken dönüş noktalarında yavaşlar, kaydığı yöne doğru eğilir.
- **Zoom ve resize'a dayanıklı yerleşim:** Konum ve hızlar ekran boyutuna göre oranlıdır. Tarayıcı yakınlaştırıldığında ya da pencere boyutu değiştiğinde kelimeler şeritlerinde kalır. Telefon yan çevrildiğinde alan kısa bir geçişle yeniden kurulur.
- **272 kelimelik sözlük:** Her kelimenin anlamı, kökeni (Arapça, Farsça, Eski Türkçe…) ve kategorisi (ayrılık, sevgi, hüzün, sevinç, düşünce, karakter, zaman, doğa, söz) vardır. Tanım panelinde köken küçük bir etiket olarak görünür.
- **Sürekli yenilenen alan:** Alttan çıkan kelime, o anda ekranda olmayan yeni bir kelimeyle yukarıdan yeniden doğar.
- **İmleç etkileşimi:** İmleç yaklaştıkça kelimeler yumuşakça kenara çekilir.
- **Ses:** İlk etkileşimden sonra başlayan kısık bir ambiyans ve kelimenin derinliğine göre perdesi değişen pentatonik tonlar. Ses tercihi tarayıcıda saklanır.
- **Klavye ve erişilebilirlik:** Tab ile ekrandaki kelimeler arasında gezinilir. Odaklanan kelime durur, Enter/Space seçer, Esc kapatır. Tanım paneli ekran okuyuculara duyurulur. İşletim sisteminde "hareketi azalt" açıksa düşüş yavaşlar, salınım ve eğilme kapanır.

## Teknolojiler

- React 19
- Vite 8
- Tailwind CSS 4
- Framer Motion
- Tone.js

## Kurulum

Bu proje Node.js 20.19+ veya 22.12+ gerektirir.

```bash
npm install
npm run dev
```

Uygulama varsayılan olarak `http://localhost:5173` adresinde çalışır.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusunu başlatır. |
| `npm run build` | Üretim derlemesini `dist/` klasörüne oluşturur. |
| `npm run preview` | Üretim derlemesini yerelde önizler. |
| `npm run lint` | Kod kalitesini Oxlint ile denetler. |

## İnce ayar

Düşüş fiziğinin bütün ayarları `src/components/WordField.jsx` dosyasının başında, isimli sabitler olarak durur:

| Sabit | Etkisi |
| --- | --- |
| `DRAG` | Hava direnci; büyüdükçe kelimeler terminal hıza daha çabuk oturur. |
| `TERMINAL_MIN` / `TERMINAL_MAX` | En küçük ve en büyük kelimenin terminal hızı (ekran yüksekliği / saniye). |
| `ENTRY_SPEED` | Üstten girişteki başlangıç hızı (terminal hızın oranı). |
| `SWAY_AMP_*`, `SWAY_FREQ_*` | Yaprak salınımının genliği ve frekansı. |
| `SWAY_LIFT` | Salınımın dönüş noktalarında dikey hızın ne kadar düşeceği. |
| `ROT_AMP_*` | Yatay harekete bağlı eğilme açısı. |
| `PUSH_RADIUS`, `MAX_PUSH`, `PUSH_RESPONSE` | İmleç itmesinin menzili, gücü ve yumuşaklığı. |
| `REDUCED_MOTION_SPEED` | Hareket azaltma açıkken düşüş hızı çarpanı. |

## Kelime verisi

Kelimeler `src/data/words.js` içindedir:

```js
{ text: "hicran", meaning: "Ayrılık acısı, içe işleyen ayrılık duygusu.", origin: "Arapça", category: "ayrılık" }
```

`category`, aynı dosyadaki `CATEGORIES` kümesinden biri olmalıdır. Kökeninden emin olunmayan kelimelerde `origin` boş bırakılır.

## Proje yapısı

```text
src/
  audio/        Ses motoru (Tone.js)
  components/   Arayüz bileşenleri (kelime alanı, tanım paneli, açılış başlığı)
  data/         Kelime, anlam, köken ve kategori verileri
  App.jsx       Uygulama akışı, ses tercihi
```
