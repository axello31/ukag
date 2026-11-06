# ÜKAG — Ümraniye Kan Gazı

Acil tıp hekimleri için arter / ven kan gazı yorumlama hesaplayıcısı ve yardımcısı.

- Önce örnek tipi (arter / ven) seçilir; tüm değişkenler isteğe bağlıdır, eldeki verilerle yorum yapılır ve eksik veriler listelenir.
- Sistematik okuma: oksijenasyon → ventilasyon → asit-baz (primer bozukluk, kompansasyon, anyon açığı, delta oranı) → ileri değerlendirme (osmolar açık, idrar AA, idrar Cl⁻, DKA kriterleri).
- Her bozukluk için tıklanınca açılan "olası nedenler" ekranı (hastanın verilerine göre öne çıkanlarla).
- Her hesaplamada "Nasıl hesaplandı?" kutusu: formül, bu hastadaki değerler, kaynak.
- Birim değiştiriciler (mmHg/kPa, g/dL/g/L, mg/dL/mmol/L, üre/BUN…).
- `?vaka=1..6` ile sunumdaki vakalar doğrudan açılır.
- **Fotoğraftan oku:** lab ekranı / cihaz çıktısının bir veya birkaç fotoğrafından değerler okunur (Tesseract.js, tamamen cihazda — görüntü sunucuya gitmez). Bulunan değerler forma aktarılmadan önce kontrol listesinde gösterilir; aktarılan alanlar sarı çerçeveyle işaretlenir. Ayıklama kuralları `src/ocr.ts` içinde.

İçerik: Dr. Gökhan Aksel, "Kan Gazı Yorumlama" sunumu; eksikler hakemli literatürden tamamlanmıştır (uygulamada Bilgi → Kanıt ve kaynaklar).

> Klinik karar destek aracıdır; hekim yargısının yerini tutmaz.

## Geliştirme

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # hesap motoru testleri (sunum vakaları dahil)
npm run build   # dist/
```

Hesap mantığı `src/engine.ts` içinde, arayüzden bağımsızdır.
