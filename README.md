# eDoctorsBD (demo) — v2

**Live demo: [edoctorsbd.vercel.app](https://edoctorsbd.vercel.app)**

> **Demo only.** All doctors, credentials and BMDC registration numbers are
> fictional. Payments run in bypass mode — no real money moves. Not a medical
> service.

A doctor-booking / telehealth platform for Bangladesh, built as a portfolio
demo. Full-stack: auth, a relational data model, geo + multi-field search,
a real (sandboxed) payment flow, a pre-consultation intake questionnaire that
routes to a human doctor, and three role-based dashboards.

## Stack

- Next.js 14 (App Router) + TypeScript
- PostgreSQL + Prisma ORM
- NextAuth (credentials, JWT sessions, three roles)
- SSLCommerz **sandbox** payments
- Tailwind CSS
- Bengali / English UI toggle

---

## Screenshots

**Doctor reviewing a patient's intake answers before deciding**

![Doctor intake review](SCREENSHOT_URL_1)

**Search with filters**

![Doctor search](SCREENSHOT_URL_2)

**Patient dashboard**

![Patient dashboard](SCREENSHOT_URL_3)

---

## The intake questionnaire (the distinctive feature)

Before paying, the patient answers 8–11 questions. The set is **specialization-
aware**: everyone gets 8 common questions (main concern, physical vs mental,
body area, duration, daily-life impact, trajectory, current medication,
existing conditions), plus 3 more chosen by the doctor's specialization —
cardiology asks about exertional chest pain and family history, pediatrics asks
about feeding and drowsiness, orthopedics asks whether they can bear weight,
and so on.

The answers go to the doctor, who then **accepts**, **declines with a reason**
(auto-refund), **marks it urgent**, or **proposes a different time** that the
patient can accept or decline.

### How the safety side is designed

This matters more than the feature itself, so it is worth being explicit:

- **The system never interprets answers.** No diagnosis, no probable cause, no
  severity score, no automated triage decision. Every clinical call is made by
  the human doctor reading the answers.
- **Flagging changes order, not outcome.** Certain answers (e.g. frequent
  breathlessness on exertion, a child who is hard to wake, inability to bear
  weight, daily-life impact rated 8+/10) mark the appointment so it surfaces at
  the top of the doctor's queue with the reason shown. It does not accept,
  reject, or escalate anything by itself.
- **Emergency screening comes first.** A notice sits above every questionnaire
  telling anyone with severe chest pain, breathing difficulty, heavy bleeding,
  sudden weakness or loss of consciousness to call 999 or go to hospital rather
  than wait for an appointment.
- **Crisis support is immediate, not deferred.** The psychiatry question set
  asks directly about thoughts of self-harm. If the patient indicates yes,
  helpline details appear on screen right away — they do not have to wait for
  the appointment — and the appointment is flagged for the doctor.

Crisis resources used (`lib/intake-questions.ts`): Kaan Pete Roi
(09612-119911, 3pm–3am daily), Moner Bondhu (01776-632344), national emergency
999. **Verify these are current before any real deployment** — helpline numbers
and hours change.

---

## Features

### Patient
- Search with filters: specialization, fee range, rating, **doctor gender**,
  **language spoken**, **available today**, distance (geolocation + haversine),
  hospital; sort by rating / fee / experience / distance
- **Book for a family member** — every account has a "self" profile plus any
  children, parents, spouse etc. you add; the doctor sees whose details they
  are reading
- Pre-consultation intake questionnaire
- Pay via SSLCommerz sandbox
- Accept or decline a doctor's proposed new time
- Cancel an appointment (auto refund-pending)
- Read the doctor's **consultation notes and prescription** after completion
- **Save doctors** and one-click **book again**
- Leave a review after a completed appointment; see the doctor's reply

### Doctor
- **Manage availability** — add one-off slots, or set recurring weekly hours
  ("every Tuesday 10:00–13:00, 20-minute appointments") and generate real slots
  from them for up to 12 weeks ahead
- **Edit own profile** — bio, fee, specialization, experience, gender,
  languages (no database access needed)
- Review each patient's intake answers before deciding
- Accept / decline-with-reason / mark urgent / propose a new time
- Record consultation notes and a prescription when completing
- Reply publicly to reviews
- **Earnings** broken down by week, month, and all-time, plus refunds

### Admin
- **Verification queue** — approve or reject doctor registrations, with the
  BMDC number shown for checking against the official register
- Only APPROVED doctors appear in patient search

---

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Get a free Postgres database** — [Neon](https://neon.tech) or
   [Supabase](https://supabase.com). Copy the connection string.

3. **Payments — optional.** The app runs in bypass mode by default in
   development: payment is recorded locally and the appointment proceeds
   straight to doctor review. To exercise the real gateway instead, get free
   sandbox credentials at
   [developer.sslcommerz.com/registration](https://developer.sslcommerz.com/registration/)
   (test account, free, no business documents needed) and fill in
   `SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_STORE_PASSWORD`. In production, bypass
   must be opted into explicitly with `DEMO_ALLOW_PAYMENT_BYPASS="true"`.

4. **Configure**
   ```bash
   cp .env.example .env.local
   cp .env.local .env
   ```
   Prisma's CLI reads `.env`; Next.js reads `.env.local`. Keep both.
   Fill in `DATABASE_URL` and `NEXTAUTH_SECRET` at minimum.

5. **Create tables and seed**
   ```bash
   npx prisma migrate dev --name init
   npx prisma db seed
   ```

6. **Run**
   ```bash
   npm run dev
   ```

### Demo logins (all `password123`)

| Email | Role |
|---|---|
| `patient@example.com` | Patient — has 2 family members and appointment history |
| `doctor@example.com` | Doctor — has a flagged appointment waiting for review |
| `admin@example.com` | Admin — has 2 doctors in the verification queue |

The seed creates 10 approved doctors across 5 hospitals, 2 pending doctors for
the admin queue, recurring availability rules, upcoming slots, past completed
appointments with notes and reviews, and one live flagged intake (an elderly
parent with worsening breathlessness) so you can see the whole decision flow
without setting it up yourself.

---

## Editing data directly

```bash
npx prisma studio
```

Opens a table browser at `localhost:5555` against the same database the app
uses, so edits show up on the site immediately on refresh.

Note: adding a doctor by hand needs two linked rows (a `User` with a
`passwordHash`, then a `DoctorProfile` pointing at it, with
`verificationStatus` set to `APPROVED`). The admin dashboard and the `/register`
page both do this properly without touching the database.

---

## Project structure

```
app/
  api/
    auth/[...nextauth]          NextAuth handler
    register                    Signup (doctors start PENDING)
    doctors                     Search + filters; [id] public profile
    doctors/me                  Doctor's own profile (GET/PATCH)
    doctors/me/slots            Add / list / delete own slots
    doctors/me/templates        Recurring rules; /generate builds slots
    doctors/me/earnings         Week / month / all-time breakdown
    appointments                Book (with intake) + list
    appointments/[id]/decision  Accept / reject / urgent / propose time
    appointments/[id]/cancel    Either side cancels
    appointments/[id]/reschedule-response   Patient answers a proposal
    appointments/[id]/complete  Doctor records notes + prescription
    intake-questions            Question set for a specialization
    patient-profiles            Family members
    favorites                   Saved doctors
    reviews, reviews/[id]/reply
    admin/doctors, admin/doctors/[id]       Verification queue
    payment/init, payment/ipn   SSLCommerz sandbox
  doctors/                      Search page, profile + 2-step booking
  dashboard/patient/            Appointments, family, favourites
  dashboard/doctor/             Queue, availability, profile, earnings
  dashboard/admin/              Verification queue
lib/
  intake-questions.ts           Question catalog + flagging + crisis resources
  i18n.ts                       Bengali/English dictionary
  prisma.ts, auth.ts, sslcommerz.ts, distance.ts
components/
  IntakeForm.tsx, DoctorCard.tsx, Navbar.tsx,
  LanguageProvider.tsx, Providers.tsx
prisma/
  schema.prisma, seed.ts
```

## Appointment lifecycle

```
PENDING_PAYMENT
      | payment succeeds
      v
PENDING_DOCTOR_REVIEW   <-- doctor reads the intake answers here
      |
      |-- accept ------------> BOOKED ----> COMPLETED
      |-- propose new time --> RESCHEDULE_PROPOSED
      |                            |-- patient accepts --> BOOKED
      |                            |-- patient declines -> CANCELLED (refund)
      |-- reject ------------> REJECTED (refund)
```

Slots are locked inside a database transaction at booking time, so two patients
cannot take the same slot. A proposed slot is held while the patient decides,
and released if they decline.

---

## What's real vs simulated

| Piece | Status |
|---|---|
| Auth, schema, search, booking transactions, intake logic, all dashboards | **Real** — same code you would ship |
| Payments | **Bypass by default** — payment is recorded locally, flagged in the payment record and shown as a banner in the UI. The SSLCommerz sandbox integration is real (redirect + IPN validation) and runs whenever credentials are supplied. No real money either way. |
| Refunds | Recorded as `REFUND_PENDING` in the database. A production build would call the gateway's refund API here. |
| Doctor verification | Real approval workflow; a human still has to check the BMDC number against the official register |
| Doctor/hospital data | Hospitals are real places; **all doctors are fictional**, and the BMDC numbers are invented placeholders |

## Not built (deliberately out of scope)

In-app chat, video consultation, SMS/email notifications. These need real-time
infrastructure and third-party accounts (Agora/Daily, an SMS provider), which
would make this a different project. The schema would support adding them.

## Before this could be anything more than a demo

Business registration, a real payment merchant account, a lawyer's review of
terms and health-data handling, a genuine BMDC verification process, and
replacing every fictional doctor. The code is the easy part.
