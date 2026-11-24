# SkillSetu

**A zero-commission worker directory for Mumbai.** Plumbers, electricians, cooks, drivers and other daily-wage workers make a free profile with just their phone number. Customers find someone nearby and contact them directly on WhatsApp. No app install, no middleman, no commission.

Built for the TechFest IIT Bombay **Campus to Cloud** hackathon and running fully on the **AWS Free Tier** in the Mumbai region (ap-south-1).

## Live demo

| | |
|---|---|
| **App** | https://main.d13ihrep3z0o8l.amplifyapp.com |
| **API** | https://zpshae5ha8.execute-api.ap-south-1.amazonaws.com/api/v1 |
| **Region** | ap-south-1 (Mumbai) |

**Quick tour (2 minutes):**

1. Open the app and tap **Demo Mode**. It loads sample worker profiles.
2. Choose **Plumber** + **Andheri West** and tap **Find workers**. Ramesh Kumar shows up, and workers from nearby areas (like Andheri East) appear under "Also nearby".
3. Open a profile to see the rate, availability, the price guide for that trade and the "OTP verified" badge.
4. Tap **WhatsApp**. It opens a chat with a ready-made message. Sending is up to you.
5. Tap **Join as a worker** and sign in with the test number `9999999999` and OTP `123456`. Pick a skill, area and rate, preview the profile and publish it.
6. Post a job with the same skill and area. The worker sees it on their dashboard.
7. Try the **हिंदी** toggle, and open **Architecture** or **Roadmap** in the footer.

## The problem

Most informal workers in Indian cities find work through word of mouth or through platforms that take 20–30% commission. Many of them use WhatsApp every day but never download a separate app. SkillSetu gives them a free public profile that works on any phone browser and sends customers straight to their WhatsApp.

## Features

- **Search by skill and area.** 10 trades and 30 Mumbai localities, with a "nearby areas" fallback so a search never comes up empty for no reason.
- **Fair price guide.** Each trade shows a typical price range (for example, plumber ₹300–800 per visit) so neither side gets cheated.
- **Phone OTP sign-up.** Workers register with only a mobile number (Firebase phone auth). No email or password.
- **WhatsApp handoff.** `wa.me` links with a pre-filled message. Nothing is sent automatically.
- **Availability toggle.** Workers mark themselves available or busy from their dashboard.
- **Job posts with alerts.** When a job is posted, matching workers who opted in get an SMS (SNS) and the review inbox gets an email summary (SES). Posts expire after 7 days.
- **Report a profile.** Anyone can report a fake or abusive profile. The report goes by email for review.
- **Hindi + Hinglish.** Main labels switch to Hindi, and worker prompts use Hinglish.
- **Honest trust signals.** Profiles show "OTP verified" and say clearly that there is no background check.
- **Works on slow networks.** About 56 KB gzipped initial JS, and a service worker caches the app shell for offline use.
- **Demo Mode.** Sample data stored in the browser, kept separate from the live database.

## Architecture

```
            Phone browser (React 18 PWA)
                 │                 │
                 │                 └──► Firebase Auth (phone OTP)
                 ▼
         AWS Amplify Hosting  (static site, main branch)
                 │
                 ▼
      Amazon API Gateway  (HTTP API, /api/v1, CORS locked to the app)
                 │
                 ▼
        AWS Lambda × 10  (Node.js 22, verify Firebase ID tokens)
                 │
                 ▼
        Amazon DynamoDB  ── Workers · Jobs · State
                 │
                 └── Jobs stream ──► notify Lambda ──► Amazon SNS (SMS to workers)
                                                   └─► Amazon SES (email summary)
```

### AWS services used

| Service | What it does here |
|---|---|
| **AWS Amplify Hosting** | Serves the React build on a public HTTPS URL |
| **Amazon API Gateway (HTTP API)** | REST endpoints under `/api/v1`, with throttling and CORS |
| **AWS Lambda** | 10 Node.js 22 functions: 9 API handlers + 1 stream processor |
| **Amazon DynamoDB** | `Workers`, `Jobs` (7-day TTL) and `State` (rate limits, search cache, receipts) tables, on-demand billing |
| **DynamoDB Streams** | Triggers notifications when a job is posted |
| **Amazon SNS** | SMS job alerts to workers who opted in |
| **Amazon SES** | Job summaries and abuse reports by email |
| **AWS SAM / CloudFormation** | The whole backend is one stack (`template.json`) |
| **AWS IAM** | Each function gets only the table and service permissions it needs |
| **AWS SSM Parameter Store** | Optional Turnstile CAPTCHA secret (SecureString) |
| **AWS WAF** | Optional (`waf.json`), off by default because it costs extra |

### API

| Method | Path | Auth | Lambda |
|---|---|---|---|
| GET | `/api/v1/workers?skill=&locality=` | Public | searchWorkers |
| GET | `/api/v1/worker/{id}` | Public | getWorker |
| POST | `/api/v1/worker` | Firebase token | registerWorker |
| GET | `/api/v1/me` | Firebase token | me |
| PATCH | `/api/v1/worker/{id}/availability` | Firebase token (owner) | updateAvailability |
| POST | `/api/v1/job` | Firebase token | postJob |
| GET | `/api/v1/jobs` | Firebase token | listJobs |
| POST | `/api/v1/worker/{id}/report` | Public, rate limited | report |
| POST | `/api/v1/otp-attempt` | Public, rate limited | otpAttempt |
| (stream) | Jobs table | — | notify |

### Data model

- **Workers:** `pk = worker#{uid}`, `sk = profile`. Indexes `skill-locality-index` and `locality-index`.
- **Jobs:** `pk = job#{id}`, `sk = post`, 7-day TTL, `skill-locality-index`, stream enabled.
- **State:** TTL items for per-IP rate limits, OTP send counts (3 per number per hour), 60-second search cache and notification receipts.

