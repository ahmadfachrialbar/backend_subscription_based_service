# Dokumentasi Belajar AntiAI Subscription Service

### Appendix A: Instalasi & Setup Awal
### Appendix B: Package & Libraries
### Appendix C: Struktur Folder
### Appendix D: Database Design
### Appendix E: Testing dengan Postman
### Appendix F: Troubleshooting

## BAB 1: Role User, Admin, dan Finance
## BAB 2: Fitur Login dan JWT
## BAB 3: Data Paket Langganan
## BAB 4: Fitur Subscribe Paket
## BAB 5: Masa Aktif Langganan
## BAB 6: Fitur Upgrade dan Downgrade Paket
## BAB 7: Tagihan Langganan
## BAB 8: Simulasi Pembayaran
## BAB 9: Pembatasan Fitur Berdasarkan Paket
## BAB 10: Status Langganan (Active, Expired, Cancelled, Trial)
## BAB 11: Histori Pembayaran
## BAB 12: Notifikasi Masa Aktif
## BAB 13: Dashboard Pelanggan Aktif dan Pendapatan

---
## APPENDIX

### Appendix A: Instalasi & Setup Awal

Langkah-langkah untuk menjalankan project Express.js ini dari awal (inisialisasi npm) hingga server berjalan:

1. Pastikan Node.js dan MySQL sudah terinstall.
2. Buka terminal di folder tujuan, lalu jalankan `npm init -y` untuk membuat file `package.json`.
3. Install package yang diperlukan: `npm install express mysql2 bcryptjs jsonwebtoken cors dotenv node-cron` (Lihat Appendix B).
4. Buat file `.env` dan isi dengan konfigurasi database serta rahasia JWT (contoh port 3306, user root, db antiai_db).
5. Buat struktur folder sesuai dengan Appendix C.
6. Siapkan database MySQL, buat tabel-tabel sesuai dengan ERD dan lakukan seeder untuk memasukkan Admin dan Finance.
7. Di file utama (biasanya `app.js` atau `index.js`), inisialisasi aplikasi Express dan atur routingnya.
8. Jalankan `npm run dev` atau `node index.js`. Jika berjalan normal akan tampil "Server is running on port..." di terminal.

### Appendix B: Package & Libraries

Berikut adalah library utama yang digunakan pada project ini beserta lokasinya:

| Package | Fungsi | Dipakai di Fitur |
| --- | --- | --- |
| express | Web framework utama untuk routing dan server HTTP | Semua Fitur |
| mysql2 | Library untuk terhubung dan mengeksekusi query MySQL | Semua Fitur (Database config) |
| bcryptjs | Algoritma enkripsi satu arah untuk keamanan password | Bab 2 (Login/Register) |
| jsonwebtoken | Pembuat dan validasi JWT (autentikasi dan sesi) | Bab 2 (Autentikasi) |
| node-cron | Sistem penjadwalan (cron job) berjalan di background server | Bab 5, 10, 12 (Auto expired, notifikasi) |
| cors | Membuka izin lintas origin (agar bisa diakses frontend berbeda) | Global (Di app.js) |
| dotenv | Membaca variabel environment dari file .env | Global (Konfigurasi) |

### Appendix C: Struktur Folder

Aplikasi memiliki pemisahan kode berbasis fungsi (arsitektur yang modular).

```text
src/
├── config/         # Konfigurasi koneksi database, cron, seeder
├── controllers/    # Tempat menulis logika bisnis / eksekusi dari rute
├── middleware/     # Fungsi penengah untuk cek login dan cek role (auth & authorize)
├── routes/         # Mendefinisikan endpoint API yang mengarah ke controller
└── utils/          # Fungsi bantuan (helper), utilitas, atau penjadwal (cron)
```

### Appendix D: Database Design

Berikut adalah representasi sederhana rancangan tabel database (ERD):

