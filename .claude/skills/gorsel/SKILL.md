---
name: gorsel
description: Görselsiz Merak kartlarını tarar, görselin bilgi katacağı kartlara Wikimedia Commons’tan görsel ekler; istenirse görselden tanıma kartları yazar. Kullanıcı /gorsel yazdığında, kartlara resim/fotoğraf/görsel eklenmesini istediğinde kullan.
argument-hint: "[alan | kart kimliği] [tanıma]"
---

# /gorsel — kartlara görsel ekle

Görsel, sözel bilgiyle birlikte ikinci bir hafıza izi bırakır (ikili kodlama) ve eser, yapı, yer gibi konularda tanımanın kendisi bilgidir. Ama her karta görsel gerekmez: soyut kavramlara süs görseli koymak dikkati dağıtır.

Argüman: `$ARGUMENTS` (boşsa tüm alanlar; `tanıma` geçerse ayrıca yeni tanıma kartları yaz)

## Adımlar

1. `git -C veri pull --ff-only`
2. `npm run gorsel -- --eksik [alan]` — görselsiz kartları listele.
3. Her kart için karar ver (CLAUDE.md → kural 10):
   - **Ekle:** eser (tablo, heykel, yapı), kişi portresi, yer (göl, boğaz, dağ; uydu görüntüsü de olur), tarihi belge ya da nesne (Magna Carta, Sputnik), bilimsel görüntü (Jüpiter, mitokondri).
   - **Ekleme:** soyut kavramlar (faydacılık, tekel), sayılar ve tarihler; uygun özgür görsel yoksa (ör. Picasso, Dalí gibi telifi süren eserler Commons’ta bulunmaz) zorlama.
4. Görseli bul: `npm run gorsel -- --ara "<İngilizce arama>"` → en iyisini seç (net, büyük, konunun kendisi; pul, kopya, kırpılmış ayrıntı değil) → `npm run gorsel -- "File:…"` çıktısındaki `image` nesnesini karta ekle. Yazar bilgisi karışıksa `--yazar "<ad>"`.
5. `alt`’ı yaz: görselin ne gösterdiğini 1 cümleyle anlat. `show`:
   - `cevap` (varsayılan): cevaptan sonra destek.
   - `soru`: yalnızca soru görsele değiniyorsa (“Bu caminin adı nedir?”) ve bağlam görsel olmadan da kartı anlamlı kılıyorsa. `alt` ve `context` cevabı söylemesin.
6. **Kimlik, soru ve cevap değişmez** (tekrar geçmişi kimliğe bağlı). Var olan bir kartı tanıma kartına çevirmek için soruyu değiştirme; yeni kart yaz.
7. `tanıma` istendiyse ya da alan görsel tanımaya çok uygunsa: var olan kartların bilgisini yinelemeyen yeni tanıma kartları yaz (`npm run ozet -- --sorular <alan>` ile kontrol et), sıradaki kimliklerle, `show: "soru"`.
8. `npm run kontrol` ve `npm run gorsel -- --denetle` — temiz olana kadar düzelt.
9. Kullanıcıya kısa liste: hangi kartlara ne görseli eklendi, hangi tanıma kartları yazıldı (soru → cevap).
10. `git -C veri add -A && git -C veri commit -m "kart: görseller (<alan>, +N)" && git -C veri push`
