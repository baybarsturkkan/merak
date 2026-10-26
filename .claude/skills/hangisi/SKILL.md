---
name: hangisi
description: Kolay karıştırılan kavram, dönem ya da kişiler için “hangisi?” (seçenekli) Merak kartları yazar. Argümansız çalışırsa kullanıcının emin olup yanıldığı kartlardan ve desteden aday çiftler bulur.
argument-hint: "[kavram çifti, ör. Rönesans / Barok]"
---

# /hangisi — karıştırılanları ayırt et

Belgeye göre karma çalışma, **kategoriler birbirine benzediğinde** güçleniyor: kolay karıştırılan şeyleri yan yana ayırt etmeye çalışmak. Bu komut tam olarak bunu yapan kartlar üretir.

Argüman: `$ARGUMENTS`

## Adımlar

1. `git -C veri pull --ff-only`
2. **Argüman varsa**: verilen çift/küme için 2–4 kart yaz. Her kart, kavramlardan birini ayırt ettiren tek bir özelliği sorar; kartlar arasında doğru cevap değişsin (hep aynı seçenek doğru olmasın).
3. **Argüman yoksa**: `npm run ozet` çalıştır.
   - “Emin olup yanıldıkları” bölümünde kullanıcının yazdığı yanlış cevap ile doğru cevap genellikle karıştırılan bir çifttir (ör. “Wright kardeşler” ↔ “Lumière kardeşler”).
   - `npm run ozet -- --sorular hepsi` ile destede birbirine benzeyen kavramları ara (yakın dönemler, benzer akımlar, aynı alandaki benzer kişiler).
   - En iyi 3–5 çifti kullanıcıya öner, seçtiklerinden kart yaz.
4. Kart biçimi (`CLAUDE.md` kurallarına ek olarak):
   ```json
   {
     "type": "hangisi",
     "context": "İki kavramı kısaca tanıtan, ikisini de anan 1–3 cümle.",
     "question": "Ayırt edici özelliği soran soru?",
     "options": ["Seçenek A", "Seçenek B"],
     "answer": "Seçenek B",
     "why": "Farkı akılda tutturan kısa açıklama; mümkünse bir hafıza ipucu (ör. kelime kökü)."
   }
   ```
   Seçenekler 2–4 tane, `answer` birebir seçeneklerden biri; `accept` kullanma.
5. `npm run kontrol` → kullanıcıya göster → `git -C veri add -A && git -C veri commit -m "hangisi: <çift>" && git -C veri push`
