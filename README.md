# Yitik Sozluk

Yitik Sozluk, Turkce'nin unutulmaya yuz tutmus ve edebi kelimelerini kesfetmek icin tasarlanmis etkilesimli bir web deneyimidir. Kelimelerin uzerine gelerek sesli geri bildirim alabilir, bir kelimeyi sectiginizde anlamini goruntuleyebilirsiniz.

## Ozellikler

- Etkilesimli kelime alani
- Secilen kelimenin anlamini gosteren tanim paneli
- Ilk kullanici etkilesiminden sonra baslayan ambiyans sesi
- Kelime boyutuna gore degisen gezinme tonlari
- Ses acma/kapatma denetimi
- Giris animasyonu ve duyarlı arayuz

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

Uygulama varsayilan olarak `http://localhost:5173` adresinde calisir.

## Komutlar

| Komut | Aciklama |
| --- | --- |
| `npm run dev` | Gelistirme sunucusunu baslatir. |
| `npm run build` | Uretim derlemesini `dist/` klasorune olusturur. |
| `npm run preview` | Uretim derlemesini yerelde onizler. |
| `npm run lint` | Kod kalitesini Oxlint ile denetler. |

## Proje Yapisi

```text
src/
	audio/        Ses motoru
	components/   Arayuz bilesenleri
	data/         Kelime ve anlam verileri
	App.jsx       Uygulama akisi
```
