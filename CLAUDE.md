# Merak

Bilimsel bulgulara dayalı genel kültür uygulaması. Dayanak: “Genel Kültürü Artırmak: Bilimsel Bulgular” belgesi (hatırlama pratiği, aralıklı tekrar/FSRS, ön test, aşırı düzeltme, merak, karma çalışma, okuma günlüğü).

## Yapı

- **Uygulama** (bu depo, herkese açık): Vite + React + TypeScript, `ts-fsrs`, `zod`. GitHub Pages’e `.github/workflows/deploy.yml` ile yayınlanır: https://baybarsturkkan.github.io/merak/
- **Veri** (`veri/`, ayrı ve özel depo `baybarsturkkan/merak-veri`, bu depoda gitignore’da):
  - `veri/kartlar/<alan>.json` — kart içeriği. **Yalnızca Claude Code yazar.**
  - `veri/rehber/<alan>.json` — Rehber sekmesindeki kaynak rehberleri (alanlar + `genel`). Claude Code `/rehber` ile araştırıp yazar; şema `GuideSchema`, kaynak kimliği `<alan>-k01` asla değişmez.
  - `veri/kayit/<YYYY-MM>-<cihaz>.jsonl` — olay günlüğü. Her cihaz yalnızca kendi dosyasına ekler; Claude Code `-claude` dosyasına `npm run olay` ile yazar. Var olan satırlar asla değiştirilmez.
- FSRS durumu dosyada tutulmaz; olaylardan her yüklemede yeniden hesaplanır (`src/lib/state.ts` → `derive`).
- Tarayıcı veriye GitHub API ile erişir (`src/store/github.ts`, fine-grained token). `npm run dev` iken `veri/` klasörü bir Vite ara katmanıyla sunulur (`tools/veri-plugin.ts`), token gerekmez.

Önemli dosyalar: `src/lib/schema.ts` (kart, olay ve rehber şeması), `src/lib/guide.ts` + `src/pages/Rehber.tsx` (Rehber bölümü), `src/lib/srs.ts` (FSRS, oturum kuyruğu, merak ağırlıklı seçim), `src/lib/stats.ts`, `src/store/sync.ts` (önbellek + gönderim kuyruğu), `src/pages/Calisma.tsx` (çalışma akışı).

## Komutlar

```
npm run dev       # yerel geliştirme (veri/ klasörüyle)
npm test          # birim testleri
npm run build     # tip kontrolü + üretim derlemesi
npm run kontrol   # veri/kartlar ve veri/rehber şema ve yineleme denetimi — kart ya da rehber yazdıktan sonra ŞART
npm run ozet      # merak, alanlar, bekleyen okumalar, hatalı kartlar, sıradaki kimlikler
npm run ozet -- --sorular <alan|hepsi>   # var olan sorular (yinelemeyi önlemek için)
npm run olay -- '<json>'                 # olay günlüğüne kayıt (okuma, isaret-cozuldu…)
```

Claude Code komutları (`.claude/skills/`): `/kart-ekle`, `/okuma`, `/hangisi`, `/oneri`, `/kart-duzelt`, `/rehber`.

## Kart şeması

```json
{
  "id": "tarih-0019",
  "type": "soru",
  "domain": "tarih",
  "tags": ["osmanli", "reform"],
  "context": "1–3 cümlelik bağlam; cevabı ele vermez.",
  "question": "Tek bir şeyi soran soru?",
  "answer": "Kısa cevap",
  "accept": ["kabul edilen", "başka yazımlar"],
  "why": "Neden doğru ya da neden önemli; bildiklerine bağlayan 1–3 cümle.",
  "source": { "readingId": "okuma-…", "ref": "Yazar, Eser" },
  "createdAt": "2026-10-26T12:00:00.000Z",
  "createdBy": "claude"
}
```

- `type: "hangisi"` kartlarında `options` (2–4 seçenek) zorunlu ve `answer` bunlardan biri olmalı; `accept` kullanılmaz.
- `id` = `<alan>-<4 hane>`; sıradaki kimliği `npm run ozet` ya da `npm run kontrol` gösterir. Kimlik **asla değişmez ve yeniden kullanılmaz** (tekrar geçmişi kimliğe bağlıdır).
- Alanlar: `tarih, siyaset-toplum, bilim, teknoloji, sanat, edebiyat, muzik-sinema, cografya, felsefe, ekonomi`.
- Dosya, 2 boşluk girintili bir JSON dizisidir; yeni kartlar dizinin sonuna eklenir.

## Kart yazım kuralları (belgedeki bulgulardan)

1. **Hatırlanabilir tek bilgi.** Soru tek bir şeyi sorar; cevap birkaç kelimedir (60 karakteri aşmasın). Liste sorma (“7 harikayı say”). Yaygın yazım farkları ve eş anlamlar için `accept` ekle.
2. **Bağlam şart** (metin pasajlarında test etkisi daha büyük): `context` 1–3 cümle; durumu kurar ama cevabı söylemez. Tek kelimelik, bağlamsız ezber kartı yazma.
3. **“Neden?” şart** (ayrıntılandırıcı sorgulama, kendine açıklama): `why` bilginin neden doğru ya da önemli olduğunu ve başka bir bilgiye bağlantısını anlatır. Cevabı yalnızca tekrarlamaz.
4. **Merak uyandır.** Şaşırtıcı, bağlantı kuran, “bunu bilmiyordum” dedirten bilgileri seç. `npm run ozet`’teki merak tablosunda yüksek alanlara öncelik ver, ama genişlik için diğer alanları da ihmal etme.
5. **Karıştırılanlar için “hangisi?”** (karma çalışma benzer kategorilerde işe yarar): benzer sanat akımları, yakın dönemler, benzer kavramlar.
6. **Doğruluk.** Yalnızca iyi bilinen, doğrulanabilir bilgiler. Emin değilsen WebSearch ile doğrula ya da yazma. Sayılarda “yaklaşık” kullan. Tartışmalı konularda tartışmalı olduğunu söyle ya da kartı yazma.
7. **Okumadan kart:** her okumadan 2–3 kart; `source.readingId` okuma kimliğini, `source.ref` “Yazar, Eser”i taşır.
8. Türkçe, doğal ve sade dil; tipografik tırnak “ ” kullan (JSON içinde " kaçırmak zorunda kalma).
9. Kullanıcının bildiği kartlar silinmez. Hatalı kart, kimliği korunarak yerinde düzeltilir.

## Her kart yazımından sonra

1. `npm run kontrol` — hata kalmayana kadar düzelt.
2. Yeni kartları kullanıcıya kısaca göster (soru → cevap).
3. Veri deposunu gönder:
   ```
   git -C veri add -A
   git -C veri commit -m "kart: <kısa açıklama>"
   git -C veri push
   ```
   Uygulama bir sonraki açılışta ya da yenilemede yeni kartları çeker.

## Kod değişikliklerinde

- `npm test` ve `npm run build` geçmeli. Uygulama deposuna push GitHub Pages’i yeniden yayınlar.
- Olay biçimini değiştirme; eski olaylar okunabilir kalmalı (yalnızca isteğe bağlı alan eklenebilir).
