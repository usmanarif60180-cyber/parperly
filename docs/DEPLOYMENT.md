# Setup and deployment

## Frontend

Use Node 24.12 or newer (validated with 24.22.3). Run `npm ci`, `npm test`, `npm run typecheck`, then `npm run dev`. The developer server uses port 8766. `npm run prepare:assets` bundles the PDF worker and copies PDF.js font/CMap/WASM assets.

GitHub Pages uses `.github/workflows/pages.yml`. It runs checks and builds with `NEXT_PUBLIC_BASE_PATH=/parperly`, then publishes `apps/web/out`. Source is in `apps/web`, shared contracts/registry/processing in `packages`. Public Firebase identifiers are centralized in `packages/config/firebase-public.json`; these identify the project and do not grant administrative access. Never add service account keys to frontend code.

## Firebase

Project: `parperly`; web app: Paperly Web. Email/password and Google providers enabled. Authorized deployment domain: `usmanarif60180-cyber.github.io`. Existing Firebase default domains remain unchanged. No billing plan upgrade, storage bucket, Firestore database or service-account key was provisioned by this release.

Before enabling cloud document operations, create Firestore/private storage in the chosen region, deploy and emulator-test the deny-all rules, configure a least-privilege server identity via workload identity or an appropriately secured credential, and test API ownership checks separately (Admin SDK bypasses rules).

## Backend (not deployed)

`npm run api` starts a health endpoint and refuses `/v1` processing with 503 unless `ENABLE_SERVER_PROCESSING=true` and required server environment values exist. `npm run worker` requires Firebase Admin ADC, private bucket and reviewed Redis endpoint. Docker Compose provides local non-root/read-only containers with memory/CPU/PID limits. Host firewall and per-job sandbox/egress policies are still needed; a container alone is not a complete hostile-document sandbox.

Use `.env.example` as a template; keep real credentials outside Git. GCS signing requires signing authority for the service identity. File retention is currently one hour in API code; adjust and test it before activating real storage. No payment provider is present. OCR/Office/HTML workers are not implemented in this backend yet.

## OVH and custom domain

The user owns `parperly.com` and reports an OVH VPS. SSH hostname, username, port and configured key access have been requested. Do not change DNS, provision billing or overwrite existing VPS services before inspecting their current state. When domain connection is requested, update GitHub Pages custom-domain settings/DNS, siteUrl/basePath, HTTPS and Firebase OAuth domain allowlist together. Building for a root custom domain uses an empty NEXT_PUBLIC_BASE_PATH; continuing to use /parperly would break asset URLs.
