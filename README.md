# SPMT Pelindo - Sistem Manajemen Data Pelindo

Aplikasi web untuk manajemen data SPMT (Sistem Pengelolaan Manajemen Tenaga), IKT, PTP, dan TCU di lingkungan Pelindo.

## Arsitektur Sistem

### Framework & Teknologi Utama

#### Frontend Framework
- **Next.js 15.4.6** - React framework dengan App Router
- **React 19.1.0** - Library UI untuk membangun antarmuka pengguna
- **TypeScript 5** - Superset JavaScript dengan type safety
- **Tailwind CSS 4** - Utility-first CSS framework untuk styling

#### Backend Framework
- **Next.js API Routes** - Serverless API endpoints menggunakan Next.js App Router
- **Node.js** - Runtime environment untuk JavaScript
- **Express** (implisit melalui Next.js) - Web framework

### Bahasa Pemrograman
- **TypeScript** - Bahasa pemrograman utama untuk type-safe development
- **JavaScript** - Digunakan untuk scripts dan konfigurasi

### Database

#### Database Management System
- **MySQL** - Relational database management system

#### ORM & Database Tools
- **Prisma 6.13.0** - Next-generation ORM untuk TypeScript
  - Prisma Client untuk query database
  - Prisma Migrate untuk schema migration
- **mysql2 3.14.3** - MySQL client untuk Node.js dengan Promise support

#### Struktur Database
- **User Management**: Tabel `User` dengan role-based access (ADMIN, USER)
- **SPMT Data**: Tabel `SpmtData` untuk data SPMT
- **Regional Data**: Tabel `Daerah` untuk data regional
- **BOPO Tables**: 
  - `bopo_spmt` - BOPO data untuk SPMT
  - `bopo_ikt` - BOPO data untuk IKT
  - `bopo_ptp` - BOPO data untuk PTP
  - `bopo_tcu` - BOPO data untuk TCU
- **Struktur Organisasi**: 
  - `struktur_organisasi` - Struktur organisasi SPMT
  - `ptp_struktur_organisasi` - Struktur organisasi PTP
  - `ikt_struktur_organisasi` - Struktur organisasi IKT
  - `tcu_struktur_organisasi` - Struktur organisasi TCU
- **Regional Tables**:
  - `daerah` - Data daerah SPMT
  - `ptp_daerah` - Data daerah PTP
  - `tcu_daerah` - Data daerah TCU

### Library & Dependencies Utama

#### Authentication & Security
- **bcryptjs 2.4.3** - Password hashing untuk keamanan
- **Google Auth Library 10.2.1** - OAuth2 authentication dengan Google

#### Data Processing
- **xlsx 0.18.5** - Excel file parsing dan generation
- **csv-parse 6.1.0** - CSV file parsing
- **formidable 3.5.4** - File upload handling

#### Document Generation
- **jspdf 2.5.2** - PDF generation dari JavaScript
- **jspdf-autotable 3.8.4** - Plugin untuk tabel di PDF
- **docx 9.5.1** - Word document generation
- **puppeteer 22.10.0** - Headless browser untuk PDF generation
- **html2canvas 1.4.1** - Convert HTML ke canvas/image
- **canvas 3.2.0** - Canvas API untuk Node.js

#### Data Visualization
- **chart.js 4.5.0** - Chart library
- **react-chartjs-2 5.3.0** - React wrapper untuk Chart.js
- **chartjs-plugin-datalabels 2.2.0** - Plugin untuk data labels di chart

#### UI Components & Icons
- **lucide-react 0.544.0** - Icon library
- **react-icons 5.5.0** - Popular icons untuk React
- **reactflow 11.11.4** - Interactive node-based graphs (untuk org chart)

#### External Services Integration
- **googleapis 155.0.1** - Google APIs client library
  - Google Sheets API - Untuk import data dari spreadsheet
  - Google Drive API - Untuk file management

#### Utilities
- **date-fns 4.1.0** - Date utility library

### Struktur Aplikasi

