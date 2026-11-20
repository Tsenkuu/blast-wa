# WA BLAST MANAGER PRO 🚀

> **Dashboard Pengelolaan & Otomatisasi WhatsApp Bot Profesional berbasis Baileys, Sistem Broadcast Excel, Personalisasi Pesan Dinamis, Antrean Background Worker Persisten, Live Monitoring Real-Time, dan Pengendali WhatsApp Admin Pribadi.**

---

## 🌟 Daftar Fitur Utama

1. **Dashboard Statistik SaaS Premium**:
   - Status koneksi WhatsApp & nomor akun aktif real-time.
   - 10 Kartu Metrik: Total kontak, pesan antre, terkirim, gagal, dilewati, broadcast berjalan, broadcast dijeda, RAM, CPU, dan uptime server.
   - Grafik interaktif Recharts aktivitas pengiriman harian (berhasil vs gagal).
   - Tabel riwayat broadcast terbaru dengan bilah progres dinamis.

2. **Koneksi WhatsApp Baileys Modern**:
   - Pemindaian QR Code WhatsApp langsung pada dashboard via Socket.IO streaming.
   - Menggunakan library `@whiskeysockets/baileys` terbaru dengan *Multi-File Auth State*.
   - Status koneksi lengkap: `connecting`, `connected`, `disconnected`, dan `logged_out`.
   - Reconnect otomatis saat gangguan jaringan sementara (tidak reconnect jika status sudah `logged_out`).
   - Kontrol manual: Hubungkan, Putuskan, Restart, dan Logout Sesi.

3. **Upload & Pengolahan Excel Fleksibel**:
   - Mendukung format `.xlsx` dan `.xls`.
   - Format standar: Kolom A (Nomor WhatsApp), Kolom B (Nama), Kolom C (Keterangan), serta kolom tambahan tak terbatas (D, E, F...).
   - Validasi nomor otomatis dan konversi format Indonesia (`08xx` & `+62xx` menjadi `628xx`).
   - Deteksi nomor duplikat dan baris tidak valid secara instan dengan pratinjau sebelum disimpan.
   - Pemetaan kolom dinamis (*Column Mapping*).
   - Sistem persetujuan (*Consent Management*) dan daftar blokir (*Opt-Out*).

4. **Mesin Variabel Template Dinamis**:
   - Mendukung placeholder huruf kolom: `{{A}}`, `{{B}}`, `{{C}}`, `{{D}}`...
   - Mendukung alias nama kolom: `{{nama}}`, `{{nomor}}`, `{{keterangan}}` (case-insensitive).
   - Pratinjau pesan real-time dengan data nyata baris penerima pertama.
   - Peringatan dini jika ada variabel template yang tidak ditemukan pada dataset Excel.
   - Dukungan penuh untuk Unicode, emoji 🎉, dan karakter baris baru (`\n`).

5. **Broadcast Queue Worker & Pengiriman Bertanggung Jawab**:
   - Antrean persisten berbasis database (dijalankan oleh backend worker independen).
   - Status pekerjaan: `draft`, `queued`, `running`, `paused`, `completed`, `cancelled`, `failed`.
   - Status penerima: `pending`, `processing`, `sent`, `failed`, `skipped`.
   - Kontrol penuh: Mulai, Jeda (menyelesaikan pesan in-flight sebelum jeda), Lanjutkan, dan Batalkan.
   - Pemulihan server restart: pesan berstatus `processing` dipulihkan kembali ke antrean secara aman.
   - Pencegahan pengiriman ganda melalui *Idempotency Key* unik per penerima.
   - **Circuit Breaker**: Broadcast dijeda otomatis jika terjadi 5 kegagalan berturut-turut.
   - Jeda acak antar pesan (3000ms - 6000ms) untuk kepatuhan regulasi WhatsApp.
   - **Tombol Darurat (Emergency Stop)**: Menghentikan seketika seluruh antrean jika diperlukan.

6. **Live Monitoring Real-Time**:
   - Bilah progres animasi bergerak sesuai data pengiriman aktual via Socket.IO.
   - Estimasi sisa waktu selesai (ETA) berdasarkan throughput riil.
   - Filter penerima berdasarkan status: Berhasil, Gagal, Dilewati, Menunggu.
   - Fitur pencarian kontak dan tombol ekspor laporan pengiriman ke file CSV/Excel.