- **users**: Menyimpan data akun. `(id, email, password, role)`
- **refresh_tokens**: Menyimpan token login. `(id, user_id, token, expires_at)`
- **plans**: Menyimpan data produk paket. `(id, name, price, billing_cycle, features)`
- **subscriptions**: Menyimpan data langganan user. `(id, user_id, plan_id, status, current_period_start, current_period_end)`
- **invoices**: Menyimpan data tagihan. `(id, subscription_id, invoice_number, total, status, due_date)`
- **payments**: Menyimpan data riwayat bayar simulasi. `(id, invoice_id, amount, status, payment_method)`
- **notifications**: Menyimpan pesan pengingat sistem ke user. `(id, user_id, type, message)`

Relasinya:
- `users` 1 -> N `subscriptions`
- `plans` 1 -> N `subscriptions`
- `subscriptions` 1 -> N `invoices`
- `invoices` 1 -> N `payments`
- `users` 1 -> N `notifications`
- `users` 1 -> N `refresh_tokens`

### Appendix E: Testing dengan Postman

Berikut adalah daftar endpoint API yang dapat diuji melalui Postman:

**Auth (Authentication & User)**
- `POST /api/auth/register` (Registrasi user baru)
- `POST /api/auth/login` (Login, menghasilkan Access Token)
- `POST /api/auth/refresh-token` (Mendapatkan token baru)
- `POST /api/auth/logout` (Logout/Revoke token)

**Plans (Paket Berlangganan)**
- `GET /api/plans` (Melihat daftar semua paket yang tersedia)
- `POST /api/plans` (Menambah paket baru - Khusus Admin)
- `PUT /api/plans/:id` (Mengupdate paket - Khusus Admin)
- `DELETE /api/plans/:id` (Menghapus paket - Khusus Admin)

**Subscriptions (Berlangganan)**
- `POST /api/subscriptions` (Berlangganan ke paket tertentu)
- `GET /api/subscriptions/my` (Melihat data langganan diri sendiri)
- `POST /api/subscriptions/upgrade` (Upgrade/Downgrade paket langganan)
- `POST /api/subscriptions/cancel` (Membatalkan langganan)

**Invoices & Payments (Tagihan & Pembayaran)**
- `GET /api/invoices` (Melihat semua tagihan - Admin/Finance)
- `GET /api/invoices/my` (Melihat tagihan milik diri sendiri)
- `POST /api/payments/pay` (Mengeksekusi simulasi pembayaran sebuah tagihan)
- `GET /api/payments/my` (Melihat riwayat transaksi pembayaran diri sendiri)

**Notifications (Notifikasi)**
- `GET /api/notifications` (Melihat notifikasi user saat ini)
- `PUT /api/notifications/:id/read` (Menandai notifikasi telah dibaca)

**Dashboards**
- `GET /api/dashboard/admin` (Statistik jumlah user, langganan aktif, dsb. - Khusus Admin)
- `GET /api/dashboard/finance` (Statistik total pendapatan/revenue - Khusus Finance)

### Appendix F: Troubleshooting

Beberapa kendala yang mungkin dihadapi beserta solusinya:
- **Token invalid atau expired**: Akses token habis (contoh lewat 15 menit), frontend harus mengirim request ke `/refresh-token` untuk mendapatkan token baru.
- **Akses Ditolak / 403 Forbidden**: Terjadi jika user mencoba mengakses rute milik Admin atau Finance. Pastikan role akun sudah benar di tabel database.
- **Tidak bisa connect ke MySQL**: Pastikan service database MySQL berjalan di sistem, dan konfigurasi username, password, port di dalam `.env` sudah benar.
- **Cron Job tidak berjalan**: Cron job adalah proses background, pastikan proses utama aplikasi di-import dan dijalankan terus menerus tanpa crash di terminal.

===

## BAB 1: Role User, Admin, dan Finance

Sistem ini menggunakan tiga role utama yaitu User, Admin, dan Finance. Ketiga role ini dibuat untuk membatasi hak akses pada fitur-fitur tertentu.