```
spmt_pelindo/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API Routes (Backend)
│   │   │   ├── admin/          # Admin API endpoints
│   │   │   │   ├── (SPMT)/     # SPMT related APIs
│   │   │   │   ├── (IKT)/      # IKT related APIs
│   │   │   │   ├── (PTP)/      # PTP related APIs
│   │   │   │   ├── (TCU)/      # TCU related APIs
│   │   │   │   └── (Combined)/ # Combined dashboard APIs
│   │   │   ├── auth/           # Authentication APIs
│   │   │   └── user/           # User APIs
│   │   ├── admin/              # Admin pages (Frontend)
│   │   │   ├── (SPMT)/         # SPMT admin pages
│   │   │   ├── (IKT)/          # IKT admin pages
│   │   │   ├── (PTP)/          # PTP admin pages
│   │   │   └── (TCU)/          # TCU admin pages
│   │   ├── user/               # User pages (Frontend)
│   │   ├── login/              # Login page
│   │   └── page.tsx            # Home page
│   ├── components/             # Reusable React components
│   │   ├── AdminSidebar.tsx
│   │   ├── UserSidebar.tsx
│   │   ├── Navbar.tsx
│   │   ├── OrgChart.tsx
│   │   └── DashboardOrgChart.tsx
│   ├── lib/                    # Utility libraries
│   │   ├── prisma.ts           # Prisma client instance
│   │   ├── db-config.ts        # Database configuration
│   │   └── google-drive-config.ts # Google Drive/Sheets config
│   ├── types/                  # TypeScript type definitions
│   └── utils/                  # Utility functions
├── prisma/                     # Prisma ORM
│   ├── schema.prisma           # Database schema
│   ├── migrations/             # Database migrations
│   └── seed/                   # Database seed files
├── public/                     # Static assets
│   └── uploads/                # Uploaded files
│       ├── org-photos/         # Organization photos
│       ├── struktur-organisasi/ # Org structure files
│       └── ptp-struktur-organisasi/ # PTP org structure files
├── scripts/                    # Database & utility scripts
│   ├── *.sql                   # SQL scripts
│   └── *.ps1                   # PowerShell scripts
└── package.json                # Dependencies & scripts
```

### API Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/google` - Google OAuth initiation
- `GET /api/auth/google/callback` - Google OAuth callback

#### Admin APIs

**SPMT (Sistem Pengelolaan Manajemen Tenaga)**
- `GET /api/admin/(SPMT)/spmt-data` - Get SPMT data
- `POST /api/admin/(SPMT)/upload-spmt-data` - Upload SPMT data
- `GET /api/admin/(SPMT)/bopo-spmt` - Get BOPO SPMT data
- `POST /api/admin/(SPMT)/upload-bopo-spmt` - Upload BOPO SPMT
- `GET /api/admin/(SPMT)/dashboard-stats` - Dashboard statistics
- `GET /api/admin/(SPMT)/spmt-table-data` - Table data for SPMT
- `GET /api/admin/(SPMT)/daerah` - Get regional data
- `GET /api/admin/(SPMT)/available-months` - Available months for filtering

**IKT (Indikator Kinerja Teknologi)**
- `GET /api/admin/(IKT)/ikt-table-data` - Get IKT table data
- `POST /api/admin/(IKT)/upload-ikt-data` - Upload IKT data
- `GET /api/admin/(IKT)/bopo-ikt-dashboard` - BOPO IKT dashboard
- `POST /api/admin/(IKT)/upload-bopo-ikt` - Upload BOPO IKT
- `GET /api/admin/(IKT)/ikt-dashboard-stats` - IKT dashboard statistics
- `GET /api/admin/(IKT)/ikt-available-months` - Available months

**PTP (Pelabuhan Tanjung Priok)**
- `GET /api/admin/(PTP)/ptp-table-data` - Get PTP table data
- `POST /api/admin/(PTP)/upload-ptp-data` - Upload PTP data
- `GET /api/admin/(PTP)/bopo-ptp-dashboard` - BOPO PTP dashboard
- `POST /api/admin/(PTP)/upload-bopo-ptp` - Upload BOPO PTP
- `GET /api/admin/(PTP)/ptp-daerah` - Get PTP regional data
- `GET /api/admin/(PTP)/ptp-struktur-organisasi` - Get PTP org structure
- `POST /api/admin/(PTP)/ptp-struktur-organisasi/upload` - Upload org structure

**TCU (Terminal Curah Umum)**
- `GET /api/admin/(TCU)/tcu-table-data` - Get TCU table data
- `POST /api/admin/(TCU)/upload-tcu-data` - Upload TCU data
- `GET /api/admin/(TCU)/bopo-tcu-dashboard` - BOPO TCU dashboard
- `POST /api/admin/(TCU)/upload-bopo-tcu` - Upload BOPO TCU
- `GET /api/admin/(TCU)/tcu-daerah` - Get TCU regional data

