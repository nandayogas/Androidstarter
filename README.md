# Launcher HP (Android)

Versi Android dari Launcher PC. Tampilan memakai WebView, daftar aplikasi diambil dari aplikasi yang terpasang di HP.

- Ketuk ikon: buka aplikasi. Tahan lama: menu (dock, ubah nama/kategori, info, copot, sembunyikan).
- Pertama kali dibuka, semua aplikasi diimpor otomatis.
- Pengaturan > "Jadikan launcher utama" untuk memakainya sebagai layar utama.
- Data tersimpan di penyimpanan internal aplikasi (launcher-data.json).

Build: `gradle assembleDebug` (JDK 17, Android SDK 34). Hasil: app/build/outputs/apk/debug/app-debug.apk