- **User**: Role default saat pengguna baru mendaftar (register). User hanya bisa melihat paket, berlangganan, dan melihat invoice miliknya sendiri.
- **Admin**: Role yang memiliki hak akses tertinggi. Admin bisa membuat paket (plan), melihat semua subscription, dan mengakses dashboard admin. Admin tidak bisa register mandiri, melainkan dibuat melalui seeder database.
- **Finance**: Role khusus untuk mengelola keuangan. Finance bisa melihat semua invoice, mengupdate status invoice, dan melihat dashboard pendapatan (revenue). Sama seperti admin, finance juga dibuat melalui seeder.

Data role disimpan di database pada tabel `users`, tepatnya di kolom `role` yang bertipe ENUM dengan nilai `('user', 'admin', 'finance')`. Ini untuk memastikan tidak ada role selain ketiga role tersebut.

Untuk membatasi hak akses di setiap endpoint, digunakan middleware `authorize`. Middleware ini akan mengecek apakah role user yang sedang login diizinkan mengakses rute tersebut.

Contoh kode middleware `authorize`:
```javascript
// middleware cek role
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Akses ditolak' });
        }
        next();
    };
};
```

Contoh penggunaan di rute:
```javascript
// Penggunaan di route, hanya admin yang boleh create plan
router.post('/plans', verifyToken, authorize('admin'), createPlan);
```

**Tabel Perbandingan Hak Akses:**

| Fitur | User | Admin | Finance |
| --- | --- | --- | --- |
| Lihat plan | Yes | Yes | Yes |
| Buat plan | No | Yes | No |
| Subscribe | Yes | Yes | Yes |
| Lihat semua subscription | No | Yes | No |
| Lihat invoice sendiri | Yes | Yes | Yes |
| Lihat semua invoice | No | Yes | Yes |
| Update status invoice | No | Yes | Yes |
| Dashboard revenue | No | Yes | Yes |

---

## BAB 2: Fitur Login dan JWT

Aplikasi ini menggunakan JWT (JSON Web Token) untuk proses autentikasi. JWT digunakan karena bersifat stateless, artinya server tidak perlu menyimpan sesi login di memori atau database secara terus-menerus. Token yang disimpan di sisi client akan dikirim setiap kali mengakses endpoint yang dilindungi.

Ada dua jenis token yang digunakan:
1. **Access Token**: Masa aktif singkat (contoh 15 menit). Digunakan untuk mengakses endpoint.
2. **Refresh Token**: Masa aktif lebih lama (contoh 7 hari). Digunakan untuk meminta access token baru ketika access token sudah kedaluwarsa.

**Alur Login Lengkap:**
1. User mengirim email dan password melalui form login.
2. Server mencari user berdasarkan email di database.
3. Password yang dikirim dicocokkan dengan password hash di database menggunakan `bcrypt.compare()`.
4. Jika cocok, server membuat access token dan refresh token menggunakan `jwt.sign()`.
5. Refresh token disimpan ke tabel `refresh_tokens` di database untuk keperluan validasi (dan bisa di-revoke saat logout).
6. Token dikirim sebagai respon ke client.

**Alur Verifikasi Token (Middleware):**
1. Client mengirim request dengan menyertakan token pada header: `Authorization: Bearer <token>`.
2. Middleware mengekstrak token dari header.
3. Token diverifikasi menggunakan `jwt.verify(token, process.env.JWT_SECRET)`.
4. Jika token valid, middleware mengecek apakah user masih berstatus aktif di database.
5. Data payload dari token disimpan ke `req.user` lalu diteruskan ke controller (menggunakan `next()`).

Untuk proses Logout, server cukup menghapus (revoke) refresh token dari database agar tidak bisa digunakan lagi untuk meminta access token baru.