7. **Pengendali WhatsApp Admin (Private Chat Controller)**:
   - Mengendalikan bot secara aman melalui chat pribadi (1-on-1 DM) dengan nomor WhatsApp admin terdaftar.
   - Perintah dari nomor tidak dikenal atau grup ditolak secara otomatis.
   - Perintah yang didukung:
     - `!menu` : Melihat daftar perintah.
     - `!status` : Memeriksa status bot, koneksi WA, RAM, uptime, dan antrean.
     - `!excel list` : Melihat daftar dataset Excel yang tersimpan.
     - `!blast list` : Melihat broadcast aktif dan riwayat.
     - `!blast status <ID>` : Melihat progres broadcast tertentu.
     - `!blast jeda <ID>` : Menjeda pengiriman broadcast.
     - `!blast lanjut <ID>` : Melanjutkan pengiriman broadcast.
     - `!blast batal <ID>` : Membatalkan broadcast.
   - **Upload Excel langsung via WhatsApp**:
     - Admin mengirim file Excel dengan caption: `!excel simpan "Nama Dataset"`
     - Bot memproses dan membalas ringkasan validasi (total baris, nomor valid, nomor tidak valid).
   - **Pembuatan Broadcast Langsung via WhatsApp**:
     - Mode Interaktif: `!blast buat "Nama Dataset"` -> kirim pesan -> kirim gambar / `!tanpagambar` -> Bot membalas ringkasan dan pratinjau -> Admin membalas `!blast konfirmasi <KODE>` untuk memulai.
     - Mode Cepat (One-Liner): `!blast buat "Nama Dataset" | Halo {{nama}}, berikut undangan Anda.` (dengan lampiran gambar opsional).
   - Notifikasi otomatis ke WhatsApp Admin pada event penting: koneksi terhubung/putus, Excel tersimpan, broadcast dimulai, dijeda, selesai, atau error.

8. **Terminal & Live Streaming Logs**:
   - Tampilan terminal Linux gelap (*JetBrains Mono*).
   - Streaming log aplikasi langsung via Socket.IO dengan filter `INFO`, `WARNING`, `ERROR`, `SUCCESS`.
   - Unduh file log, cari riwayat log, dan bersihkan tampilan.
   - Tombol restart koneksi WhatsApp dan restart antrean worker langsung dari konsol.
   - Proteksi keamanan: tidak membocorkan password, token sesi, atau data sensitif.

---

## 🛠️ Technology Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons, Recharts, Socket.IO Client |
| **Backend** | Node.js, TypeScript, Express.js, Socket.IO, `@whiskeysockets/baileys` |
| **Database** | MySQL (Produksi / Docker) dengan driver `mysql2`, fallback SQLite WASM |
| **Excel Parser** | ExcelJS |
| **Keamanan** | JWT, bcryptjs, Helmet, Express Rate Limit, Parameterized SQL |
| **Deployment** | Ubuntu Server 22.04 / 24.04, PM2, Nginx Reverse Proxy, Docker Compose |

---

## 📂 Struktur Proyek

```
wa-blast-manager-pro/
├── backend/
│   ├── src/
│   │   ├── config/             # Konfigurasi environment
│   │   ├── database/           # Pool MySQL, SQLite WASM, schema.sql, migrate, seed
│   │   ├── middleware/         # Auth JWT, Role-based, Rate Limit, Upload Multer
│   │   ├── modules/
│   │   │   ├── admin-bot/      # WhatsApp Admin Controller & DM Command Parser
│   │   │   ├── auth/           # Login, logout, ganti password
│   │   │   ├── broadcast/      # Broadcast service, worker queue, circuit breaker
│   │   │   ├── dashboard/      # Statistik agregat & metrik grafik
│   │   │   ├── excel/          # ExcelJS parser, validasi 628, mapping kolom
│   │   │   ├── logs/           # Log sistem, audit log, server metrics
│   │   │   ├── media/          # Pengelolaan gambar broadcast
│   │   │   ├── settings/       # Pengaturan anti-ban & emergency stop
│   │   │   ├── templates/      # Manajemen template pesan
│   │   │   └── whatsapp/       # Baileys adapter, Mock adapter, session storage
│   │   ├── utils/              # Normalizer nomor, Template Engine, Logger Socket
│   │   ├── app.ts              # Express application setup
│   │   └── server.ts           # HTTP & Socket.IO server bootstrap
│   ├── tests/                  # Unit & integration automated tests (Vitest)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/         # Sidebar, Topbar, StatCard, Modal, Toast
│   │   ├── context/            # AuthContext, SocketContext, ThemeContext
│   │   ├── pages/              # 11 Halaman lengkap UI/UX SaaS
│   │   ├── services/           # Axios instance & Socket.IO client
│   │   ├── types/              # TypeScript interface definitions
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── nginx.conf
├── docker-compose.yml
├── ecosystem.config.js
└── README.md
```

