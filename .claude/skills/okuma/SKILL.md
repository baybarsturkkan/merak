---
name: okuma
description: Okuma günlüğüne bir okuma (kitap, makale, podcast, belgesel) ekler ve ondan 2–3 Merak kartı çıkarır. Argümansız çalışırsa uygulamada eklenip kart bekleyen okumaları işler. Kullanıcı okuduğu bir şeyden bahsettiğinde ya da /okuma yazdığında kullan.
argument-hint: "[başlık | bağlantı | notlar]"
---

# /okuma — okumadan kart çıkar

Belgeye göre genel kültürün değiştirilebilir en güçlü öngörücüsü **okuma miktarı**; okunanı kalıcı yapan ise **hatırlama pratiği**. Bu komut ikisini birleştirir: her okumadan 2–3 kart.

Argüman: `$ARGUMENTS`

## Adımlar

1. Veriyi güncelle: `git -C veri pull --ff-only` (hata verirse kullanıcıya söyle, devam etme).
2. `npm run ozet` çalıştır. “Kart bekleyen okumalar” bölümüne ve alanlardaki merak tablosuna bak.
3. **Argüman varsa** (yeni bir okuma):
   - Bağlantıysa WebFetch ile sayfayı oku ve ana fikirleri çıkar. Değilse argümanı başlık/not olarak al.
   - Notlar azsa kullanıcıya kısa iki soru sor: “En çok ne ilgini çekti?” ve “Seni ne şaşırttı?” Merak ve şaşırma hafızayı güçlendirir; kartları bu cevaplara dayandır.
   - Okumayı günlüğe ekle (kimlik: `okuma-<kısa-slug>-<4 rastgele hane>`, tarih: bugün):
     ```
     npm run olay -- '{"type":"okuma","reading":{"id":"okuma-kozmos-4821","title":"Kozmos","author":"Carl Sagan","kind":"kitap","date":"2026-10-26","notes":"…","url":"…"}}'
     ```
     `kind`: kitap | makale | podcast | belgesel | video | diger.
   - **Argüman yoksa**: özetteki her bekleyen okuma için aşağıdaki kart adımını uygula (notlar ve varsa bağlantı üzerinden). Çok sayıda bekleyen varsa önce kullanıcıya hangilerini işleyeceğini sor.
4. Her okuma için **2–3 kart** yaz (`CLAUDE.md` → “Kart yazım kuralları”):
   - Okumanın en şaşırtıcı ve en bağlantılı bilgilerini seç; okumanın özeti değil, hatırlanmaya değer tekil bilgiler.
   - Uygun alanı seç; kimliği özetteki “Sıradaki kimlik” sütunundan al.
   - `source`: `{ "readingId": "<okuma kimliği>", "ref": "<Yazar>, <Eser>" }`, `createdBy: "claude"`, `createdAt`: şimdiki ISO zaman.
   - Yinelemeyi önlemek için gerekirse `npm run ozet -- --sorular <alan>`.
   - Okumada karıştırılabilecek iki kavram varsa bir kartı “hangisi?” yap.
   - Kartları `veri/kartlar/<alan>.json` dizisinin sonuna ekle.
5. `npm run kontrol` — hata kalmayana kadar düzelt.
6. Kullanıcıya kartları göster (soru → cevap, alan).
7. Gönder:
   ```
   git -C veri add -A
   git -C veri commit -m "okuma: <başlık> (+N kart)"
   git -C veri push
   ```
8. Kısa kapanış: kaç kart eklendi; uygulama yenilenince “Yeni kart” olarak gelecekler ve okumadan çıkan kartlar yeni kart sırasında öne alınır.
