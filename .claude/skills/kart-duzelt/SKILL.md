---
name: kart-duzelt
description: Uygulamada “Hata bildir” ile işaretlenen Merak kartlarını inceler, doğrular ve yerinde düzeltir; ardından işareti kaldırır. Kullanıcı /kart-duzelt yazdığında ya da bir kartın yanlış olduğunu söylediğinde kullan.
argument-hint: "[kart kimliği]"
---

# /kart-duzelt — hatalı kartları düzelt

Argüman (isteğe bağlı kart kimliği): `$ARGUMENTS`

## Adımlar

1. `git -C veri pull --ff-only` ve `npm run ozet` → “Hatalı işaretli kartlar” bölümü. Argüman verildiyse yalnızca o kartla ilgilen.
2. Her kart için:
   - Kullanıcının notunu ve kartın tüm alanlarını (`veri/kartlar/<alan>.json`) oku.
   - İddiayı doğrula (gerekirse WebSearch). Kart gerçekten yanlışsa ya da belirsizse düzelt; doğruysa kullanıcıya kaynağıyla birlikte neden doğru olduğunu açıkla.
   - **Kimliği (`id`) asla değiştirme**; tekrar geçmişi kimliğe bağlı. Yalnızca içerik alanlarını düzenle. Yanıltıcıysa `accept` ekleyebilir, bağlamı netleştirebilirsin.
   - Not görselle ilgiliyse (yanlış eser, açılmıyor, cevabı ele veriyor) görseli `npm run gorsel` ile yenisiyle değiştir ya da `image` alanını kaldır; `npm run gorsel -- --denetle` ile doğrula.
   - Kart kurtarılamayacak kadar kötüyse silme; kullanıcıya sor ve gerekirse uygulamada askıya almasını öner.
3. Düzeltilen (ya da doğru olduğu açıklanan) her kart için işareti kaldır:
   ```
   npm run olay -- '{"type":"isaret-cozuldu","cardId":"tarih-0003","note":"<ne yapıldı>"}'
   ```
4. `npm run kontrol`
5. Kullanıcıya her kart için önce/sonra özetini göster.
6. `git -C veri add -A && git -C veri commit -m "düzeltme: <kimlikler>" && git -C veri push`