---

## 🚀 Panduan Instalasi dari Nol (Ubuntu Server 22.04 / 24.04)

### 1. Update Server & Instalasi Dependensi Dasar
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx mysql-server certbot python3-certbot-nginx
```

### 2. Instalasi Node.js (v20 / v22 LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 3. Konfigurasi Database MySQL
Masuk ke terminal MySQL:
```bash
sudo mysql
```
Jalankan perintah SQL:
```sql
CREATE DATABASE wa_blast_pro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'wa_blast_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'PasswordKuatAnda2026!';
GRANT ALL PRIVILEGES ON wa_blast_pro.* TO 'wa_blast_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Clone Proyek & Setup Environment
```bash
git clone <URL_REPOSITORY_ANDA> /var/www/wa-blast
cd /var/www/wa-blast
```
Salin template konfigurasi:
```bash
cp backend/.env.example backend/.env
nano backend/.env
```
Sesuaikan konfigurasi kredensial MySQL:
```env
PORT=5000
NODE_ENV=production
JWT_SECRET=buat_string_acak_panjang_minimal_32_karakter
DB_CLIENT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=wa_blast_user
DB_PASSWORD=PasswordKuatAnda2026!
DB_NAME=wa_blast_pro
DEFAULT_ADMIN_PASSWORD=Admin@WA2026Kuat!
```

### 5. Install Dependensi & Build Proyek
```bash
# Install backend
cd /var/www/wa-blast/backend
npm install
npm run build
npm run db:migrate
npm run db:seed

# Install frontend & build static files
cd /var/www/wa-blast/frontend
npm install
npm run build
```

