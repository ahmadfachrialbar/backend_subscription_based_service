# AntiAI Subscription Service

Backend API untuk sistem langganan berbasis paket (subscription-based). Sistem ini memungkinkan pengguna untuk berlangganan paket layanan dengan fitur, harga, dan batasan yang berbeda-beda.

## 🚀 Tech Stack

| Komponen      | Teknologi          |
| ------------- | ------------------ |
| Runtime       | Node.js 18+        |
| Framework     | Express.js 4.x     |
| Database      | MySQL 8.0+         |
| Auth          | JWT (jsonwebtoken) |
| Password Hash | bcryptjs           |
| DB Driver     | mysql2             |
| CORS          | cors               |
| Env Config    | dotenv             |
| Dev Tool      | nodemon            |

## 📋 Prerequisites

- Node.js (v18 atau lebih tinggi)
- MySQL Server (lokal atau cloud seperti filess.io, Clever Cloud, PlanetScale)
- Postman (untuk testing API)

## ⚙️ Installation

### 1. Clone Repository

```bash
git clone https://github.com/username/anti-ai-subscription.git
cd anti-ai-subscription
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Buat file `.env` di root folder:

```env
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=subscription_db
DB_PORT=3306

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_change_this_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

Untuk production (Vercel + filess.io):

```env
DB_HOST=your_host.filess.io
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database
DB_PORT=3306

JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### 4. Setup Database

**Opsi A: MySQL Lokal (Laragon/XAMPP)**

1. Buka phpMyAdmin
2. Buat database baru: `subscription_db`
3. Jalankan server — tabel akan auto-create

**Opsi B: MySQL Cloud (filess.io)**

1. Daftar di [filess.io](https://filess.io)
2. Buat database MySQL baru
3. Copy credential ke `.env`
4. Deploy ke Vercel dan akses `/api/setup` untuk auto-create tabel

### 5. Run Server

**Development:**

```bash
npm run dev
```

**Production:**

```bash
npm start
```

Server akan berjalan di `http://localhost:3000`

## 📁 Project Structure

```
anti-ai-subscription/
├── .env                          # Environment variables
├── .env.example                  # Template environment
├── .gitignore
├── package.json                  # Dependencies & scripts
├── README.md                     # This file
├── server.js                     # Entry point
└── src/
    ├── config/
    │   ├── database.js           # MySQL connection & auto-init tables
    │   └── seeder.js             # Seed default data (admin, finance, plans)
    ├── controllers/
    │   ├── authController.js     # Register, login, profile
    │   ├── planController.js     # CRUD plans
    │   ├── subscriptionController.js  # Subscribe, upgrade, downgrade, cancel
    │   ├── invoiceController.js  # CRUD invoices
    │   ├── paymentController.js  # Simulate payment
    │   └── dashboardController.js  # Admin & finance dashboard
    ├── middleware/
    │   ├── authMiddleware.js     # JWT verification & role authorization
    │   └── errorHandler.js       # Global error handler
    ├── routes/
    │   ├── authRoutes.js         # /api/auth/*
    │   ├── planRoutes.js         # /api/plans/*
    │   ├── subscriptionRoutes.js # /api/subscriptions/*
    │   ├── invoiceRoutes.js      # /api/invoices/*
    │   ├── paymentRoutes.js      # /api/payments/*
    │   └── dashboardRoutes.js    # /api/dashboard/*
    └── utils/
        ├── responseHelper.js     # Standard response format
        ├── invoiceGenerator.js   # Auto-generate invoice number
        └── csvExporter.js        # CSV export helper
```

## 🔐 Authentication & Authorization

### JWT Token

- **Access Token**: Berlaku 15 menit, digunakan untuk akses endpoint
- **Refresh Token**: Berlaku 7 hari, disimpan di database, bisa dicabut (revoke)

### Roles

| Role      | Description                                                             |
| --------- | ----------------------------------------------------------------------- |
| `user`    | Default role for registered users. Can subscribe, view own data         |
| `admin`   | Full access. Can CRUD plans, view all data, manage users                |
| `finance` | Limited access. Can manage invoices, payments, and view revenue reports |

### Default Accounts (Seeder)

| Email               | Password   | Role    |
| ------------------- | ---------- | ------- |
| admin@example.com   | admin123   | admin   |
| finance@example.com | finance123 | finance |

## 📡 API Endpoints

### Auth

| Method | Endpoint             | Auth | Description              |
| ------ | -------------------- | ---- | ------------------------ |
| POST   | `/api/auth/register` | ❌   | Register new user        |
| POST   | `/api/auth/login`    | ❌   | Login and get tokens     |
| GET    | `/api/auth/profile`  | ✅   | Get current user profile |

### Plans

| Method | Endpoint         | Auth | Role  | Description           |
| ------ | ---------------- | ---- | ----- | --------------------- |
| GET    | `/api/plans`     | ❌   | -     | List all active plans |
| GET    | `/api/plans/:id` | ❌   | -     | Get plan details      |
| POST   | `/api/plans`     | ✅   | admin | Create new plan       |
| PUT    | `/api/plans/:id` | ✅   | admin | Update plan           |
| DELETE | `/api/plans/:id` | ✅   | admin | Delete plan           |