**Package yang Digunakan:**
| Package | Fungsi | Dipakai di |
| --- | --- | --- |
| jsonwebtoken | `jwt.sign()` membuat token, `jwt.verify()` mengecek token | authController.js, authMiddleware.js |
| bcryptjs | `bcrypt.hash()` mengacak password, `bcrypt.compare()` membandingkan | authController.js (register, login) |

---

## BAB 3: Data Paket Langganan

Sistem ini memiliki fitur paket langganan (plans). Data ini disimpan di dalam tabel `plans`. Terdapat 4 paket default pada sistem ini:
1. Gratis (Free)
2. Pro
3. Team
4. Enterprise

Tabel `plans` memiliki struktur kolom utama sebagai berikut:
- `name`: Nama paket (contoh: AntiAI Pro)
- `slug`: URL friendly nama paket (contoh: pro)
- `price`: Harga paket
- `billing_cycle`: Siklus tagihan (monthly/yearly)
- `features`: Detail fitur yang dibungkus dalam format JSON
- `trial_days`: Jumlah hari masa percobaan gratis (trial)

Untuk menyimpan banyak fitur dalam satu kolom database MySQL, kita menggunakan tipe data JSON. Di dalam kode backend, kita menggunakan `JSON.stringify()` sebelum menyimpan ke database, dan `JSON.parse()` saat membaca data fitur tersebut dari database.

Akses ke paket ini bersifat terbuka (public) untuk dilihat, namun proses CRUD (Create, Read, Update, Delete) hanya boleh dilakukan oleh Admin.

Contoh data plan:
```json
{
    "name": "AntiAI Pro",
    "slug": "pro",
    "price": 150000,
    "billing_cycle": "monthly",
    "features": {
        "model_access": ["antiai-1", "antiai-lite"],
        "message_cap": null,
        "response_speed": "priority"
    },
    "trial_days": 7
}
```

---

## BAB 4: Fitur Subscribe Paket

Fitur ini mengatur jalannya proses user ketika memilih dan berlangganan sebuah paket.

**Alur Subscribe:**
1. User memilih `plan_id` yang diinginkan.
2. Sistem mengecek apakah plan tersebut ada dan berstatus aktif.
3. Sistem mengecek apakah user tersebut belum memiliki langganan (subscription) yang sedang aktif.
4. Sistem menghitung tanggal periode. `period_start` diisi tanggal hari ini, sedangkan `period_end` ditambahkan 30 hari (jika plan bulanan) atau 365 hari (jika tahunan). Apabila ada `trial_days`, maka dihitung juga `trial_end` (contoh: hari ini + 7 hari).
5. Data langganan di-insert ke dalam tabel `subscriptions`. Status langganan akan menjadi 'trial' jika ada trial days, dan menjadi 'active' jika tidak ada trial.
6. Sistem secara otomatis memanggil fungsi `generateInvoice()` untuk membuat tagihan awal lalu memasukkannya ke tabel `invoices`.
7. Sistem mengembalikan response berupa data subscription beserta `invoice_id`.

**Fungsi Penting:**
| Fungsi | File | Keterangan |
| --- | --- | --- |
| generateInvoice() | subscriptionController.js | Fungsi bantu untuk otomatis membuat tagihan |
| new Date() | JavaScript native | Digunakan untuk menghitung waktu awal dan akhir periode |

---

## BAB 5: Masa Aktif Langganan

Siklus masa aktif langganan diukur menggunakan tanggal yang tersimpan di database:
- `current_period_start`: Tanggal ketika langganan dimulai.
- `current_period_end`: Tanggal ketika masa aktif berakhir (contoh start + 30 hari untuk monthly).
- `trial_end`: Tanggal berakhirnya masa percobaan gratis (jika ada).

Sistem memberikan toleransi waktu (Grace Period) selama 3 hari setelah tanggal `current_period_end` berlalu, sebelum status akun diubah menjadi tertangguhkan (suspend).

Untuk mengotomatisasi pengecekan ini setiap harinya, kita menggunakan cron job.

