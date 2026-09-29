# Değişiklikler

`YITIK_GOREVLER.md` içindeki iş listesinin uygulanışı. Main'e hiçbir şey merge edilmedi.

## Branch'ler

Bütün başlıklar aynı dosyalara (özellikle `WordField.jsx`) dokunduğu için branch'ler **zincirleme** açıldı: her biri bir öncekinin üstüne kurulu. Sırayla incelenip merge edilebilir. Yalnızca en sondakini merge etmek de hepsini getirir.

| Sıra | Branch | Kapsam |
| --- | --- | --- |
| 1 | `feat/physics` | Normalize koordinatlar, zoom/resize, yaprak düşüşü fiziği |
| 2 | `fix/bugs` | Mobilde donan kelime, ses etiketi, derinlik, blur yazımı, panel çakışması |
| 3 | `feat/words` | 200 yeni kelime, köken/kategori, kelime rotasyonu |
| 4 | `feat/a11y` | Klavye, aria-live, prefers-reduced-motion |
| 5 | `chore/cleanup` | Paket adı, `--font-mono`, derinliğe bağlı font ağırlığı |
| 6 | `docs/readme` | README, meta/Open Graph etiketleri, bu dosya |

Her adımda lint (0 uyarı, 0 hata) ve build temiz geçti. Yeni bağımlılık eklenmedi.

## 1. Fizik ve düşme eğrisi

- **Koordinat sistemi:** `x` genişliğin, `y` yüksekliğin kesri olarak tutuluyor. Hız birimi "ekran yüksekliği / saniye". Ekrana yazarken o anki viewport boyutuyla çarpılıyor. Viewport boyutu ve kelime genişlikleri resize'da (150 ms debounce), mount'ta ve fontlar yüklendiğinde yeniden ölçülüyor. rAF döngüsü içinde hiç ölçüm yok.
- **Mobil ↔ masaüstü:** 768 px eşiği geçilince alan 400 ms'lik bir sönme ile yeniden kuruluyor (kelime sayısı ve boyut aralığı güncelleniyor).
- **Düşüş modeli:** `v += k·(v_terminal − v)·dt`, yani `v += (g − k·v)·dt`. Terminal hız derinliğe bağlı, kelime başına ±%15 sapmalı. Üstten giren kelime terminal hızın %20'siyle başlayıp hızlanıyor.
- **Salınım:** Faz her kelime için ayrı ilerliyor. Yatay konum `sin θ`, eğilme `cos θ` (yatay hız) ile orantılı. Sola kayarken sola yatıyor. Dönüş noktalarında (`|sin θ| → 1`) dikey hız `SWAY_LIFT` oranında düşüyor. Normalize çarpanı sayesinde ortalama hız değişmiyor.
- **İtme:** vmin cinsinden hesaplanıyor. Ofset hedefe `1 − e^(−k·dt)` ile yaklaşıyor, böylece kare hızından bağımsız ve sıçramasız. Donmuş kelimenin fazı ilerlemediği için çözüldüğünde kaldığı yerden devam ediyor. Eski kodda küresel zaman kullanıldığından çözülen kelime sıçrıyordu.
- **dt kırpması** (`MAX_DT = 0.05`) korundu.
- **Yan düzeltme:** "En boş şerit" seçimi aslında en üstünde kelime bulunan, yani en kalabalık şeridi seçiyordu. Artık en üstteki kelimesi en aşağıda kalan şerit seçiliyor.
- Tüm sabitler dosyanın başında ve açıklamalı. README'de de bir tablo var.

## 2. Hata düzeltmeleri

- **Mobilde donmuş kelime:** Seçim pointer event'lerine taşındı. Seçili index bir ref'te tutuluyor ve yeni kelime seçilirken önceki her zaman çözülüyor. Fare/kalemde hover davranışı sürüyor. Dokunmatikte dokun-seç, başka kelimeye dokun-değiştir, boş alana dokun-kapat.
- Dokunmatik dokunuşlar artık imleç itmesine katılmıyor. Eskiden son dokunulan nokta kelimeleri kalıcı olarak itiyordu.
- **Ses etiketi:** Ses başlamadan buton "SESİ AÇ" gösteriyor, tıklanınca sesi başlatıyor. Sonra "SES AÇIK / SES KAPALI" olarak değişiyor. Tercih `localStorage`'da (`yitik:muted`, try/catch ile) saklanıyor. Kullanıcı sesi kapattıysa ilk tıklamada ses bağlamı hiç başlatılmıyor.
- **Derinlik:** Her kelimede 0–1 arası `depth` var. `playHoverTone(depth)` ve itme bunu kullanıyor.
- **Blur/opacity:** Yalnızca eşikten (`BLUR_EPSILON`, `OPACITY_EPSILON`) fazla değişince ya da uç değere oturunca DOM'a yazılıyor.
- **Panel çakışması:** Mobilde panel `bottom-16`, ipucu ve ses butonu `bottom-6`. Panel iki kenar arasında kalıyor. 375×667'de ölçüldü, çakışma yok.

## 3. Kelimeler

