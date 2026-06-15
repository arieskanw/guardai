# AI Code Guardian

> Review AI-generated code like a senior dev — framework-aware reviews, auto-generated tests, dan OWASP security scan untuk era *vibe coding* (Cursor, Claude Code, Lovable, dll).

AI Code Guardian adalah platform berbasis web yang membantu developer & tim memvalidasi kode hasil AI sebelum di-merge ke production. Aplikasi ini menggabungkan code review otomatis, generator unit test, dan pemindai keamanan (OWASP-aware) dalam satu workflow, lengkap dengan integrasi GitHub App untuk review otomatis pada pull request.

---

## ✨ Fitur Utama

- **AI Code Review** — analisa kualitas, readability, best-practice, dan code smell. Sadar bahasa & framework (React, Next.js, TanStack, Node, Python, dll).
- **Auto Test Generation** — menghasilkan unit test siap pakai dari snippet kode.
- **Security Scan** — deteksi pola berisiko (OWASP Top-10, secret leakage, injection, dsb) beserta saran perbaikan.
- **Quality Score** — skor 0–100 + ringkasan eksekutif untuk tiap review.
- **History** — semua review tersimpan per-user, bisa dibuka ulang, dibagikan, atau dihapus.
- **GitHub App Integration** — install GitHub App "AI Code Guardian" untuk otomatis review setiap PR pada repo terpilih.
- **Multi-language UI** — bahasa Indonesia & Inggris (i18n built-in).
- **Auth** — email/password + Google OAuth via Lovable Cloud.

---

## 🧱 Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | **TanStack Start v1** (React 19, SSR) di atas Vite 7 |
| Runtime server | Cloudflare Workers (via Lovable Cloud) |
| Styling | Tailwind CSS v4 + shadcn/ui + Radix |
| State / data | TanStack Query v5 |
| Backend (DB, Auth, Storage) | Lovable Cloud (Supabase under the hood) |
| AI | Lovable AI Gateway (`@ai-sdk/openai-compatible`) |
| Validasi | Zod |
| Integrasi | GitHub App (JWT RS256 via `crypto` Node built-in) |

---

# 📄 Product Requirements Document (PRD)

Dokumen PRD ini disimpan langsung di repo agar selalu sinkron dengan implementasi. Setiap perubahan signifikan dicatat di bagian **Changelog** paling bawah.

## 1. Visi Produk

Memberikan "senior dev second opinion" instan untuk kode yang ditulis (atau dihasilkan) oleh AI assistant. Targetnya developer solo, indie hacker, dan tim kecil yang sangat bergantung pada AI coding tools dan butuh safety-net kualitas + keamanan tanpa biaya tinggi seorang reviewer manusia.

## 2. Target Pengguna

1. **Vibe coders** — pengguna Lovable / Cursor / Claude Code / v0 yang men-ship cepat.
2. **Indie hackers & founder teknis** — butuh QA & security check ringan tanpa hire QA.
3. **Tim kecil (2–10 dev)** — butuh PR review otomatis sebelum human reviewer.

## 3. Problem Statement

- Kode hasil AI sering "terlihat benar" tapi mengandung bug halus, anti-pattern, atau celah keamanan.
- Tools review tradisional (SonarQube, Snyk) terlalu berat / mahal / tidak framework-aware untuk workflow vibe coding.
- PR review manual jadi bottleneck saat output AI dipush dalam jumlah besar.

## 4. Goals & Non-Goals

**Goals**
- Review snippet/file dalam < 15 detik dengan output terstruktur (findings, security, tests, score).
- Integrasi GitHub PR review otomatis berbasis GitHub App.
- UX sederhana cukup dengan paste code → klik → hasil.

**Non-Goals (saat ini)**
- IDE plugin (VSCode/JetBrains).
- Refactor multi-file otomatis.
- CI runner sendiri (kita gunakan GitHub Checks).

## 5. User Stories

- *Sebagai developer*, saya bisa paste sebuah file/snippet, memilih bahasa & framework, dan menerima review + tests + temuan security.
- *Sebagai pengguna terdaftar*, saya bisa melihat history review dan membuka kembali detailnya.
- *Sebagai pemilik repo*, saya bisa install GitHub App agar setiap PR direview otomatis.
- *Sebagai pengguna*, saya bisa beralih bahasa UI ID/EN dan login dengan Google.

## 6. Lingkup Fungsional

### 6.1 Authentication
- Email/password + Google OAuth (Lovable Cloud).
- Route `_authenticated/*` dilindungi route gate.

### 6.2 Dashboard (Review Baru)
- Input: judul, bahasa, framework (opsional), kode.
- Output JSON terstruktur:
  - `qualityScore` (0–100)
  - `summary`
  - `findings[]` (severity: critical/high/medium/low/info, line, title, description, suggestion)
  - `security[]` (struktur sama, fokus OWASP)
  - `tests` (string kode test)
- Disimpan ke tabel `reviews` (RLS per `user_id`).

### 6.3 History
- List review user, hapus per item, buka detail (`/history/$id`) dengan tabs Findings / Security / Tests + copy-to-clipboard.

### 6.4 Integrasi GitHub
- Halaman `/integrations`: tombol **Install GitHub App** → redirect ke `https://github.com/apps/<slug>/installations/new`.
- Setelah install, GitHub redirect kembali dengan `installation_id` → disimpan & ditautkan ke user.
- Fallback **Sync (Sinkronkan)** untuk menautkan installation yang tidak terbawa redirect (memakai JWT app + listInstallations).
- Webhook `POST /api/public/github/webhook` memverifikasi signature HMAC-SHA256 dan memproses event PR.