**Package yang digunakan:**
`node-cron` digunakan untuk membuat penjadwalan rutin di backend. Untuk manipulasi dan perhitungan tanggal, kita bisa menggunakan objek Date bawaan JavaScript atau query dari MySQL (seperti DATE_ADD).

Contoh cron job untuk pengecekan harian:
```javascript
const cron = require('node-cron');

// Berjalan setiap tengah malam
cron.schedule('0 0 * * *', async () => {
    // 1. Cek subscription yang current_period_end < hari ini
    // 2. Update status langganan tersebut menjadi expired atau past_due
});
```

---

## BAB 6: Fitur Upgrade dan Downgrade Paket

Aplikasi menyediakan fleksibilitas bagi user untuk mengubah paketnya baik menjadi lebih tinggi (upgrade) maupun lebih rendah (downgrade).

- **Upgrade**: Mengubah ke paket yang harganya lebih mahal. Proses ini dieksekusi secara instan dan sistem akan membuatkan invoice baru (dengan perhitungan prorata/selisih harga).
- **Downgrade**: Mengubah ke paket yang harganya lebih murah. Proses ini tidak dieksekusi saat itu juga, melainkan efektif pada siklus tagihan berikutnya (next billing cycle).
- **Validasi**: Sistem harus bisa membedakan mana plan yang lebih mahal untuk rute upgrade dan mana plan yang lebih murah untuk rute downgrade.

**Alur Upgrade:**
1. User mengirim ID dari paket baru (`new_plan_id`).
2. Sistem mengecek apakah user memiliki langganan yang sedang aktif.
3. Sistem memvalidasi apakah harga paket baru lebih mahal dari paket saat ini.
4. Sistem mengupdate nilai `plan_id` pada data subscription di database.
5. Sistem memanggil fungsi pembuat invoice dengan detail tagihan dari paket yang baru.
6. Respons dikirim berisi update data langganan dan invoice baru.

**Fungsi Penting:**
| Fungsi | File | Keterangan |
| --- | --- | --- |
| upgradeSubscription() | subscriptionController.js | Menangani logika upgrade |
| downgradeSubscription() | subscriptionController.js | Menangani logika downgrade |
| generateInvoice() | subscriptionController.js | Dipanggil untuk membuat invoice baru |

---

## BAB 7: Tagihan Langganan

Tagihan (Invoice) dikelola secara otomatis oleh sistem saat pertama kali subscribe atau ketika melakukan upgrade paket. Setiap tagihan memiliki siklus status perjalanannya sendiri, dari mulai dibuat hingga dibayar.

Nomor invoice menggunakan format auto increment khusus, misalnya `INV-YYYYMM-NNNN` (contoh: `INV-202605-0001`).

Status pada Invoice:
- `draft`: Baru saja dibuat
- `sent`: Dikirim ke user (aktif menunggu pembayaran)
- `paid`: Lunas dibayar
- `overdue`: Melewati batas waktu jatuh tempo
- `cancelled`: Dibatalkan
- `refunded`: Dana dikembalikan

Hak Akses Invoice: User hanya diizinkan melihat daftar dan rincian invoicenya sendiri, sedangkan Admin atau Finance bisa melihat daftar seluruh invoice yang ada di dalam sistem.

**Fungsi Penting:**
| Fungsi | File | Keterangan |
| --- | --- | --- |
| generateInvoiceNumber() | invoiceController.js | Digunakan untuk membuat nomor unik invoice |
| calculateTotal() | invoiceController.js | Menghitung harga akhir (subtotal + tax - discount) |

Contoh respon JSON sebuah Invoice:
```json
{
    "invoice_number": "INV-202605-0001",
    "subtotal": 175000,
    "tax": 17500,
    "discount": 0,
    "total": 192500,
    "currency": "IDR",
    "status": "sent",
    "due_date": "2026-05-16"
}
```

---

