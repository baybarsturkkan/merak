---
name: oneri
description: Kullanıcının merak haritasına, zayıf alanlarına ve okuma günlüğüne bakarak 3 okuma ve yeni kart konuları önerir. Kullanıcı “ne okuyayım”, “ne çalışayım” dediğinde ya da /oneri yazdığında kullan.
---

# /oneri — ne okusam, ne öğrensem?

## Adımlar

1. `git -C veri pull --ff-only` ve `npm run ozet`.
2. Özetten şunları çıkar:
   - Merakı en yüksek 2–3 alan ve “en çok merak edilen son kartlar”daki konular.
   - 30 günlük hatırlaması düşük alanlar (hedefin altında).
   - Hiç ya da çok az çalışılmış alanlar (genişlik: belgeye göre geniş ve hafif öğrenmek de genel kültürü besliyor).
   - Son okumalar (aynı şeyi önerme).
3. **3 okuma öner**:
   - 2’si merakın yüksek olduğu alanlardan, 1’i keşif için az çalışılan bir alandan.
   - Somut ol: eser adı, yazar, neden bu kullanıcıya uygun (bir cümle), yaklaşık süre. Türkçesi olanları tercih et; makale/podcast gibi kısa seçenekleri de kat.
   - Belgedeki bulgu: popüler yazarlara ve dergilere aşinalık genel bilgiyi güçlü biçimde öngörüyor; tanınmış popüler bilim/tarih yazarlarını ve dergilerini öner.
   - Önce `veri/rehber/<alan>.json` rehberlerine bak: yol haritasında sıradaki ve günlükte olmayan kaynakları tercih et (günlükteki okumaların `guideId`’si rehber kimliğidir). Rehberde olmayan bir eser önerirsen, kullanıcı isterse `/rehber` ile rehbere eklenebileceğini söyle.
   - Önerdiğin eserin gerçekten var olduğundan emin değilsen WebSearch ile doğrula.
4. **3 kart konusu öner** (her biri tek satır, hangi alana gireceği ile). Kullanıcı isterse `/kart-ekle <konu>` ile yazılabileceğini söyle.
5. Kart yazma ya da veri deposunu değiştirme; bu komut yalnızca öneri verir.
