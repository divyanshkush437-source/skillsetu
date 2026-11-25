#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${FIREBASE_CONFIG:?Set FIREBASE_CONFIG to a path containing Firebase public web config JSON}"
: "${SES_SENDER:?Set a verified SES sender address}"
: "${REVIEW_INBOX:?Set the SES recipient for reports and job summaries}"
region="${AWS_REGION:-ap-south-1}"
stack="${STACK_NAME:-skillsetu}"
project=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).projectId)' "$FIREBASE_CONFIG")
if [[ -n "${TURNSTILE_PARAMETER:-}" && -z "${TURNSTILE_SITE_KEY:-}" ]]; then echo 'Set TURNSTILE_SITE_KEY for the configured verification secret.' >&2; exit 1; fi
aws sts get-caller-identity --output text >/dev/null
sam build --template-file template.json
sam deploy --region "$region" --stack-name "$stack" --resolve-s3 --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset --parameter-overrides "FirebaseProject=$project" "SesSender=$SES_SENDER" "ReviewInbox=$REVIEW_INBOX" "TurnstileSecretParameter=${TURNSTILE_PARAMETER:-}"
output(){ aws cloudformation describe-stacks --region "$region" --stack-name "$stack" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" --output text; }
app=$(output AppId)
export SKILL_API_BASE=$(output ApiBase)
npm install --no-audit --no-fund
npm run build
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
(cd dist && zip -qr "$tmp/site.zip" .)
aws amplify create-deployment --region "$region" --app-id "$app" --branch-name main --output json > "$tmp/job.json"
value(){ node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1]))[process.argv[2]])' "$tmp/job.json" "$1"; }
job=$(value jobId)
curl --fail --silent --show-error -T "$tmp/site.zip" "$(value zipUploadUrl)"
aws amplify start-deployment --region "$region" --app-id "$app" --branch-name main --job-id "$job" --output text >/dev/null
while true; do
  status=$(aws amplify get-job --region "$region" --app-id "$app" --branch-name main --job-id "$job" --query 'job.summary.status' --output text)
  case "$status" in SUCCEED) break;; FAILED|CANCELLED) echo "Amplify deployment $status" >&2; exit 1;; esac
  sleep 8
done
site=$(output PublicUrl)
curl --fail --silent --show-error "$site/search" >/dev/null
echo "Published: $site"
echo "Add the hostname to Firebase Authentication > Authorized domains and complete a phone sign-in."
