# PixelPath mimarisi

PixelPath, ürün mantığını masaüstü kabuğundan ayıran modüler bir yapıya sahiptir.

## Katmanlar

- `frontend/src/design/tokens.css`: renk, boşluk, ölçü, radius, gölge ve animasyonların tek kaynağıdır. Açık/koyu tema semantik değişkenlerle tanımlanır.
- `frontend/src/components/ui`: drawer, switch, kayan sekme, select, tooltip, toast, splash, dil seçici ve güncelleme merkezi gibi ortak bileşenlerdir.
- `frontend/src/components/layout`: sidebar ve topbar uygulama kabuğudur.
- `frontend/src/i18n.js`: TR/EN arayüz metinlerinin kaynağıdır.
- `frontend/src/Viewer3D.jsx`: Three.js sahnesi, instanced mesh ve kamera davranışıdır. Küp ve dikdörtgen prizma geometrilerini gösterir.
- `frontend/src/App.jsx`: veri akışı, model işlemleri ve ekran kompozisyonudur.
- `backend/app.py`: yalnızca localhost üzerinde çalışan HTTP API ve kalıcı veri katmanıdır.
- `backend/engine.py`: schematic okuma, sadeleştirme, eski küp/prizma motorları ve ortak montaj ağıdır.
- `backend/hybrid.py`: görsel voxel katmanını fiziksel modüllerden ayıran, renk/detay ağırlıklı deterministik bölümleme motorudur.
- `backend/mesh.py`: fiziksel modüllerden kapalı yüzey çıkarır, manifold kontrolü yapar ve gerçek binary STL üretir.
- `electron/`: güvenli preload köprüsü, Python süreç yönetimi, pencere yaşam döngüsü ve otomatik güncelleme katmanıdır.
- `web/`: Vite üretim çıktısıdır; kaynak değildir ve Git'e eklenmez.

## Tasarım kuralları

- Yeni renk, boşluk veya radius doğrudan bileşene yazılmaz; önce tasarım tokenı tanımlanır.
- Yeni ortak kontrol `components/ui` altında geliştirilir.
- Kayan seçim davranışı için ortak `TabSwitch` kullanılır.
- Arayüz nötr siyah-beyaz tonlardadır. Yeşil yalnızca 3D sahnede o anda eklenecek parçayı belirtir.
- Hareketlerde ortak süre/easing tokenları kullanılır ve `prefers-reduced-motion` korunur.
- Tema, dil ve kamera tercihleri `pixelpath.*` anahtarlarıyla yerel olarak saklanır.
- Renderer doğrudan Node.js erişimi almaz; Electron işlevleri yalnızca dar preload API'si üzerinden sunulur.

## Yerel veri ve paketleme

Geliştirmede Electron, `backend/app.py` sürecini boş bir localhost portunda başlatır. Paketli sürüm aynı API'yi PyInstaller çıktısından çalıştırır. React çıktısı Python paketine gömülür; Electron yalnızca pencereyi ve işletim sistemi entegrasyonlarını yönetir.

## Hibrit üretim hattı

Hibrit mod, her kaynak voxel'i tam olarak bir yüzey-bağlantılı fiziksel modüle atar. Hedef parça sayısı ve optimizasyon önceliği kullanıcı ayarıdır. Dijital voxel birleşiminde kenar sıkışması oluşturan gruplar STL'den önce manifold alt gruplara ayrılır; bu nedenle gerçek parça sayısı istenen hedeften sapabilir ancak seçilen min–maks aralığı için uyarı üretilir.

`production.zip` şu anda yerel orijine taşınmış solid binary STL'ler, `manifest.json` ve `geometry-validation.json` içerir. Hollow ve bağlantı geometrileri henüz üretilmez; manifest bunları açıkça `not_generated` ve `physically_validated: false` olarak işaretler. Dijital manifold testi fiziksel baskı, tolerans veya dayanım doğrulaması değildir.

## Doğrulama ve yayın

```powershell
npm run format:check
npm test
npm run dist:win
```

- `.github/workflows/tests.yml`: push ve pull requestlerde biçim, üretim derlemesi ve entegrasyon testleri.
- `.github/workflows/release.yml`: `v*` etiketlerinde Windows installer, blok haritası ve güncelleme manifestlerini GitHub Releases'a yayınlar.
