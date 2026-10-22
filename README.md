# Universal Link Resolver

Demo Node.js untuk:
- Memeriksa URL HTTP/HTTPS.
- Mengikuti redirect HTTP biasa dengan batas 5 hop.
- Mengenali domain LootLabs, loot-link.com, SFL.gl, dan Linkvertise.
- Menolak alamat lokal/nonpublik untuk mengurangi risiko SSRF.
- Tidak melewati tugas iklan, CAPTCHA, login, token, atau mekanisme proteksi penyedia.

## Jalankan lokal
Memerlukan Node.js 20 atau lebih baru.

```bash
npm install
npm start
```

Buka `http://localhost:3000`.

## Deploy ke Render
1. Buat repository GitHub dan unggah semua file proyek ini.
2. Di Render, pilih **New + → Web Service** dan hubungkan repository.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Deploy. Render menyediakan URL HTTPS setelah deployment selesai.

Alternatif: hosting Node.js lain yang mendukung aplikasi Express dan variabel `PORT`.

## Batasan
- Link monetisasi yang dikenal hanya dideteksi; halaman tugas iklan tidak dilewati.
- Sebagian server menolak permintaan otomatis, memerlukan cookie, atau memakai JavaScript. Hasilnya dapat berupa `could-not-check`.
- Redirect checker sederhana ini bukan layanan keamanan/antivirus dan tidak menjamin URL aman.
- Untuk produksi, pertimbangkan egress firewall, timeout yang ketat, logging minimal, dan perlindungan DNS rebinding di tingkat jaringan.