### Subscriptions

| Method | Endpoint                        | Auth | Role               | Description           |
| ------ | ------------------------------- | ---- | ------------------ | --------------------- |
| POST   | `/api/subscriptions`            | ✅   | user/admin/finance | Subscribe to plan     |
| GET    | `/api/subscriptions/my`         | ✅   | user/admin/finance | Get my subscriptions  |
| GET    | `/api/subscriptions`            | ✅   | admin              | Get all subscriptions |
| POST   | `/api/subscriptions/upgrade`    | ✅   | user/admin/finance | Upgrade plan          |
| POST   | `/api/subscriptions/downgrade`  | ✅   | user/admin/finance | Downgrade plan        |
| PUT    | `/api/subscriptions/:id/cancel` | ✅   | user/admin         | Cancel subscription   |

### Invoices

| Method | Endpoint                   | Auth | Role               | Description           |
| ------ | -------------------------- | ---- | ------------------ | --------------------- |
| GET    | `/api/invoices/my`         | ✅   | user/admin/finance | Get my invoices       |
| GET    | `/api/invoices/:id`        | ✅   | user/admin/finance | Get invoice details   |
| POST   | `/api/invoices`            | ✅   | admin/finance      | Create invoice        |
| GET    | `/api/invoices`            | ✅   | admin/finance      | Get all invoices      |
| PUT    | `/api/invoices/:id/status` | ✅   | admin/finance      | Update invoice status |

### Payments

| Method | Endpoint                 | Auth | Role               | Description         |
| ------ | ------------------------ | ---- | ------------------ | ------------------- |
| POST   | `/api/payments/simulate` | ✅   | user/admin/finance | Simulate payment    |
| GET    | `/api/payments/my`       | ✅   | user/admin/finance | Get payment history |

### Dashboard

| Method | Endpoint                 | Auth | Role    | Description               |
| ------ | ------------------------ | ---- | ------- | ------------------------- |
| GET    | `/api/dashboard/admin`   | ✅   | admin   | Admin dashboard metrics   |
| GET    | `/api/dashboard/finance` | ✅   | finance | Finance dashboard metrics |

### Setup (One-time)

| Method | Endpoint     | Auth | Description                                        |
| ------ | ------------ | ---- | -------------------------------------------------- |
| GET    | `/api/setup` | ❌   | Initialize database tables (run once after deploy) |

## 🧪 Testing with Postman

1. Import the Postman collection (if available) or create requests manually
2. Set up environment variables:
   - `base_url`: `http://localhost:3000` or your Vercel URL
   - `accessToken`: (auto-filled after login via Post-response script)
3. Login with default accounts to get tokens
4. Use `{{accessToken}}` in Authorization tab for protected endpoints

### Auto-save Token Script (Post-response)

Add this script to your Login request's **Post-response** tab:

```javascript
const jsonData = pm.response.json();
if (pm.response.code === 200 && jsonData.success && jsonData.data) {
  pm.environment.set("accessToken", jsonData.data.accessToken);
  pm.environment.set("refreshToken", jsonData.data.refreshToken);
  pm.environment.set("userId", jsonData.data.user.id);
  console.log("✅ Token saved successfully");
}
```

## 🚀 Deployment

### Vercel + filess.io (Recommended for Free Tier)

1. **Prepare for Vercel:**
   - Ensure `server.js` exports `app` (not `app.listen`)
   - Create `vercel.json` in root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

2. **Setup filess.io Database:**
   - Create MySQL database at [filess.io](https://filess.io)
   - Copy credentials to Vercel Environment Variables

3. **Deploy:**

```bash
npm i -g vercel
vercel
```

4. **Initialize Database:**
   - Visit `https://your-app.vercel.app/api/setup` once
   - Tables will be auto-created

5. **Set Environment Variables in Vercel Dashboard:**
   - Go to Project Settings → Environment Variables
   - Add all variables from `.env`

## ⚠️ Important Notes for Vercel Deployment

- **Connection Limit**: Set `connectionLimit: 2` in `database.js` for free tier databases
- **No Cron Jobs**: Vercel serverless does not support `node-cron`. Use external services like cron-job.org for scheduled tasks
- **SSL Required**: Most cloud databases require SSL connection
- **Cold Start**: First request after idle may be slower due to serverless cold start

## 🐛 Troubleshooting

| Error                        | Cause                   | Solution                            |
| ---------------------------- | ----------------------- | ----------------------------------- |
| `Cannot find module`         | Missing dependency      | Run `npm install`                   |
| `max_user_connections`       | Too many DB connections | Set `connectionLimit: 2`            |
| `Token expired`              | JWT expired             | Login again to get new token        |
| `Akses ditolak`              | Wrong role              | Use correct account (admin/finance) |
| `Database connection failed` | Wrong credentials       | Check `.env` or Vercel env vars     |
| `Unknown column`             | Schema mismatch         | Run `/api/setup` or check migration |

## 📄 License

This project is for educational purposes (Backend Development course).

## 👤 Author

Ahmad Fachri Albar  
Prodi Sistem Informasi
Telkom University Purwokerto

---

**Status**: ✅ All Complete
**Last Updated**: June 2026
