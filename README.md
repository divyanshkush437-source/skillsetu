# SkillSetu

A mobile-first, zero-commission worker directory for Mumbai. Open **SkillSetu-Demo.html** in Safari, Chrome, Edge or Firefox for the standalone interactive demo. All artwork, React, styles and demo data are bundled in that file. Local profile links from the standalone file work on the device holding that file. The hosted build has public, shareable routes.

## Judge walkthrough

1. Open **Demo Mode** on the landing page. The directory shows the three supplied sample profiles and preselects Plumber and Andheri West. Tap **Find workers** to apply that selection. On a phone, tap the filter control to open the bottom sheet.
2. Open Ramesh Kumar's profile, inspect his fee and availability, and open the WhatsApp draft. Sending is manual. The supplied numbers are example data. Saved workers are bookmarks on this device.
3. Select **Join as a worker**, enter the clearly labelled demo account, and choose a skill, area and rate. Preview and publish the profile. Toggle availability in Dashboard, then revisit the profile.
4. Post a job in the same skill and locality. The demo dashboard displays the enquiry and a masked callback action. Demo registrations and posts persist on this browser. The three seed workers remain separate from live database records.
5. Open **Architecture** or **Roadmap** in the footer. Choose a language in the header or select **Easy mode** for guided search, registration and job posting. The guide includes English and the 22 scheduled languages. Each trade and locality has a separate listen button. Spoken guidance uses a matching device voice when available. Advanced screens use English. Translations and pictograms still need field testing with native speakers. Sample phone-verification badges and enquiry counts illustrate the live UI.

## Run the hosted build locally

Requires Node.js 22 or later. The archive includes dist/ so a network connection and package installation are unnecessary for the prebuilt demo.

    npm start

Open http://127.0.0.1:4173/search. The Node server returns index.html for deep links. Use npm install followed by npm run dev to rebuild with source changes. Run npm test for validation and privacy projection checks. To rebuild the standalone file, run node scripts/portable.mjs SkillSetu-Demo.html.

## Deploy the full application to AWS

Use a signed-in AWS CLI session with infrastructure deployment permissions, SAM CLI, Node.js 22+, npm, zip and curl. The default AWS region is Mumbai (ap-south-1). SAM and npm need package-registry access during build.

1. In Firebase Authentication, enable Phone sign-in, allow the SMS region India, and complete the billing/SMS setup for the account. Export the Firebase **public web app configuration** as JSON outside the repository. Include apiKey, authDomain, projectId, messagingSenderId and appId. The backend verifies Firebase ID tokens using its project ID. It requires no service account private key.
2. Verify the SES sender in the deployment region. Choose the job-summary and abuse-report inbox. In the SES sandbox, verify that inbox too. Configure SNS SMS spending limits, registration, origination identity and sandbox recipients as appropriate for delivery in India. Workers opt in using the SMS checkbox. A job is always visible in the matching worker dashboard even if delivery fails.
3. To require CAPTCHA after ten searches in five minutes, create a Cloudflare Turnstile site for the production hostname. Set TURNSTILE_SITE_KEY and TURNSTILE_PARAMETER. Store the secret under /<stack-name>/ in AWS SSM SecureString, using the default SSM encryption key or supplying the Lambda role with permission to use your chosen KMS key.
4. Run the following from the project root, substituting your actual values.

       export AWS_REGION=ap-south-1
       export FIREBASE_CONFIG=/absolute/path/to/firebase-web-config.json
       export SES_SENDER=verified-sender@example.com
       export REVIEW_INBOX=verified-inbox@example.com
       bash scripts/deploy.sh

   The script builds and deploys template.json, creates the Amplify app and main branch, builds with the API URL, uploads the site, waits for Amplify, checks /search and prints the public URL. Reuse the same STACK_NAME on subsequent deployments. Manually uploading the unconfigured dist/ publishes only the sample-data edition.
