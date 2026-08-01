# 🥗 Smart‑Fridge & Pantry Assistant

Aplikacja mobilna do zarządzania jedzeniem w lodówce i spiżarni — z naciskiem na
ograniczanie marnowania żywności („Zero Waste"). Skanujesz paragon lub dodajesz
produkty ręcznie, a aplikacja śledzi terminy ważności, przypomina o produktach,
które się kończą, i uczy się na podstawie Twoich potwierdzeń (Daily Check).

> Monorepo: **backend** (FastAPI, async) + **frontend** (React Native / Expo).

---

## ✨ Funkcje

- **Konta i logowanie** — rejestracja, JWT (access + refresh).
- **Spiżarnia** — pełny CRUD produktów, filtrowanie, wyszukiwanie, automatyczny
  status (`świeże` / `kończące się` / `przeterminowane`) liczony z terminu ważności.
- **Skanowanie paragonu** — zdjęcie paragonu → produkty dodawane automatycznie
  (OCR + AI). Działa też w **trybie demo** bez żadnego modelu AI.
- **Kamera / IoT** — analiza świeżości produktu ze zdjęcia.
- **Daily Check** — szybkie TAK/NIE dla produktów; odpowiedzi zasilają
  personalizację AI (few‑shot).
- **Kategorie** — wbudowane kategorie z ikonami (Dairy, Vegetables, Meat…).
- **Model freemium** — limit darmowych skanów / miesiąc, Premium przez Stripe.
- **Zadania w tle** — Celery (reset limitów, przeliczanie statusów) — opcjonalnie.

---

## 🧱 Architektura

```
Smart-Kitchen-Manager/
├── backend/                    # FastAPI (async, SQLAlchemy 2.0)
│   ├── app/
│   │   ├── api/v1/routes/      # auth, items, categories, upload, scans, payments
│   │   ├── core/               # config, database, security, logging, seed
│   │   ├── models/             # ORM (User, FoodItem, Category, ScanHistory, …)
│   │   ├── repositories/       # warstwa dostępu do danych
│   │   ├── schemas/            # Pydantic (walidacja / serializacja)
│   │   ├── services/           # logika (food, ai, payment, scan_processing)
│   │   └── tasks/              # Celery (opcjonalnie)
│   └── tests/                  # pytest (20 testów)
├── frontend/                   # React Native / Expo (TypeScript)
│   └── src/
│       ├── api/client.ts       # jeden klient API (fetch)
│       ├── store/              # Zustand (auth, pantry)
│       ├── screens/            # ekrany aplikacji
│       └── navigation/         # nawigacja (taby + stack)
└── docker-compose.yml          # db + redis + app + worker + beat + flower
```

**Zasada działania backendu:** `Routes → Services → Repositories → ORM`. Skany są
przetwarzane **inline** (bez Redis) albo przez **Celery** — sterowane flagą
`USE_CELERY`. AI ma **tryb demo** (`AI_DEMO_MODE`), więc cała aplikacja działa
end‑to‑end bez żadnej zewnętrznej infrastruktury.

---

## 🚀 Szybki start (tryb dev, bez Dockera)

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt      # lekki zestaw: SQLite + demo AI

# opcjonalnie konfiguracja:
cp ../.env.example .env                   # domyślne wartości są OK dla dev

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Dokumentacja API (Swagger): http://localhost:8000/docs
- Baza: SQLite `./kitchen.db` tworzona automatycznie, kategorie są seedowane.
- Domyślnie `AI_DEMO_MODE=true` i `USE_CELERY=false` → skanowanie działa od razu.

### 2. Frontend

```bash
cd frontend
npm install

# Ustaw adres backendu widoczny z telefonu (LAN IP, nie localhost):
export EXPO_PUBLIC_API_URL="http://<TWOJE_IP_LAN>:8000"

npm run start        # Expo — zeskanuj QR w Expo Go, lub 'w' dla web
```

---

## 🐳 Uruchomienie przez Docker (pełny stack)

```bash
cp .env.example .env          # ustaw SECRET_KEY itd.
docker compose up --build
```

Podnosi: PostgreSQL, Redis, API (uvicorn), Celery worker + beat, Flower.
W produkcji ustaw `ENVIRONMENT=production`, `USE_CELERY=true` oraz prawdziwe
klucze (Stripe / model AI).

---

## 🔌 Przegląd API (`/api/v1`)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| POST | `/auth/register` | Rejestracja |
| POST | `/auth/token` | Logowanie (OAuth2 password) → tokeny |
| POST | `/auth/refresh` | Odświeżenie tokenu |
| GET  | `/auth/me` | Bieżący użytkownik |
| GET/POST | `/items/` | Lista / dodanie produktu |
| GET/PATCH/DELETE | `/items/{id}` | Szczegóły / edycja / usunięcie |
| GET | `/items/expiring?days=3` | Produkty kończące się |
| GET | `/items/pending-verification` | Do sprawdzenia (Daily Check) |
| POST | `/items/{id}/verify` | Potwierdzenie TAK/NIE (+ feedback AI) |
| GET | `/categories/` | Lista kategorii |
| POST | `/upload/receipt` | Skan paragonu (→ produkty) |
| POST | `/upload/camera` | Analiza świeżości ze zdjęcia |
| GET | `/scans/` | Historia skanów |
| POST | `/payments/checkout` | Stripe Checkout (Premium) |

---

## 🧪 Testy

Backend pokryty testami integracyjnymi (httpx + pytest, SQLite, AI w trybie demo):

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
```

Pokrycie: autoryzacja, CRUD produktów (z izolacją per‑użytkownik), przeliczanie
statusów, Daily Check + feedback AI, seed kategorii, skan paragonu inline,
limit freemium.

Frontend — statyczna weryfikacja typów:

```bash
cd frontend
npx tsc --noEmit
```

---

## ⚙️ Konfiguracja (najważniejsze zmienne `.env`)

| Zmienna | Domyślnie | Znaczenie |
|---------|-----------|-----------|
| `ENVIRONMENT` | `development` | dev → SQLite; prod → PostgreSQL |
| `USE_CELERY` | `false` | `true` = przetwarzanie skanów przez Celery/Redis |
| `AI_DEMO_MODE` | `true` | `false` = użyj prawdziwego modelu (OpenAI/Ollama) |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` | Ollama | endpoint zgodny z OpenAI |
| `FREE_TIER_SCAN_LIMIT` | `10` | limit skanów/mies. dla konta free |
| `SECRET_KEY` | — | **zmień w produkcji** (`openssl rand -hex 64`) |

Pełna lista: `.env.example`.

---

## 🛣️ Dalszy rozwój (pomysły)

- Podłączenie prawdziwego modelu vision (wyłączenie `AI_DEMO_MODE`).
- Ekran „Resztki" oparty o realne składniki ze spiżarni.
- Powiadomienia push o kończących się terminach.
- Migracje Alembic zamiast auto‑create w produkcji.
