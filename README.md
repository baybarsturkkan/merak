# Merak

Bilimsel bulgulara dayalı, ücretsiz bir genel kültür uygulaması. Telefonda ve bilgisayarda çalışır, cihazlar arasında senkron olur, çevrimdışı da açılır.

**Uygulama:** https://baybarsturkkan.github.io/merak/

## Neye dayanıyor?

“Genel Kültürü Artırmak: Bilimsel Bulgular” belgesindeki bulgular birebir özelliğe dönüştürüldü:

| Bulgu | Uygulamada |
|---|---|
| Kendini test etmek yeniden okumaktan iyi | Cevabı görmeden önce yazıyor ya da aklından söylüyorsun |
| Bildiğini desteden atmak zararlı | Kart silinmez; FSRS onu giderek seyrekleştirir |
| Tekrarlar aylara yayılmalı | FSRS aralıklı tekrar, hedef %90 hatırlama |
| Metin pasajlarında etki daha büyük | Her kartta 1–3 cümlelik bağlam ve “Neden?” alanı |
| Ön test etkisi | Yeni kartı görmeden önce tahmin ediyorsun |
| Aşırı düzeltme | Cevaptan önce güven puanı; emin olduğun hatalar vurgulanır ve erken tekrar edilir |
| Merak hafızayı güçlendirir | Merak puanı veriyorsun; yeni kartlar merakına göre seçilir |
| Okuma miktarı en güçlü öngörücü | Okuma günlüğü; her okumadan Claude Code 2–3 kart çıkarır |
| Karma çalışma benzer kategorilerde işe yarar | Alanlar karışık gelir; karıştırılanlar için “hangisi?” kartları |
| “Biliyorum” hissi güvenilmez | İstatistikte gerçek hatırlama oranı ve güven–doğruluk grafiği |

## Nasıl çalışıyor?

```
merak        (herkese açık depo)  uygulama kodu → GitHub Pages
merak-veri   (özel depo)          kartlar/  ve  kayit/  (tekrar geçmişi, okumalar)
```

- Uygulama verilerini özel `merak-veri` deposundan GitHub API ile okur ve yazar. Başka sunucu yok, ücret yok.
- Her cihaz kendi kayıt dosyasına yazar; çakışma olmaz. İlerleme (FSRS durumu) bu kayıtlardan hesaplanır.
- Kartları Claude Code yazar ve `merak-veri`’ye gönderir; uygulama bir sonraki açılışta çeker.

## Bir cihazı bağlamak (bir kez)

1. GitHub’da [yeni fine-grained token](https://github.com/settings/personal-access-tokens/new) oluştur:
   - **Repository access:** Only select repositories → `merak-veri`
   - **Permissions → Contents:** Read and write
2. Uygulamayı aç, token’ı Ayarlar ekranına yapıştır, cihaza bir ad ver (ör. telefon).
3. Telefonda: Safari’de Paylaş → “Ana Ekrana Ekle”; Android Chrome’da ⋮ → “Uygulamayı yükle”.

Token yalnızca o tarayıcıda saklanır ve yalnızca api.github.com’a gönderilir. Cihaz kaybolursa token’ı GitHub’dan sil.

## Claude Code ile kart üretmek

Bu klasörde Claude Code’u aç:

| Komut | Ne yapar |
|---|---|
| `/okuma [başlık, bağlantı ya da not]` | Okumayı günlüğe ekler, 2–3 kart çıkarır. Boş bırakırsan uygulamada eklediğin okumaları işler. |
| `/kart-ekle <konu>` | Bir konuda 5–10 kart yazar. |
| `/hangisi [çift]` | Karıştırdığın kavramlar için seçenekli kartlar yazar. |
| `/oneri` | Merakına göre 3 okuma ve kart konusu önerir. |
| `/kart-duzelt` | Uygulamada “Hatalı mı?” ile işaretlediğin kartları düzeltir. |

## Geliştirme

```
npm install
git clone https://github.com/baybarsturkkan/merak-veri veri
npm run dev        # http://localhost:5173 — yerel veri/ klasörüyle, token gerekmez
npm test
npm run kontrol    # kart dosyalarını denetler
npm run ozet       # merak, bekleyen okumalar, hatalı kartlar
```

`main` dalına her push, GitHub Actions ile uygulamayı yeniden yayınlar.
