# SkillSetu field pilot and judging notes

## One locality, two trades

Start with plumbing and electrical work in Andheri West. Ask an ITI placement coordinator or housing-society representative to introduce interested volunteers. A target of 10–20 consenting workers is a recruiting goal. Count actual sign-ups and dates before reporting traction. No outreach has been performed by the prototype.

Show a worker the directory before asking for details. Ask which areas they serve, whether they want a public work number, and what would make them pause the listing. Offer a private preview. Have them try adding a second area, publishing, and pausing. The worker enters their own OTP. Record where help was needed.

Ask households with genuine requests to search for a trade and area. Record how many searches found a match, and with consent, how many households reported a quote, an agreed visit or completed work. Count unique workers independently from service-area entries. Keep missing responses in the denominator. Contact openings measure intent; actual sending, payment, satisfaction and repeat use require separate evidence. Exclude all demo activity. Keep OTPs, Aadhaar, phone numbers and exact addresses out of research notes and training data.

For classifier training, collect anonymous descriptions before showing suggestions; reserve a separate set for evaluation. Measure correct, wrong and abstained suggestions. The supplied benchmark is synthetic.

## What the team can say to judges

**Trust.** Phone OTP confirms control of a number. An alternate work number requires its own verification. The directory has no caste or religion filters and accepts discrimination reports. Off-platform conduct and workmanship cannot be verified through WhatsApp clicks. A moderator can hide or restore the public listing. No background check, insurance or service guarantee is offered.

**Differentiation.** A neighbour can share a profile showing service areas, a worker-selected fee range and recently confirmed availability. Competitors can copy this feature. Repeat local referrals and response rates are evidence the team still needs to collect.

**Revenue.** The prototype charges no listing fees, enquiry fees or booking commission. On an ₹800 job the platform takes ₹0. A claimed ₹200 saving requires an actual comparison against a 25% fee for equivalent work. Test whether housing societies value a coordination service before introducing a paid plan.

**Scaling.** Repeat the pilot in one neighbouring locality only after measuring onboarding time, enquiry outcomes, repeat use and moderation workload. Report actual figures with denominators. No national rollout, revenue, or guaranteed arrival time has been demonstrated.

## Backend handoff

The footer links to /admin. Offline review is confined to the device. Cloud review requires a verified Firebase token with a boolean admin claim granted by a trusted administrator. A report stays queued if SES notification fails. Hiding is reversible, persists across worker edits, and blocks public profile lookup, contact and matched job access. Legacy duplicate work numbers are flagged for review. New registrations reserve the verified contact transactionally.

Workers declare up to three localities; legacy profiles retain their primary locality. The cache contains candidate IDs, and the backend rechecks current records on search. Seven-day anonymous enquiry receipts allow optional updates from the originating device. Reviewer totals display the latest reported stage per enquiry. Messages are never read by SkillSetu.

## Design references

- Firebase phone verification and consent: https://firebase.google.com/docs/auth/web/phone-auth
- Firebase server-issued roles: https://firebase.google.com/docs/auth/admin/custom-claims
- WhatsApp draft links: https://faq.whatsapp.com/5913398998672934
- DynamoDB consistency: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html