## BAB 8: Simulasi Pembayaran

Karena aplikasi ini bersifat simulasi, tidak ada integrasi dengan Payment Gateway asli (seperti Midtrans/Stripe). Pembayaran disimulasikan menggunakan skenario angka probabilitas dari JavaScript murni.

Skenario pembayaran yang disimulasikan:
- **Success (70%)**: Simulasi berhasil dibayar. Invoice berubah menjadi 'paid' dan langganan menjadi 'active'.
- **Failed (20%)**: Simulasi gagal. Status pembayaran menjadi 'failed', dan sistem menyimpan alasan gagal, serta mengirim notifikasi.
- **Expired (10%)**: Simulasi kedaluwarsa.

**Alur Simulasi:**
1. User mengirim `invoice_id` dan `payment_method`.
2. Sistem memvalidasi apakah invoice tersebut ada dan belum lunas (status bukan paid).
3. Sistem membuat catatan pembayaran baru di database dengan status 'pending'.
4. Menggunakan `Math.random()` untuk mendapatkan angka acak.
    - `0` sampai `0.7` = Success
    - `0.7` sampai `0.9` = Failed
    - `0.9` sampai `1.0` = Expired
5. Berdasarkan hasil random tersebut, sistem mengambil tindakan.
    - Jika Success: update payment menjadi 'success', update invoice menjadi 'paid', update subscription menjadi 'active'.
    - Jika Failed: update payment menjadi 'failed', simpan alasan kegagalan (`failure_reason`).

Fitur ini hanya menggunakan fungsi bawaan `Math.random()` dari JavaScript dan tidak bergantung pada package eksternal.

---

## BAB 9: Pembatasan Fitur Berdasarkan Paket

Paket yang berbeda menawarkan akses fitur yang berbeda pula. Fitur ini mengamankan API sehingga hanya user dengan paket yang sesuai yang dapat menggunakan endpoint tertentu (disebut *Feature Gating*).

Data batasan fitur ini disimpan pada kolom JSON di tabel `plans`.

Untuk mengamankan rute, kita membuat middleware `requirePlan()`. Middleware ini bertugas untuk mencegat request dan memvalidasi apakah tingkatan paket yang dimiliki user saat ini memenuhi syarat minimum untuk mengakses fitur tersebut.

**Fungsi Penting:**
| Fungsi | File | Keterangan |
| --- | --- | --- |
| requirePlan() | middleware/planMiddleware.js | Memastikan plan user setara atau lebih tinggi dari yang diminta |
| checkFeature() | middleware/planMiddleware.js | Mengecek ketersediaan fitur secara spesifik |

Contoh penggunaan feature gating pada routing:
```javascript
// Hanya user dengan paket Pro atau lebih tinggi yang bisa mengakses ini
router.get('/api/advanced', verifyToken, requirePlan('pro'), advancedFeature);

// Hanya user tingkat Enterprise yang diizinkan menggunakan rute ini
router.get('/api/api-access', verifyToken, requirePlan('enterprise'), apiAccess);
```

---

## BAB 10: Status Langganan (Active, Expired, Cancelled, Trial)

Langganan yang dimiliki user bisa berada pada beberapa fase status (State Machine). Berikut adalah status yang ada dan pergerakannya:

- `trial`: Masa percobaan gratis (belum ditagih pembayaran).
- `active`: Langganan aktif (sudah membayar atau masa trial habis lalu sukses konversi bayar).
- `cancelled`: Pengguna memutuskan berhenti langganan (status tetap aktif hanya sampai akhir periode berlangganan).
- `expired`: Masa periode habis dan tidak ada perpanjangan pembayaran.
- `past_due`: Pembayaran gagal di tagihan terbaru, masuk masa tenggang (grace period).
- `suspended`: Akun diblokir karena melewati grace period belum bayar.

