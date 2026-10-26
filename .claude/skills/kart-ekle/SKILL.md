---
name: kart-ekle
description: Bir konu hakkında 5–10 yeni Merak kartı yazar; kullanıcının merak puanlarını ve var olan kartları dikkate alır. Kullanıcı bir konuda kart istediğinde ya da /kart-ekle yazdığında kullan.
argument-hint: "<konu> [kaç kart]"
---

# /kart-ekle — konuya göre kart yaz

Konu: `$ARGUMENTS`

## Adımlar

1. `git -C veri pull --ff-only`
2. `npm run ozet` — alan merakına, etiketlere ve sıradaki kimliklere bak. Konu boşsa merakı en yüksek iki alandan ve en az çalışılan bir alandan konu öner, kullanıcıya sor.
3. İlgili alan(lar)daki var olan soruları gör: `npm run ozet -- --sorular <alan>`; aynı bilgiyi tekrar yazma.
4. Varsayılan 6 kart (kullanıcı sayı verdiyse o kadar, en çok 15). `CLAUDE.md` → “Kart yazım kuralları”na uy:
   - Her kartta 1–3 cümle bağlam, kısa cevap, “neden?” açıklaması.
   - Konuyu farklı açılardan ele al (kişi, yer, tarih, kavram, neden-sonuç); hepsi aynı kalıpta olmasın.
   - Konuda doğal olarak karıştırılan iki şey varsa en az bir “hangisi?” kartı ekle.
   - Emin olmadığın her sayıyı ya da tarihi WebSearch ile doğrula.
   - `createdBy: "claude"`, `createdAt`: şimdiki ISO zaman; kimlikler sıradaki kimlikten itibaren artar.
   - Görsel bilgi katan kartlara (eser, yapı, kişi, yer, nesne) `image` ekle: `npm run gorsel -- --ara "<arama>"` → `npm run gorsel -- "File:…"` (CLAUDE.md → kural 10). Konu görsel tanımaya uygunsa (sanat, mimari) bir kartı tanıma kartı (`show: "soru"`) yap.
5. Kartları `veri/kartlar/<alan>.json` dizisinin sonuna ekle.
6. `npm run kontrol` — temiz olana kadar düzelt. Görsel eklediysen `npm run gorsel -- --denetle`.
7. Kartları kullanıcıya göster (soru → cevap).
8. `git -C veri add -A && git -C veri commit -m "kart: <konu> (+N)" && git -C veri push`