**Combined Dashboard**
- `GET /api/admin/(Combined)/combined-bopo-dashboard` - Combined BOPO dashboard
- `GET /api/admin/(Combined)/combined-dashboard-stats` - Combined statistics
- `GET /api/admin/(Combined)/combined-table-data` - Combined table data

**User Management**
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create user
- `GET /api/admin/users/[id]` - Get user by ID
- `PUT /api/admin/users/[id]` - Update user
- `POST /api/admin/users/[id]/toggle-status` - Toggle user status

**Storage & File Management**
- `GET /api/admin/storage/datasets` - Get datasets
- `POST /api/admin/storage/upload` - Upload files
- `GET /api/admin/storage/datasets/[id]` - Get dataset by ID

#### User APIs
- `GET /api/user/dashboard-stats` - User dashboard statistics
- `GET /api/user/table-data` - User table data

### Fitur Utama

1. **Manajemen Data SPMT, IKT, PTP, TCU**
   - Upload data dari Excel/CSV
   - Import dari Google Sheets
   - Data visualization dengan charts
   - Export ke PDF/Excel

2. **BOPO (Biaya Operasional terhadap Pendapatan Operasional)**
   - Upload dan manajemen data BOPO
   - Dashboard BOPO untuk setiap unit
   - Analisis dan reporting

3. **Struktur Organisasi**
   - Upload struktur organisasi
   - Visualisasi org chart
   - Manajemen posisi dan jabatan
   - Export struktur ke PDF

4. **Dashboard & Reporting**
   - Dashboard terintegrasi untuk semua unit
   - Statistik real-time
   - Filter berdasarkan periode dan regional
   - Export laporan

5. **User Management**
   - Role-based access control (Admin/User)
   - User authentication
   - Google OAuth integration

### Environment Variables

```env
# Database Configuration
DATABASE_URL=mysql://user:password@host:port/database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=spmt_pelindo
DB_PORT=3306

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Cloudflare Turnstile (Optional - untuk CAPTCHA pada halaman login)
# Jika tidak dikonfigurasi, verifikasi CAPTCHA akan di-skip (untuk development)
NEXT_PUBLIC_CLOUDFLARE_SITE_KEY=your_site_key
CLOUDFLARE_SECRET_KEY=your_secret_key

# Application
NODE_ENV=development
```

### Cloudflare Turnstile (Optional)

Aplikasi menggunakan Cloudflare Turnstile untuk verifikasi CAPTCHA pada halaman login. Fitur ini **opsional** dan tidak wajib dikonfigurasi:

- **PENTING**: Test key (`1x00000000000000000000AA`) akan **selalu auto-verify** tanpa memerlukan interaksi user. Untuk memastikan user benar-benar harus klik widget, **WAJIB menggunakan Site Key yang sebenarnya** dari Cloudflare.

- **Development**: 
  - Jika `CLOUDFLARE_SECRET_KEY` tidak dikonfigurasi, verifikasi CAPTCHA akan di-skip dan login tetap berfungsi normal
  - Jika menggunakan test key, widget akan auto-verify (tidak memerlukan klik user)
  
- **Production**: **WAJIB** menggunakan real Site Key untuk keamanan:
  1. Daftar di [Cloudflare Dashboard](https://dash.cloudflare.com/)
  2. Buat Turnstile site dan dapatkan Site Key dan Secret Key
  3. Tambahkan ke environment variables:
     - `NEXT_PUBLIC_CLOUDFLARE_SITE_KEY` - Site key (public, digunakan di frontend) - **WAJIB real key, bukan test key**
     - `CLOUDFLARE_SECRET_KEY` - Secret key (private, digunakan di backend)
  4. Dengan real Site Key, widget akan memerlukan user untuk **klik widget** sebelum verifikasi berhasil

### Development Tools

- **ESLint** - Code linting
- **TypeScript** - Type checking
- **Prisma Studio** - Database GUI (via `npx prisma studio`)

### Scripts

```bash
# Development
npm run dev          # Start development server

# Build & Production
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run prisma:generate  # Generate Prisma Client
npm run prisma:db:push   # Push schema to database
npm run prisma:seed      # Seed database

# Linting
npm run lint         # Run ESLint
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/login/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