**Alur perpindahan status (State Machine):**
- [trial] --bayar--> [active]
- [trial] --habis tanpa bayar--> [expired]
- [active] --cancel--> [cancelled] --habis periode--> [expired]
- [active] --payment fail--> [past_due] --retry fail--> [suspended]
- [past_due] --bayar--> [active]
- [suspended] --bayar--> [active]

Pembaruan status yang dipicu oleh berjalannya waktu (seperti habis masa trial atau expired) dijalankan menggunakan package `node-cron`. Cron ini berjalan di background secara berkala, menjalankan query MySQL seperti `UPDATE subscriptions SET status = ? WHERE current_period_end < CURDATE()`.

---

## BAB 11: Histori Pembayaran

Semua riwayat transaksi dari simulasi pembayaran dicatat dan bisa diakses oleh user.
Data ini disimpan pada tabel `payments`.

Data yang bisa dilihat meliputi: `invoice_id`, `amount` (jumlah bayar), `status`, `payment_method` (metode yang dipilih), dan `paid_at` (waktu bayar).

Data diambil menggunakan Query JOIN database MySQL yang menggabungkan informasi dari tabel `payments` dengan tabel `invoices` agar dapat menyajikan detail yang lebih lengkap kepada user.

Endpoint yang digunakan:
- `GET /api/payments/my` : Digunakan oleh user untuk melihat riwayat transaksinya sendiri secara aman.

---

## BAB 12: Notifikasi Masa Aktif

Sistem dilengkapi dengan fitur pengingat atau pemberitahuan kepada user yang bersifat otomatis. Kondisi yang akan memicu pengiriman notifikasi antara lain:
- Masa percobaan gratis (trial) akan segera habis (H-3).
- Masa langganan (subscription) akan segera berakhir (H-7).
- Pembayaran berhasil dilakukan.
- Pembayaran gagal dieksekusi.
- Berhasil melakukan upgrade atau downgrade paket.

**Package yang digunakan:**
| Package | Fungsi | Dipakai di |
| --- | --- | --- |
| node-cron | Mengecek jadwal database harian untuk melihat siapa yang butuh dinotifikasi | cron job |
| Tabel notifications | Menyimpan isi dari notifikasi agar dapat ditampilkan di frontend | notificationController.js |

Struktur dari tabel notifications di database:
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID,
    type ENUM('trial_ending', 'renewal_reminder', 'payment_failed', 'payment_success', 'upgrade_success'),
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP
);
```

---

## BAB 13: Dashboard Pelanggan Aktif dan Pendapatan

Fitur khusus yang dikhususkan bagi role Admin dan Finance untuk memantau keberhasilan bisnis dari sistem langganan ini. Data ini adalah hasil ringkasan (agregasi) dari database.

**Hak Akses Dashboard:**
- **Admin**: Melihat laporan Total User, Active Subscribers, Trial Users, dan Churn Rate (Tingkat berhenti berlangganan).
- **Finance**: Melihat laporan terkait uang seperti Pendapatan Hari Ini (Revenue), Pendapatan Bulan Ini, dan Outstanding Invoices (Tagihan yang belum dibayar).

**Query Agregasi yang Digunakan:**
| Fungsi | Query MySQL | Keterangan |
| --- | --- | --- |
| Total user | `SELECT COUNT(*) FROM users` | Menghitung seluruh user terdaftar |
| Active subscribers | `SELECT COUNT(*) FROM subscriptions WHERE status = 'active'` | Menghitung user dengan langganan aktif |
| MRR (Monthly Recurring Revenue) | `SELECT SUM(price) FROM subscriptions JOIN plans` | Total estimasi pendapatan rutin bulanan |
| Revenue hari ini | `SELECT SUM(total) FROM invoices WHERE paid_at = CURDATE()` | Uang yang masuk lunas hari ini |

Endpoint yang digunakan:
- `GET /api/dashboard/admin` : Untuk data dashboard Admin.
- `GET /api/dashboard/finance` : Untuk data dashboard Finance.

---