- Toplam **272 kelime**: 72 mevcut + 200 yeni. Tekrar kontrolü bir script ile yapıldı (büyük/küçük harf duyarsız, Türkçe yerel ayarıyla). Tekrar yok, kendi kelimesini tekrar eden tanım yok, geçersiz kategori yok.
- Çıkarılanlar ve yerine gelenler: `gam` → `gussa`, `tebessüm` → `hande`, `kısmet` → `mukadderat`, `mahcup` → `hacil`, `kasvet` → `inkıbaz`. `kanaat` karşılıksız çıkarıldı, çünkü listede zaten `istiğna` var.
- `bihaber` tanımı düzeltildi.
- Kategoriler: `ayrılık, sevgi, hüzün, sevinç, düşünce, karakter, zaman, doğa, söz`. `söz` eklendi, çünkü `meram`, `girizgâh`, `belagat` gibi kelimeler diğer gruplara oturmuyordu.
- Kökeni emin olunamayan iki kelimede (`muştu`, `çelebi`) `origin` boş bırakıldı.
- Kelime seçerken emin olmadığım ya da TDK Güncel Sözlük'te bulunduğundan şüphe ettiğim adaylar elendi. Yine de sözlükle bir kez göz gezdirmeniz iyi olur (bkz. aşağıdaki test listesi).
- **Rotasyon:** Alttan çıkan kelime, havuzdan o anda ekranda olmayan rastgele bir kelimeyle yeniden doğuyor. Metin DOM'a doğrudan yazılıyor, re-render yok. Genişlik bir sonraki karenin başında tek seferde ölçülüyor.
- Tanım panelinde köken küçük bir etiket olarak görünüyor.

## 4. Erişilebilirlik

- Kelimeler `role="button"` ve `aria-pressed` taşıyor. Yalnızca ekrandaki kelimeler Tab sırasında: `tabIndex`, kelime ekrana girip çıktıkça ve yalnızca değer değiştiğinde yazılıyor.
- Odaklanan kelime durur, Enter/Space seçer, Esc kapatır. Esc, fare ya da dokunma ile yapılan seçimleri de kapatır.
- Fare/dokunma tıklaması odak vermiyor. Aksi halde imleç ayrıldığında kelime odakta asılı kalıyordu.
- Tanım paneli kalıcı bir `aria-live="polite"` bölgesinin içinde.
- `prefers-reduced-motion`: düşüş %20 hıza iniyor, salınım, eğilme ve itme kapanıyor. Framer Motion animasyonları için `MotionConfig reducedMotion="user"` eklendi.

## 5. Temizlik

- `package.json` ve `package-lock.json`: `"premium"` → `"yitik"`.
- `--font-mono` `@theme` içinde tanımlı. Inline `fontFamily` tekrarları `font-mono` class'ıyla değiştirildi.
- "KURAL 2/6" atıfları açık açıklamalarla değiştirildi.
- Font ağırlığı derinliğe bağlı (400 → 850, ±50). İtalik oranı 1/3'ten %12'ye indi.

## 6. README ve sunum

- README Türkçe karakterlerle yeniden yazıldı. En üstte `<!-- DEMO_LINK -->` ve `<!-- DEMO_GIF -->` yer tutucuları var.
- `index.html`: `meta description`, `og:title`, `og:description`, `og:image` (`/og-image.png` yer tutucusu) ve `twitter:card` eklendi.

## Notlar

- **Lint:** Bu makinede Windows Uygulama Denetimi (Smart App Control) oxlint'in native binary'sini engelliyor, bu yüzden `npm run lint` Windows'ta çalışmıyor. Sistem ayarına dokunulmadı. Lint, WSL (Ubuntu) içinde aynı sürümle (oxlint 1.81.0) ve projenin `.oxlintrc.json`'ıyla çalıştırıldı: 0 uyarı, 0 hata. Windows'ta çalıştırmak için bu engelin sizin tarafınızda kaldırılması gerekiyor.
- **Zoom ve mobil düzen:** Mobil eşiği CSS piksel cinsinden olduğu için dar bir pencerede %200 zoom mobil düzene geçirebilir (CSS media query'leri de aynı davranır). Bu bilinçli bırakıldı.
- Kelimeler şeritlerden geniş olduğu için ara sıra üst üste binebiliyorlar. Bu davranış eskiden de vardı, değiştirilmedi.
- Konsoldaki "AudioContext was not allowed to start" uyarısı Tone.js'in import anında bağlam oluşturmasından geliyor ve eskiden de vardı. Ses ilk kullanıcı hareketinde düzgün başlıyor.

## Elle test listesi

- [ ] Ctrl+ / Ctrl- ile %50–%200 zoom: şeritler dengeli, hizalar bozulmuyor
- [ ] Pencere daraltma/genişletme ve telefonu yan çevirme
- [ ] Düşüş: üstten yavaş giriş, hızlanma, yaprak gibi salınım
- [ ] Mobil: kelimeden kelimeye dokununca hiçbir kelime havada asılı kalmıyor
- [ ] Ses butonu: ilk açılışta "SESİ AÇ", tıklanınca ambiyans başlıyor, tercih yenilemede korunuyor
- [ ] Klavye: Tab ile kelimeler arası gezinme, Enter ile seçme, Esc ile kapatma
- [ ] Kelimeler alttan çıkınca yeni kelimeler geliyor, tekrar eden kelime yok
- [ ] `npm run lint` ve `npm run build` temiz
- [ ] İşletim sisteminde "hareketi azalt" açıkken düşüş yavaş, salınım yok
- [ ] Yeni kelimelerin tanımlarına TDK Güncel Türkçe Sözlük ile göz gezdirme
- [ ] Deploy sonrası README yer tutucularını ve `og:image` yolunu doldurma
