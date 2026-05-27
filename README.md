# Flödet

![CI](https://github.com/Elli2022/community-auth-forum/actions/workflows/ci.yml/badge.svg)

**Fullstack socialt nätverk** — profiler, nyhetsflöde, vänner, direktmeddelanden (DM), notiser och kontoåterställning. Utvecklat som vidareutveckling av utbildningsprojektet *nodejs-3rd-challenge-api*; hela git-historiken finns kvar.

| | |
|---|---|
| **Live** | [community-auth-forum.netlify.app](https://community-auth-forum.netlify.app) |
| **API-spec** | [docs/openapi.yaml](docs/openapi.yaml) · [YAML på prod](https://community-auth-forum.netlify.app/openapi.yaml) |
| **Stack** | Node.js 20+ · TypeScript · Express · PostgreSQL (Neon) · Netlify Functions |
| **CI** | GitHub Actions: `npm ci` → audit → build → tests (Postgres service) |

---

## Screenshots

![Flödet feed](public/screenshots/feed.svg)
![Flödet profile](public/screenshots/profile.svg)
![Flödet messages](public/screenshots/messages.svg)

> Tips: ersätt filerna i `public/screenshots/` med riktiga appbilder (samma filnamn) så uppdateras README automatiskt.

---

## Arkitektur

Produktion: statisk SPA i Netlify CDN, API via serverless proxy till Express. Databas: Neon PostgreSQL (serverless driver).

```mermaid
flowchart TB
  subgraph client [Klient]
    SPA["SPA (public/)<br/>Hash-routing · fetch API"]
  end

  subgraph netlify [Netlify]
    CDN["CDN · statiska filer"]
    FN["Function: api.ts<br/>serverless-http"]
    REDIR["Redirects<br/>/api/* → function<br/>/health → function"]
  end

  subgraph app [Express app – build/]
    HELMET["helmet · cors · compression"]
    AUTH["JWT middleware<br/>requireAuth · requireSelf"]
    UC["Use cases<br/>controller → repository"]
  end

  subgraph data [Data]
    NEON[(Neon PostgreSQL)]
    TABLES["users · wall_posts<br/>post_likes · post_comments<br/>friendships · direct_messages<br/>notifications · password_reset_tokens"]
  end

  SPA --> CDN
  SPA --> REDIR
  REDIR --> FN
  FN --> HELMET
  HELMET --> AUTH
  AUTH --> UC
  UC --> NEON
  NEON --> TABLES
```

### Lager i kodbasen

| Lager | Ansvar |
|--------|--------|
| `public/` | SPA (ingen build-step för UI) |
| `netlify/functions/api.ts` | Lambda-entry, kör `ensureSchema()` vid cold start |
| `src/app/component/controller/` | HTTP-rutter, statuskoder, svar `{ err, data }` |
| `src/app/component/use-cases/` | Affärslogik (auth, feed, vänner, DM, …) |
| `src/app/db/` | Repositories + migrering (`migrate.ts`) |
| `src/app/middleware/` | JWT (`requireAuth`, `requireSelf`, `optionalAuth`) |

---

## Funktioner (produkt)

- **Auth** — registrering, JWT-inloggning, glömt lösenord/användarnamn via registrerad e-post
- **Profiler** — avatar (förval eller uppladdning), omslagsfärg, bio, egen tidslinje
- **Flöde** — personligt flöde (vänner + du) eller global vägg
- **Socialt** — gilla, kommentera, dela inlägg; vänförfrågningar
- **DM** — direktmeddelanden mellan accepterade vänner (konversationer + olästa)
- **Notiser** — likes, kommentarer, delningar, vänner, nya meddelanden
- **Säkerhet** — endast ägare kan PATCH/DELETE egen profil

---

## Säkerhet

| Område | Implementation |
|--------|----------------|
| **Lösenord** | bcrypt (cost factor 10), lagras som `password_hash` |
| **Session** | JWT (`jsonwebtoken`), Bearer-header, 7 dagars TTL; `JWT_SECRET` i miljö |
| **Input** | `sanitize-html` på textfält (inga HTML-taggar i bio, inlägg, kommentarer) |
| **Användarnamn** | Regex `^[a-z][a-z0-9]{4,23}$` — separat från e-post |
| **Bilder** | data-URL validering (JPEG/PNG/WebP, max ~400 KB) |
| **HTTP** | `helmet`, CORS, JSON body limit 3 MB |
| **Auktorisering** | `requireSelf` på profil-ändring/radering; DM endast mellan vänner |
| **Återställning** | Engångstoken i DB, 1 h giltighet, ogiltigförklaras efter användning |
| **API-svar** | Lösenord och hash exponeras aldrig i JSON |

**Produktion:** sätt stark `JWT_SECRET` och `DATABASE_URL` i Netlify env (aldrig i repo).

---

## API (v1) — översikt

Alla svar: **`{ "err": 0, "data": ... }`** eller **`{ "err": 1, "message": "..." }`**.  
Auth: `Authorization: Bearer <token>` där det krävs.

### Auth & användare

| Metod | Sökväg | Auth | Beskrivning |
|-------|--------|------|-------------|
| GET | `/health` | — | Hälsokontroll |
| GET | `/api/v1/` | — | Lista medlemmar |
| POST | `/api/v1/` | — | Registrera |
| POST | `/api/v1/auth/login` | — | Logga in → JWT |
| POST | `/api/v1/auth/forgot-password` | — | Återställ lösenord (e-post) |
| POST | `/api/v1/auth/forgot-username` | — | Påminnelse användarnamn |
| POST | `/api/v1/auth/reset-password` | — | Nytt lösenord + token |
| GET | `/api/v1/users/:username` | Valfri | Profil + inlägg |
| PATCH | `/api/v1/users/:username` | JWT + self | Uppdatera profil |
| DELETE | `/api/v1/users/:username` | JWT + self | Radera konto |
| GET | `/api/v1/users/:username/avatar` | — | Profilbild (binär) |

### Flöde & inlägg

| Metod | Sökväg | Auth | Beskrivning |
|-------|--------|------|-------------|
| GET | `/api/v1/feed` | Valfri | Nyhetsflöde |
| GET | `/api/v1/wall` | Valfri | Global vägg |
| POST | `/api/v1/wall` | JWT | Skapa inlägg |
| POST | `/api/v1/posts/:id/like` | JWT | Toggle gilla |
| POST | `/api/v1/posts/:id/comments` | JWT | Kommentar |
| POST | `/api/v1/posts/:id/share` | JWT | Dela inlägg |
| GET | `/api/v1/posts/:id/image` | — | Inläggsbild |

### Vänner, notiser, DM

| Metod | Sökväg | Auth | Beskrivning |
|-------|--------|------|-------------|
| GET | `/api/v1/friends` | JWT | Vänner + pending |
| POST | `/api/v1/friends/request` | JWT | Vänförfrågan |
| POST | `/api/v1/friends/accept` | JWT | Acceptera |
| GET | `/api/v1/notifications` | JWT | Notiser |
| PATCH | `/api/v1/notifications/read` | JWT | Markera lästa |
| GET | `/api/v1/messages` | JWT | **DM:** konversationer |
| GET | `/api/v1/messages/:username` | JWT | **DM:** tråd |
| POST | `/api/v1/messages/:username` | JWT | **DM:** skicka |

Full spec: **[docs/openapi.yaml](docs/openapi.yaml)** (OpenAPI 3.1).

---

## Datamodell (PostgreSQL)

```
users ──┬──< wall_posts ──┬──< post_likes
        │                 └──< post_comments
        ├──< friendships (user_a, user_b, status)
        ├──< direct_messages (sender, recipient)
        ├──< notifications
        └──< password_reset_tokens

wall_posts.shared_post_id → wall_posts (delning)
```

Migrering körs idempotent vid appstart (`ensureSchema()` + advisory lock för parallella Netlify-körningar).

---

## Kom igång lokalt

```bash
git clone https://github.com/Elli2022/community-auth-forum.git
cd community-auth-forum
cp .env.example .env
npm install
npm run db:up          # Docker PostgreSQL
npm run db:migrate     # valfritt – sker även vid start
npm run dev            # API + statisk UI på :3000
```

Öppna [http://127.0.0.1:3000](http://127.0.0.1:3000) · profiler: `#/profile/användarnamn` · DM: `#/messages`.

Lokal `DATABASE_URL` mot `localhost` använder `pg`; Neon-URL i produktion använder `@neondatabase/serverless`.

### Tester

```bash
npm test               # kräver DATABASE_URL (t.ex. Docker)
```

### Bygga som Netlify

```bash
npm run build
netlify deploy --prod --build
```

---

## Miljövariabler

| Variabel | Krävs | Beskrivning |
|----------|-------|-------------|
| `DATABASE_URL` | Ja | PostgreSQL (Neon eller `postgresql://auth:auth@localhost:5432/authms`) |
| `JWT_SECRET` | Prod | Stark hemlighet för JWT |
| `PUBLIC_SITE_URL` | Prod | Bas-URL för återställningslänkar |
| `NODE_PORT` | Nej | Default `3000` |
| `RESEND_API_KEY` | Nej | E-post (återställning); utan → länk visas i UI |
| `EMAIL_FROM` | Nej | Avsändare vid Resend |

---

## Resend setup (Netlify)

1. Gå till Netlify-site `community-auth-forum` → **Site configuration** → **Environment variables**.
2. Lägg till:
   - `RESEND_API_KEY` = din Resend API key
   - `EMAIL_FROM` = verifierad avsändare, t.ex. `Flödet <noreply@din-domän.se>`
   - `PUBLIC_SITE_URL` = `https://community-auth-forum.netlify.app`
3. Deploya om (`Trigger deploy`), testa sedan:
   - `#/forgot-password`
   - `#/forgot-username`

I produktion exponeras inte dev-fallback (`dev_reset_url` / `dev_username`) om e-postutskick misslyckas.

---

## Projektstruktur

```
├── public/                 # SPA (Flödet UI)
├── netlify/
│   ├── functions/api.ts    # Serverless entry
│   └── netlify.toml        # Redirects /api → function
├── src/app/
│   ├── component/          # controller, use-cases, entities
│   ├── db/                 # repositories, migrate, client
│   ├── middleware/         # JWT
│   └── libs/               # auth, email, image, logger
├── docs/openapi.yaml
├── scripts/migrate.ts
└── docker-compose.yml      # Lokal Postgres
```

---

## Designbeslut (kort)

1. **Monolitisk Express i en function** — en deploy-enhet, enklare för portfolio; skalning via Netlify + Neon.
2. **Repository + use cases** — testbar domänlogik utan att byta till tung DDD.
3. **JWT stateless** — passar serverless; ingen session-store.
4. **Bilder i DB som data-URL** — undviker S3/Netlify Blobs i MVP; begränsad storlek med validering.
5. **DM endast mellan vänner** — minskar spam/harassment-yta i demo.

---

## Historik

| Fas | Namn |
|-----|------|
| Utbildning | `nodejs-3rd-challenge-api` |
| Portfolio | `community-auth-forum` (repo) · **Flödet** (produktnamn) |

---

## Licens

ISC (se `package.json`).
