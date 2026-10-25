# PixelPath

PixelPath, voxel modellerini fiziksel montaj için adım adım parça planlarına dönüştüren yerel bir masaüstü uygulamasıdır. React + Three.js arayüzü Electron içinde çalışır; Python motoru `.schem` verisini işler ve bütün veriler bilgisayarda tutulur.

## Hızlı başlangıç

Windows'ta `start.bat` dosyasına çift tıklayın. İlk çalıştırmada Node.js bağımlılıkları kurulur; ardından React arayüzü derlenir ve PixelPath masaüstü penceresi açılır. Geliştirme için Node.js LTS ve Python 3.11+ gerekir.

```powershell
npm install
npm run electron:dev
```

İlk açılışta örnek Fluttershy modeli eklenir. Kütüphane `%LOCALAPPDATA%\PixelPath\models` altında saklandığından uygulama güncellense de modeller korunur.

## Parça algoritmaları

- **Küpler:** Modeli en büyük uygun küplerden başlayarak böler.
- **En büyük prizmalar:** Küpleri de geçerli bir dikdörtgen prizma kabul eder; her adımda altı büyüme yönünü karşılaştırıp aynı renkteki en büyük hacmi seçer. Böylece model, küp moduna göre genellikle çok daha az parçayla üretilir.
- **Hibrit fiziksel modüller:** Görsel voxel'leri korurken modeli hedeflenen fiziksel parça aralığına böler. Detay, maliyet, montaj veya dengeli öncelik seçilebilir; her voxel yalnızca bir bağlantılı modüle atanır.

Prizma modu en büyük parçaları kullanan deterministik bir sezgiseldir; bütün olası 3B bölmeleri tüketerek matematiksel global minimum garantisi vermez. Montaj sırası yüzey temasına göre hesaplanır; fiziksel denge ve el erişimi için önce küçük bir deneme yapılması önerilir.

Malzemeler ekranındaki üretim ZIP'i her parça için gerçek binary STL ile manifest ve dijital geometri kontrol raporu oluşturur. Mevcut STL'ler solid voxel birleşimleridir. Hollow ve bağlantı üretimi henüz tamamlanmadığından paket bunları doğrulanmış gibi göstermez; fiziksel baskı/tolerans testi ayrıca yapılmalıdır.

## Geliştirme ve doğrulama

```powershell
npm run dev          # Yalnızca Vite arayüzü
npm test             # Electron söz dizimi, React üretim derlemesi ve API testleri
npm run dist:win     # Yerel NSIS installer
```

Kaynak mimarisi ve ortak tasarım sistemi [docs/architecture.md](docs/architecture.md) içinde açıklanır.

## Yayın ve otomatik güncelleme

`v*` biçimindeki bir Git etiketi GitHub Actions yayın akışını başlatır. Akış Python motorunu tek dosyalık Windows uygulaması olarak paketler, PixelPath installer'ını ve güncelleme manifestlerini GitHub Releases'a yükler.

```powershell
git tag v0.1.0
git push origin v0.1.0
```

Kurulu uygulama yeni sürümü arka planda denetler; indirme ilerlemesini arayüzde gösterir ve hazır olduğunda kullanıcıdan yeniden başlatma onayı ister. Üretim dağıtımında Windows SmartScreen güveni için ayrıca kod imzalama sertifikası yapılandırılmalıdır.

## Veri güvenliği

Model dosyaları ve ilerleme bilgisi yerel kullanıcı klasöründe kalır. Kaldırma işlemi uygulama verisini otomatik silmez.