### 6.5 i18n
- `src/lib/i18n.tsx`, dua bahasa: `id`, `en`.

## 7. Arsitektur

```
React 19 (TanStack Router)  ──►  Server Functions (createServerFn)
        │                              │
        ▼                              ▼
   TanStack Query             Lovable Cloud (Postgres + Auth)
        │                              │
        ▼                              ▼
   Lovable AI Gateway          GitHub REST API (App JWT RS256)
```

- **`src/lib/*.functions.ts`** — server functions (RPC dari client).
- **`src/lib/*.server.ts`** — helper khusus server (kunci API, JWT, admin client).
- **`src/routes/api/public/github.webhook.ts`** — server route untuk webhook GitHub.
- Auth middleware: `requireSupabaseAuth` + global `attachSupabaseAuth` di `src/start.ts`.

## 8. Skema Data (ringkas)

- `profiles(id, email, full_name, created_at)`
- `user_roles(user_id, role)` — pakai security-definer `has_role()`.
- `reviews(id, user_id, title, language, framework, code, result jsonb, quality_score, findings_count, security_issues_count, created_at)`
- `github_installations(id, user_id, installation_id, account_login, account_type, created_at)`

Semua tabel: RLS ON, GRANT eksplisit untuk `authenticated` & `service_role`.

## 9. Keamanan

- RLS di semua tabel `public.*`.
- Role disimpan di `user_roles` (tidak di profiles) untuk cegah privilege escalation.
- Webhook GitHub diverifikasi dengan HMAC timing-safe.
- GitHub App private key disimpan sebagai secret server-side; JWT dibuat dengan `crypto.createSign("RSA-SHA256")`.
- Tidak ada anonymous sign-up; tidak ada auto-confirm email kecuali diminta.

## 10. Metrik Sukses

- TTFR (time to first review) < 15 detik p95.
- ≥ 70% review punya minimal 1 finding actionable.
- ≥ 30% user mengaktifkan GitHub App dalam 7 hari pertama.

## 11. Roadmap

- [ ] PR comment otomatis (inline) dari hasil review.
- [ ] Custom rule per-repo / per-tim.
- [ ] Billing & paket berbayar (Stripe).
- [ ] Webhook untuk Slack / Discord.
- [ ] Plugin VSCode.

---

## 🗒️ Changelog PRD & Implementasi

### 2026-06-15
- **Docs**: Menambahkan `README.md` + PRD lengkap di repo.
- **Fix**: `getGithubConfig` sekarang menormalkan `GITHUB_APP_SLUG` (menerima slug murni *atau* URL `https://github.com/apps/<slug>/...`) untuk mencegah URL ganda saat klik **Install GitHub App**.
- **Fix**: Pembuatan JWT GitHub App pindah ke `crypto.createSign("RSA-SHA256")` + `createPrivateKey` (mendukung RSA & PKCS#8) menggantikan `jose.importPKCS8` yang sempat gagal di runtime.
- **Feature**: Tombol **Sync (Sinkronkan)** di halaman `/integrations` — menautkan installation yang sudah ada di GitHub tapi belum tercatat di akun user.
- **i18n**: Menambahkan string terjemahan untuk fitur sync.

### 2026-06-13
- **Feature**: Integrasi GitHub App (install flow, callback, webhook publik `/api/public/github/webhook`).
- **DB**: Migrasi `github_installations` + RLS + GRANT.

### Rilis Awal
- **MVP**: Auth (email + Google), Dashboard review, History, hasil review terstruktur (findings/security/tests/score), i18n ID/EN, landing page + pricing + FAQ.

---

## 🚀 Menjalankan Secara Lokal

```bash
bun install
bun run dev
```

Aplikasi memakai Lovable Cloud — variabel `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, dan `VITE_SUPABASE_PROJECT_ID` sudah terisi otomatis di `.env`. Untuk fitur GitHub App, set secret berikut di Lovable Cloud:

- `GITHUB_APP_ID`
- `GITHUB_APP_SLUG` (boleh slug murni atau URL install)
- `GITHUB_APP_PRIVATE_KEY` (PEM)
- `GITHUB_APP_WEBHOOK_SECRET`

## 📁 Struktur Direktori (ringkas)

```
src/
├── routes/                    # File-based routing (TanStack Start)
│   ├── __root.tsx
│   ├── index.tsx              # Landing page
│   ├── auth.tsx
│   ├── _authenticated/        # Route group dengan auth gate
│   │   ├── dashboard.tsx
│   │   ├── history.tsx
│   │   ├── history.$id.tsx
│   │   └── integrations.tsx
│   └── api/public/
│       └── github.webhook.ts  # Webhook GitHub
├── lib/
│   ├── review.functions.ts    # Server fn: create/list/get/delete review
│   ├── github.functions.ts    # Server fn: install URL, sync, config
│   ├── github.server.ts       # JWT App + helper REST
│   ├── ai-gateway.server.ts   # Lovable AI Gateway provider
│   └── i18n.tsx
└── integrations/supabase/     # Auto-generated, jangan diedit
```

## 📜 Lisensi

Proprietary — © AI Code Guardian.