### 6. Jalankan Backend dengan PM2
```bash
cd /var/www/wa-blast
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 7. Konfigurasi Nginx Reverse Proxy
Buat file konfigurasi Nginx:
```bash
sudo nano /etc/nginx/sites-available/wa-blast
```
Isi konfigurasi berikut:
```nginx
server {
    listen 80;
    server_name blast.domainanda.com; # Ganti dengan domain atau IP Anda

    client_max_body_size 30M;

    # Frontend Single Page App
    location / {
        root /var/www/wa-blast/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads Static Files
    location /uploads/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Socket.IO Real-time WebSocket Proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```
Aktifkan konfigurasi Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/wa-blast /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Pasang Sertifikat SSL / HTTPS (Let's Encrypt)
```bash
sudo certbot --nginx -d blast.domainanda.com
```

---

## 🐳 Opsi Deployment dengan Docker Compose

Jika Anda lebih menyukai containerisasi Docker:
```bash
cd /var/www/wa-blast
docker compose up -d --build
```
Aplikasi akan langsung berjalan dengan 3 container:
- `wa_blast_mysql`: MySQL 8.0 dengan auto-init schema.sql
- `wa_blast_backend`: Node.js API + Baileys Engine + Worker Queue
- `wa_blast_frontend`: Nginx + React Dashboard di port 80

---

## 📱 Panduan Penggunaan WhatsApp Admin (Chat Pribadi)

Nomor admin yang didaftarkan di menu **WhatsApp Admin** dapat mengendalikan bot langsung lewat chat WhatsApp:

| Perintah | Deskripsi |
|---|---|
| `!menu` | Menampilkan seluruh daftar perintah. |
| `!status` | Menampilkan koneksi WhatsApp, penggunaan RAM, CPU, dan status antrean. |
| `!excel list` | Menampilkan 10 dataset Excel yang tersimpan di database. |
| `!blast list` | Menampilkan broadcast yang sedang berjalan dan riwayat terakhir. |
| `!blast status <ID>` | Menampilkan progres pengiriman broadcast berdasarkan ID. |
| `!blast jeda <ID>` | Menjeda pengiriman pesan broadcast. |
| `!blast lanjut <ID>` | Melanjutkan pengiriman pesan yang sempat dijeda. |
| `!blast batal <ID>` | Membatalkan broadcast yang sedang berjalan. |

### Mengupload Excel via Chat WhatsApp:
1. Kirim file `.xlsx` atau `.xls` ke nomor WhatsApp bot.
2. Tambahkan caption:
   ```
   !excel simpan "Data Relawan November"
   ```
3. Bot akan membalas ringkasan baris valid & tidak valid. Dataset langsung muncul di dashboard website.

### Membuat Broadcast Langsung via WhatsApp:
1. Kirim perintah:
   ```
   !blast buat "Data Relawan November"
   ```
2. Bot meminta teks template. Balas dengan teks Anda:
   ```
   Halo {{nama}}, kami mengundang Anda mengikuti kegiatan di wilayah {{keterangan}}.
   ```
3. Bot meminta gambar. Kirim gambar atau ketik `!tanpagambar`.
4. Bot menampilkan ringkasan data, jumlah kontak, dan pratinjau pesan untuk penerima pertama, serta memberikan kode konfirmasi:
   ```
   Balas: !blast konfirmasi CFM-ABC123
   ```
5. Balas dengan perintah konfirmasi tersebut. Broadcast otomatis dijalankan oleh background worker!

---

## 🔧 Panduan Operasional & Troubleshooting

### Mengatasi QR Code Gagal Muncul / Timeout
1. Pastikan port 5000 aktif: `pm2 status`.
2. Klik tombol **Hubungkan** pada halaman *Koneksi WhatsApp*.
3. Jika sesi lama macet, klik **Logout** lalu klik **Hubungkan** kembali. Baileys akan otomatis men-generate QR code baru.

### Mengatasi WhatsApp Terputus
- Sistem Baileys pada aplikasi ini memiliki auto-reconnect cerdas. Jika koneksi WiFi/seluler di ponsel Anda terputus sejenak, bot akan otomatis menyambung kembali dalam beberapa detik.
- Jika status berubah menjadi `logged_out` (misalnya karena sesi dicabut dari aplikasi WhatsApp di HP), Anda cukup scan ulang QR code.

### Memeriksa Log & Aktivitas
- Buka menu **Terminal & Logs** pada dashboard website untuk streaming live log.
- Atau melalui terminal server:
  ```bash
  pm2 logs wa-blast-backend
  ```

### Backup & Restore Database
- **Backup Database MySQL**:
  ```bash
  mysqldump -u wa_blast_user -p wa_blast_pro > backup_wa_blast_$(date +%F).sql
  ```
- **Backup Sesi WhatsApp & Upload**:
  ```bash
  tar -czvf backup_sessions_$(date +%F).tar.gz /var/www/wa-blast/backend/data/sessions
  ```
- **Restore Database**:
  ```bash
  mysql -u wa_blast_user -p wa_blast_pro < backup_wa_blast_YYYY-MM-DD.sql
  ```

### Update Aplikasi Secara Aman
```bash
cd /var/www/wa-blast
git pull origin main
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
pm2 restart wa-blast-backend
```

---

## 🧪 Pengujian Otomatis (Automated Testing)

Aplikasi dilengkapi test suite komprehensif menggunakan Mock Adapter WhatsApp agar aman dijalankan tanpa memerlukan akun WhatsApp asli:
```bash
cd backend
npm test
```
Seluruh 6 test suite mencakup:
- Validasi & normalisasi nomor telepon Indonesia (`08xx` -> `628xx`).
- Resolusi variabel dinamis `{{nama}}`, `{{A}}`, `{{B}}`, `{{C}}`, emoji, dan Unicode.
- Parsing Excel, pemetaan kolom, dan deteksi duplikat.
- Pengendali perintah WhatsApp Admin DM, upload Excel dari chat, dan alur pembuatan broadcast interaktif dengan konfirmasi.
- Antrean background worker, jeda/lanjut, penanganan opt-out, dan circuit breaker.
- Sistem autentikasi pengguna dan hashing password.

---

## ⚖️ Lisensi & Kebijakan
Aplikasi ini dikembangkan untuk penggunaan komunikasi organisasi dan relawan yang bertanggung jawab. Gunakan selalu jeda pengiriman aman dan pastikan Anda memiliki izin persetujuan (*consent*) dari seluruh nomor penerima pesan.
