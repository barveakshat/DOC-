<div align="center">
	<img src="public/favicon.ico" alt="Doc+ Logo" width="80" height="80" style="border-radius: 10px;">
	<h1>Doc+ (Doc Plus)</h1>
	<p><strong>AI‑assisted medical collaboration platform for doctors and patients.</strong></p>
	<p>Secure onboarding • Patient management • Doctor ↔ Patient chat • AI clinical assistant • Email invitations</p>
</div>

---

## ✨ Overview

Doc+ is a full‑stack TypeScript React application that helps doctors manage patients, collaborate, and leverage AI safely for clinical context, summaries, and guidance. Patients can register (self or invited), view their profile, and interact with their doctor. Doctors gain tooling for structured onboarding, patient linking, and AI‑augmented chat.

## 📺 Demo Video

(https://youtu.be/s5PCMi7bwoc?si=2W32JhznSDeJgtJU)

Check out our demo video to see Doc+ in action!

## 🔍 Core Features

- Role-based experience (Doctor / Patient) with guided onboarding
- Secure auth using Clerk + Supabase profile linkage
- Patient invitation & temporary password email flows (Supabase Edge Functions + Resend)
- Doctor ↔ Patient real-time style chat UI (with session context)
- AI assistant modes:
  - AI Doctor assistant (clinical insights, treatment reasoning)
  - AI Patient support (wellness, emotional guidance)
  - Context injection of patient data & uploaded file summaries
- Chat session persistence (Supabase tables `chat_sessions`, `messages`)
- Environment-driven OpenRouter model selection
- Modern UI: React 18, Vite, Tailwind CSS, shadcn-ui, Radix primitives
- Form validation with React Hook Form + Zod
- React Query for async/cache patterns

## 🧱 Tech Stack

| Layer                  | Technology                                  |
| ---------------------- | ------------------------------------------- |
| Frontend Build         | Vite + TypeScript                           |
| UI                     | React 18, Tailwind CSS, shadcn-ui, Radix UI |
| State/Data             | React Query, Context APIs                   |
| Auth                   | Clerk (frontend) + Supabase profile records |
| Backend (DB & Edge)    | Supabase (PostgreSQL, Edge Functions)       |
| AI Integration         | OpenRouter (configurable model)             |
| Email                  | Resend via Supabase Edge Functions          |
| Charts / Visualization | Recharts                                    |
| Testing                | Vitest, @testing-library/react              |

## 📁 Project Structure (Key Paths)

```
src/
	components/           Reusable UI + feature components
	pages/                Route-level components (dashboards, chat, onboarding)
	contexts/             React Context (e.g. AuthContext)
	hooks/                Custom hooks (sessions, chat logic, toasts)
	integrations/
		supabase/           Supabase client & generated types
	services/
		openRouterService.ts  AI model interaction layer
supabase/
	functions/            Edge Functions (email flows)
	migrations/           SQL migrations for database schema
public/                 Static assets
```

## ⚙️ Environment Variables

Create a `.env` file (never commit real secrets). All variables prefixed `VITE_` are exposed to the client build by Vite—keep only non-sensitive or publishable keys there.

```
# Supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_or_publishable_key

# Auth (Clerk)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx_or_pk_test_xxx

# AI (OpenRouter)
VITE_OPENROUTER_API_KEY=sk_or_env_value (DO NOT expose if sensitive; proxy if required)
VITE_OPENROUTER_MODEL=openai/gpt-3.5-turbo

# Email / Functions
RESEND_API_KEY=your_resend_key
SITE_URL=https://your-deployed-domain (used in invitation links)
```

Optional: create a `.env.example` mirroring keys for contributors.

## 🛠 Local Development

```pwsh
git clone https://github.com/your-org/doc-plus.git
cd doc-plus
npm install
cp .env.example .env   # or copy manually on Windows
# edit .env with real values
npm run dev
```

App runs at: http://localhost:5173 (default Vite port)

## 🧪 Testing the AI Medical Assistant

### For Doctors: 5 Questions to Test the Medical AI Assistant

**Patient Diagnosis Query:**
> "A 45-year-old male patient presents with chest pain, shortness of breath, and fatigue. What differential diagnoses should I consider, and what immediate tests would you recommend?"

**Treatment Plan Request:**
> "For a patient with Type 2 diabetes and hypertension, what would be an appropriate medication regimen, including dosages and potential side effects?"

**Medical Image Analysis:**
> "I've uploaded an X-ray of a patient's chest. Can you analyze it for signs of pneumonia or other abnormalities and suggest next steps?"

**Medication Interaction Check:**
> "A patient is taking metformin, lisinopril, and atorvastatin. Are there any known interactions, and should I adjust the dosages?"

**Clinical Guidelines Inquiry:**
> "What are the current guidelines for managing acute coronary syndrome in an emergency setting, including thrombolytic therapy options?"

### For Patients: 5 Things to Discuss to Test Both AI Agents

**Stress Management Scenario:**
> "I've been feeling overwhelmed with work lately and having trouble sleeping. Can you help me with some relaxation techniques and stress relief strategies?"

**Emotional Support Request:**
> "I'm going through a difficult breakup and feeling very anxious. I'd like to talk about coping with emotional pain and building resilience."

**Health Anxiety Discussion:**
> "I've been worried about my health after reading about various diseases online. How can I manage health anxiety without constant worry?"

**Lifestyle Changes Query:**
> "I'm trying to improve my mental health through better habits. What are some practical ways to incorporate mindfulness and self-care into my daily routine?"

**Crisis Intervention Test:**
> "I'm feeling really down and having thoughts of not wanting to continue. What should I do, and can you guide me toward professional help?"

## 🚀 Deployment (Vercel)

1. Push repository to GitHub
2. In Vercel: Import → select repo
3. Framework preset: Vite
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Add environment variables (see above)
7. Deploy

`vercel.json` rewrites SPA routes to `index.html` for client routing.

## 📨 Supabase Edge Functions (Email Flows)

Functions:

- `send-patient-invitation` – sends invitation with doctor ID code
- `send-temp-password` – sends temporary password credentials

Deploy (example):

```pwsh
npx supabase functions deploy send-patient-invitation
npx supabase functions deploy send-temp-password
```

Ensure `RESEND_API_KEY` and `SITE_URL` are set in Supabase project settings.

## 🤖 AI Integration

`src/services/openRouterService.ts` centralizes AI calls. Configure:

- `VITE_OPENROUTER_API_KEY`
- `VITE_OPENROUTER_MODEL` (fallback: `openai/gpt-3.5-turbo`)

Includes distinct system prompts for doctor vs patient support contexts and optional patient/file context injection.

## 🔐 Authentication Flow

1. Clerk handles frontend auth + role selection metadata
2. Supabase stores extended profile (doctors / patients) after onboarding
3. `AuthContext` stitches Clerk user + Supabase profile

## 🗃 Database

Supabase migrations live in `supabase/migrations/`. Apply locally:

```pwsh
npx supabase start          # if using local stack
npx supabase migration up   # applies migrations
```

## 📬 Email & Invitations

Resend is used via Edge Functions. Before production:

- Verify sending domain in Resend
- Update `from:` address in functions if needed
- Confirm `SITE_URL` reflects deployed frontend

## 🧩 Scripts

From `package.json`:
| Script | Purpose |
|--------|---------|
| dev | Start Vite dev server |
| build | Production build |
| build:dev | Dev-mode build (unminified) |
| preview | Preview production build locally |
| lint | Run ESLint |

## 🛡 Security Notes

- Do not ship private API keys in `VITE_` vars if they grant broad access—use a proxy/server if required
- Review system prompts for compliance & medical disclaimers before production
- Add rate limiting & audit logging for AI requests in future iterations

## 🗺 Roadmap Ideas

- File upload & structured medical record ingestion
- Doctor team collaboration & multi-specialty notes
- AI safety: reasoning trace + source citations enforcement
- Medication interaction checker
- Patient mobile-friendly PWA packaging

## 🤝 Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feat/short-description`
3. Commit changes: `git commit -m "feat: add xyz"`
4. Open PR with context & screenshots


## 👥 Connect with our team

| Name                            | LinkedIn                                                 |
| ------------------------------- | -------------------------------------------------------- |
| Akshat Barve                    | https://www.linkedin.com/in/akshatbarve/                 |
| Arnish Baruah                   | https://www.linkedin.com/in/arnishbaruah/                |
| Jayesh Dubey                    | https://www.linkedin.com/in/jayesh-dubey823/             |
| Vijay Vinod Mane                | https://www.linkedin.com/in/vijay-vinod-mane/            |
| Kshatriya Nandini Kuldeep Singh | https://www.linkedin.com/in/kshatriya-nandini-331a16244/ |

Questions or improvements welcome—feel free to open an issue or PR.

— Doc+ Team
