---
name: rehber
description: Merak’ın Rehber bölümünü günceller; alanlara göre kaliteli kaynak (kitap, podcast, belgesel, kurs, site) araştırır, doğrular ve veri/rehber/<alan>.json’a yazar. Kullanıcı /rehber yazdığında, bir alan için kaynak önerisi ya da okuma rehberi istediğinde ya da rehberin yenilenmesini istediğinde kullan.
argument-hint: "[alan | hepsi | yenile] [odak, ör. “Osmanlı”, “yalnızca Türkçe”]"
---

# /rehber — alanlara göre kaynak rehberi

İstek: `$ARGUMENTS`

Rehber, uygulamadaki **Rehber** sekmesinde görünür. Her alanın bir dosyası vardır: `veri/rehber/<alan>.json` (alanlar `CLAUDE.md`’de; ayrıca alanlar arası kaynaklar için `genel`). Şema: `src/lib/schema.ts` → `GuideSchema`.

## Adımlar

1. `git -C veri pull --ff-only`, sonra `npm run kontrol` (rehber tablosunda alan başına kaynak sayısı ve sıradaki kimlik görünür) ve `npm run ozet` (merak tablosu, son okumalar).
2. Kapsamı belirle:
   - Argüman yoksa: merakı en yüksek iki alanı ve kaynak sayısı en düşük alanı seç; her birine 2–4 yeni kaynak ekle.
   - `<alan>`: o alanın rehberini gözden geçir, eksikleri tamamla (ör. Türkçe kaynak az, podcast yok, ileri düzey yok).
   - `yenile`: tüm rehberlerde bağlantıları ve “tükendi / yayından kalktı” durumlarını denetle.
   - Kullanıcının okuma günlüğüne bak: okuduklarına benzeyen ve bir adım ilerisi olan kaynakları tercih et.
3. **Araştır ve doğrula** (her kaynak için):
   - Eserin gerçekten var olduğunu ve **Türkçe adını** WebSearch ile doğrula. Çeviri adları çoğu zaman tahmin edilenden farklıdır (ör. *Prisoners of Geography* → *Coğrafya Mahkumları*). Türkçe baskısı bulunamıyorsa `lang: "en"` yaz ve `why` içinde “Türkçe baskısına rastlanmadı” de.
   - Ücretsiz kaynakların bağlantısını çalıştığını görerek ekle: `curl -s -o /dev/null -L -A 'Mozilla/5.0' -w '%{http_code}' <url>`.
   - Ödül, yıl, sayı gibi iddiaları yalnızca doğrulayabildiysen yaz. Tartışmalı kitaplarda (ör. büyük tezli popüler tarih) tartışmalı olduğunu söyle.
   - Belgedeki bulgu: popüler bilim/tarih yazarlarına ve dergilere aşinalık genel bilgiyi güçlü biçimde öngörür. Tanınmış popüler yazarları, dergileri ve iyi podcast’leri öne çıkar; her alanda Türkçe ve ücretsiz seçenekler de olsun.
4. Yaz:
   - Yeni kaynak dizinin sonuna eklenir; kimlik `<alan>-k<NN>`, sıradaki kimlikten devam eder. **Kimlikler asla değişmez ve yeniden kullanılmaz** (okuma günlüğü `guideId` ile bağlanır). Kaldırılması gereken bir kaynağı silmek yerine düzelt; ancak gerçekten yanlışsa sil, kimliğini yeniden kullanma.
   - Alanlar: `title` (Türkçe baskı adı), `author`, `original` (çeviriyse), `kind` (kitap, makale, podcast, belgesel, video, kurs, dergi, site), `level` (baslangic, orta, ileri), `lang`, `free`, `url`, `size` (“~300 sayfa”, “15 bölüm”), `why`.
   - `why`: 2–3 cümle, en çok ~400 karakter. Ne kazandırır, kimin için, neyle bağlantılı. Reklam dili değil, somut.
   - Yeni kaynağı uygun `path` adımına bağla (adımlar sırayla izlenecek bir yol haritasıdır); gerekirse yeni bir adım ekle. `updatedAt`’i bugünün tarihi yap.
   - Tipografik tırnak “ ” ve ’ kullan.
5. `npm run kontrol` — rehber hatası kalmayana kadar düzelt.
6. Kullanıcıya eklenenleri kısaca göster (alan → başlık, yazar, neden bir cümle).
7. `git -C veri add -A && git -C veri commit -m "rehber: <kısa açıklama>" && git -C veri push`

Kart yazma; bu komut yalnızca rehberi günceller. Kullanıcı bir kaynağı bitirip günlüğe eklediğinde kartları `/okuma` çıkarır.