5. Add the printed hostname (without https://) under Firebase Authentication → Settings → Authorized domains. Add the hostname to Turnstile if enabled. Use a Firebase test number before attempting real SMS.
6. Load the public URL on mobile data. Register, publish a profile, open its URL in another browser, toggle availability, search again after the 60-second search cache expires, then post a matching job. Verify SES delivery, worker SMS, Android and iOS WhatsApp handoff and Lighthouse on the deployed origin.

### Amplify firewall and budget

AWS charges for the Amplify WAF association in addition to WAF usage. The base deployment leaves the paid association off. To opt in, deploy waf.json in us-east-1 with the Amplify App ARN as AppArn. Verify account pricing before enabling this alongside the free-tier hosting target.

    aws cloudformation deploy --region us-east-1 --stack-name skillsetu-waf --template-file waf.json --parameter-overrides AppArn=<amplify-app-arn>

AWS pricing: https://docs.aws.amazon.com/amplify/latest/userguide/waf-pricing.html

## Backend and data

Public search and profile reads use /api/v1/workers and /api/v1/worker/{id}. Public search and profile responses omit contact URLs and phone numbers. The contact endpoint rechecks listing visibility and allows 20 contact requests per IP per hour. WhatsApp discloses the number to the person opening the link. Public IDs are opaque Firebase-generated UIDs. The three requested demo IDs are static.

Authenticated functions implement POST /worker, GET /me, PATCH /worker/{id}/availability, POST /job and GET /jobs. Each verifies a Firebase phone-auth token. The account UID determines profile ownership. The private enquiries endpoint derives matching criteria from the signed-in worker. POST /worker/{id}/report sends an SES report. POST /otp-attempt limits this app's send flow to three sends per number in an hour; the fourth returns 429. Firebase independently governs direct provider requests. A production requirement to enforce this custom cap across every client needs a provider-side SMS blocking hook.

Workers use worker#{uid}/profile. Jobs use job#{id}/post with seven-day TTL. Both use skill-locality-index; Workers also have locality-index. Unfiltered directory reads query the listed trades. The prototype aggregates those queries and needs paging at larger scale. State holds TTL-limited quotas, 60-second candidate ID lists and notification receipts. Configured gateway throttling applies across routes. A separate DynamoDB request counter applies a per-IP limit.

New Jobs stream records trigger SMS for opted-in matching workers and an SES summary to the configured inbox. SES also handles reported profiles. Workers receive SMS because the worker-facing brief explicitly requests phone alerts. Stream delivery is at least once. Delivery receipts suppress completed sends, but a crash between a provider accepting a message and storing its receipt can cause a duplicate. DynamoDB tables are retained when the stack is deleted.

## Validation status

The production frontend build and standalone demo were generated. Six routes, the search preset, filters, bookmarks, WhatsApp URL, registration preview, saved availability, job matching and the architecture dialog passed simulated DOM interaction checks. Phone normalization, input validation and public-data projection passed Node tests. Account forms and Firebase load separately.

Public AWS hosting, actual Firebase OTP, DynamoDB writes, outbound SES/SNS delivery, physical handset handoff, mobile Lighthouse, real network latency and the 360 px visual layout require checks in a connected deployment. The offline service worker caches the app shell after the first successful online visit.

## Training the job-description classifier

On Post a local job, enter a short English, Hindi, or Hinglish description. A lightweight TF-IDF model suggests a skill when the text resembles labelled examples and one trade leads clearly. The household can change the skill. Matching to workers still uses the chosen skill and locality. Other remains available manually for unrepresented trades.

Edit training/examples.json to add labelled, anonymous descriptions. Keep separate examples in training/evaluation.json. Run npm run train to regenerate backend/trained-skills.json and evaluate it. Run npm test and npm run build after changing the model. No external AI service is used. POST /job accepts a listed skill or the explicit value auto; ambiguous auto requests return a 400 so the caller can ask for a skill. Normal explicit skill submissions remain authoritative.

The first evaluation used 72 authored examples across nine trades and 33 separate synthetic requests. Twenty of 27 trade-specific requests received the expected suggestion. Seven needed manual selection. All six vague or unsupported examples received no suggestion. These results describe this small dataset only.

## Voice guidance

The guided screens use a matching browser voice when installed. For other languages, configure the speech Lambda with BHASHINI, which returns audio on tap. Create one encrypted SSM SecureString parameter containing JSON like `{"userId":"...","ulcaApiKey":"..."}` from an approved BHASHINI account. Set `BHASHINI_PARAMETER` to that parameter name before running `scripts/deploy.sh`. The deployment script passes it into the CloudFormation stack. Keep these credentials out of the frontend, Git, and browser storage. The Lambda discovers a TTS model for each chosen language and fetches WAV audio. Model availability is controlled by BHASHINI. The client currently uses this service only when its browser has no matching voice.

The local standalone HTML demo has no remote speech backend, so it needs an installed browser voice. For the full 22 language voice flow, test the hosted build after its backend is configured. An unavailable voice shows a clear message while picture buttons remain usable.
