<!-- DEMO_LINK -->

<!-- DEMO_GIF -->

# Yitik Sözlük

Türkçenin unutulmaya yüz tutmuş, edebî kelimeleri ekranda yaprak gibi süzülerek düşer. Bir kelimenin üzerine gelin ya da dokunun: havada durur, anlamı ve kökeni belirir, boyutuna göre bir nota çalar.

## Özellikler

- **Yaprak gibi düşüş:** Kelimeler yavaş başlayıp hızlanır, sağa sola salınarak iner. Büyük (yakın) kelimeler hızlı, küçükler süzülerek düşer.
- **272 kelime:** Her birinin anlamı, kökeni (Arapça, Farsça, Eski Türkçe…) ve kategorisi var. Ekrandan çıkan kelimenin yerine her seferinde yeni bir kelime gelir.
- **Her ekranda aynı düzen:** Yakınlaştırma, pencere boyutu ve telefonun yan çevrilmesi yerleşimi bozmaz.
- **Ses:** Kısık bir ambiyans ve kelimenin derinliğine göre değişen notalar. Ses tercihi hatırlanır.
- **Erişilebilir:** Klavyeyle gezinme (Tab, Enter, Esc), ekran okuyucu desteği ve "hareketi azalt" ayarına uyum.

## Teknolojiler

React 19 · Vite 8 · Tailwind CSS 4 · Framer Motion · Tone.js

## Kurulum

Node.js 20.19+ veya 22.12+ gerekir.

```bash
npm install
npm run dev
```

Uygulama `http://localhost:5173` adresinde açılır.

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi (`dist/`) |
| `npm run preview` | Derlemeyi yerelde önizleme |
| `npm run lint` | Oxlint ile kod denetimi |
| `npm run check:words` | Kelime verisini denetler (tekrar, kategori, tanım) |

## Proje yapısı

```text
src/
  audio/        Ses motoru
  components/   Kelime alanı, tanım paneli, açılış başlığı
  data/         Kelimeler (anlam, köken, kategori)
  App.jsx       Uygulama akışı
```

Düşüş fiziğinin ayarları (yerçekimi, hava direnci, salınım vb.) `src/components/WordField.jsx` dosyasının başında isimli sabitler olarak durur. Yeni kelime eklemek için `src/data/words.js` dosyasına aynı biçimde bir satır ekleyip `npm run check:words` çalıştırmak yeterli.