Tables are kept (retained) if the stack is deleted, so data is never lost by accident.

### Security

- Every write checks a Firebase phone-auth ID token. The token's UID decides who owns a profile, so nobody can edit someone else's profile.
- No service account key is needed. The backend checks tokens against Firebase's public keys and the project ID.
- Strict input validation: skill and locality must come from the allowed lists, and lengths and phone formats are checked.
- Public responses never include private fields. The phone number appears only inside the WhatsApp link.
- CORS allows only the app's own origin.
- Rate limits: API Gateway throttling, a per-IP counter in DynamoDB, and an OTP send limit. Optional Turnstile CAPTCHA after 10 searches in 5 minutes.

## Project structure

```
SkillSetu/
├── src/                 React app (app.jsx, account.jsx, ui.jsx, data.js, auth.js, style.css)
├── public/              index.html, config.js (runtime config), icons
├── backend/             Lambda handlers (*.mjs), shared code, config.json (skills, areas, prices)
├── scripts/
│   ├── build.mjs        esbuild production build → dist/
│   ├── serve.mjs        local server with SPA deep links
│   ├── portable.mjs     builds the single-file SkillSetu-Demo.html
│   └── deploy.sh        one-command AWS deploy
├── tests/               Node tests for validation and privacy
├── template.json        SAM / CloudFormation stack
├── waf.json             optional WAF stack
├── amplify.yml          Amplify build settings
└── SkillSetu-Demo.html  offline single-file demo
```

## Run it locally

Needs Node.js 22 or newer.

```bash
npm install
npm run dev        # build and serve at http://127.0.0.1:4173
npm test           # validation and privacy tests
```

`npm start` serves the existing `dist/` build. To rebuild the offline demo file:

```bash
node scripts/portable.mjs SkillSetu-Demo.html
```

You can also just open `SkillSetu-Demo.html` in any browser. Everything is bundled inside it.

## Deploy to AWS

### What you need

- An AWS account with the AWS CLI signed in (`aws sts get-caller-identity` should work)
- AWS SAM CLI, Node.js 22+, npm, zip and curl
- A Firebase project (the free Spark plan is fine)

### Step 1: Firebase

1. Create a Firebase project and add a **Web app**.
2. In **Authentication → Sign-in method**, turn on **Phone**.
3. Add a test number (we use `+91 9999999999` with code `123456`). The free plan allows only about 10 real SMS per day.
4. Save the web app config as JSON **outside the repo**, for example `~/firebase-skillsetu.json`:

```json
{
  "apiKey": "...",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project",
  "messagingSenderId": "...",
  "appId": "..."
}
```

### Step 2: SES

Verify the sender email in SES in ap-south-1. While the account is in the SES sandbox, also verify the inbox that receives reports and job summaries. They can be the same address.

### Step 3: Deploy

```bash
export AWS_REGION=ap-south-1
export FIREBASE_CONFIG=$HOME/firebase-skillsetu.json
export SES_SENDER=you@example.com
export REVIEW_INBOX=you@example.com
bash scripts/deploy.sh
```

The script:

1. Runs `sam build` and `sam deploy` for `template.json` (stack name `skillsetu`, or set `STACK_NAME`).
2. Reads the stack outputs: `AppId`, `ApiBase` and `PublicUrl`.
3. Builds the frontend with the API URL and Firebase config baked in.
4. Zips `dist/`, uploads it to Amplify, starts the deployment and waits until it succeeds.
5. Checks that `/search` loads and prints the public URL.

Run the same command again to deploy updates.

### Step 4: After the first deploy

- In Firebase, open **Authentication → Settings → Authorized domains** and add the Amplify hostname (without `https://`).
- Sign in with the test number and publish a profile to check everything end to end.

### Optional extras

- **CAPTCHA:** create a Cloudflare Turnstile site, store the secret in SSM Parameter Store as a SecureString under `/<stack-name>/`, then set `TURNSTILE_SITE_KEY` and `TURNSTILE_PARAMETER` before deploying.
- **SMS alerts:** set up SNS SMS for India (spending limit, sender registration and sandbox numbers). If SMS fails, jobs still show on the worker dashboard.
- **WAF:** this costs extra, so it is off by default. To turn it on:

```bash
aws cloudformation deploy --region us-east-1 --stack-name skillsetu-waf \
  --template-file waf.json --parameter-overrides AppArn=<amplify-app-arn>
```

### Remove everything

```bash
aws cloudformation delete-stack --region ap-south-1 --stack-name skillsetu
```

The DynamoDB tables are retained. Delete them by hand if you want them gone.

## Cost

Everything fits in the AWS Free Tier at hackathon scale: Lambda, API Gateway, DynamoDB on-demand, Amplify Hosting and the SES free tier. Firebase phone auth is on the free Spark plan. The only things that cost money are optional: real SNS SMS and WAF.

## Testing

**Automated:** `npm test` covers phone number normalisation, input validation and making sure public data never leaks private fields.

**Checked on the live deployment:**

- The site and deep links load, and Demo Mode works.
- Search with the nearby-area fallback, the price guide, profile pages and WhatsApp links work.
- The Hindi toggle, Architecture and Roadmap all work.
- Writing without signing in returns 401. A fake token returns 401. Bad input returns 400.
- CORS only allows the app's own origin.

## Roadmap

- Voice-based sign-up in Hindi and Marathi for workers who aren't comfortable typing
- Ratings from customers who actually contacted the worker
- Aadhaar-free ID checks through partner NGOs
- More cities beyond Mumbai
- Simple AI help that writes a profile from a short voice note
