# intention.md — read this first

Briefing for any model or agent working on this project. It explains what is being built, why, and the hard limits. If a suggestion conflicts with a limit below, the limit wins. Ask the owner before bending one.

Facts about free tiers and platform support were checked in October 2026. They change. Re-verify before relying on one.

---

## 1. What this is

A personal **digital wardrobe and outfit generator**.

1. The owner photographs their clothes, including messy photos such as several items piled on a bed.
2. The app finds each garment, cuts it out, and tags it (category, color, pattern, style).
3. The owner asks for outfits in one of two ways:
   - **Anchor mode:** "build outfits around this jacket"
   - **Vibe mode:** "cozy date night", "smart-casual office", "rainy and lazy"
4. The app answers using **only clothes in the owner's inventory**. It never invents items.

It is built **for the owner's own use first**. It is released **open source** so anyone can build and run it themselves, locally, for free.

## 2. Why it exists

The owner looked for free App Store apps first. The ones that fit mostly gate their useful features behind subscriptions or in-app purchases, have few or no reviews, and keep user photos on someone else's server. So the owner decided to build their own: free forever, private, no accounts.

## 3. Hard constraints (non-negotiable)

| # | Constraint | What it means in practice |
|---|---|---|
| 1 | **Free only** | No paid APIs, no subscriptions, no credits, no "free trial then pay" services. No Apple Developer Program ($99/yr). No paid hosting. If something is only free for a limited time, it does not count as free. |
| 2 | **No macOS computer** | Xcode, Core ML tooling, and native iOS builds are not available. Do not propose Swift/Xcode/TestFlight/App Store paths. |
| 3 | **Must run on the owner's iPhone** | The route is a **PWA** (installed from Safari via "Add to Home Screen"). No App Store, no Mac, no fee. |
| 4 | **No 24/7 machine** | The owner cannot keep their own computer running all the time. Anything that needs an always-on server must run on a free host, or be unnecessary. |
| 5 | **Open source** | Permissive license (MIT or Apache-2.0 for the app code). Check every model's license. Do not bundle weights with non-commercial or restrictive terms. Download models at first run instead of committing them. |
| 6 | **Privacy / local-first** | Wardrobe photos may show the owner's room or the owner. By default **no image or inventory data leaves the device**. Any network call that sends user data is opt-in and clearly labeled. |
| 7 | **Hobby scale** | One user, a few hundred garments. Do not over-engineer for scale, auth, multi-tenancy, or monetization. |

## 4. Chosen direction: no backend at all

**Primary architecture: everything runs in the browser on the phone.** There is no server to host, pay for, or keep awake.

- **App shell:** static PWA (TypeScript). Host the static files for free on GitHub Pages, Cloudflare Pages, or a Hugging Face **Static** Space (static Spaces are free; compute Spaces are not, see section 6).
- **Inference:** Transformers.js and/or onnxruntime-web, using **WebGPU** where available and **WASM** as a fallback. Safari on iOS 26 and later ships WebGPU, so the owner's iOS version matters (see open questions). Older versions still work via WASM, slower.
- **Storage:** IndexedDB for metadata and embeddings, and the Cache API for model files and cutout images. Request persistent storage. **Always provide Export / Import (zip of JSON + images)** as a backup, because mobile browsers can evict web storage.
- **Models are cached after the first download.** The first run will be a large download, so warn the user and use Wi-Fi.

### Pipeline

**Ingest (photo → inventory item)**
1. Photo in.
2. Segmentation to isolate each garment. Prefer **tap-to-select** on a lightweight SAM-family model (MobileSAM / SlimSAM / SAM 2 tiny, whichever runs acceptably in the browser). Fully automatic detection of every item on a cluttered bed is a stretch goal, not the baseline.
3. Crop onto a transparent background.
4. Zero-shot tagging with **SigLIP or CLIP** (category, pattern, style). Dominant color via k-means on masked pixels only.
5. Store the image embedding.
6. **Review screen** where the owner can correct tags. This is required, not optional. It makes every later step better.

**Outfit generation**
1. Anchor mode fixes the chosen item. Vibe mode embeds the text with the same SigLIP/CLIP text encoder and scores items by similarity.
2. Fill slots (top, bottom, shoes, outerwear, accessory) and score combinations on: vibe similarity, color harmony, formality match, and optional weather rules.
3. **An LLM is optional.** If one is used, it is small and local (Gemma-class, 1B or so, in-browser via WebGPU), and it only **chooses from a shortlist and explains**. It receives item IDs as JSON, and its output IDs **must be validated against the inventory**. The app must work with no LLM installed.

## 5. Ordering of work

Do these in order. Do not start a step before the previous one works on the real phone.

1. **Spike:** run SigLIP or CLIP in the browser on the iPhone and tag one photo. Measure time and memory. If this fails, the whole direction needs rethinking.
2. **Spike:** run a SAM-family model in the browser on the iPhone and segment one garment from a messy photo. This is the riskiest step.
3. Inventory: ingest, review screen, IndexedDB, export/import.
4. Vibe search over the inventory (embeddings only).
5. Outfit assembly with the scoring rules.
6. Optional: small local LLM for the final pick and explanation.
7. Optional: sync (section 6).

## 6. Backend options (only if the browser-only approach hits a wall)

None of these is needed for the baseline. Add one only if a specific spike fails or a specific feature needs it, and ask the owner first.

- **Hugging Face Spaces (Docker or Gradio):** do **not** assume free. Current HF docs say the CPU Basic hardware is free of hourly cost, but creating a Space that runs compute (Gradio or Docker) requires a paid plan. Static Spaces are free. Free-hardware Spaces also sleep when idle, and default disk is not persistent. Fine for hosting the static PWA, not for a server.
- **Oracle Cloud Always Free (Ampere A1):** the most generous truly free always-on VM, but with real caveats. Reports from mid-2026 say Oracle cut the Always Free A1 allowance from 4 OCPU / 24 GB to **2 OCPU / 12 GB**. Capacity is often "out of capacity" in popular regions. Idle instances can be reclaimed. A card is needed for signup verification. Use only as a fallback for heavy inference, and treat it as unreliable.
- **Owner's own machine, on demand:** the owner can run a local server (Docker) when they are home and the phone is on the same network or a private VPN. This breaks "always available", so it is only a convenience, never a dependency.
- **Free serverless tiers (for example Cloudflare Workers/Pages with D1 or R2) for optional sync:** plausible but **not verified here**. Check current limits and terms before committing.
- **Sync without a server:** export/import zip files. Works with zero infrastructure and is the default plan for moving data between devices.

## 7. Things not to do

- Do not suggest native iOS builds, Xcode, TestFlight, App Store release, or any step that needs a Mac.
- Do not suggest sideloading via a free Apple ID as the main path. Apps signed that way expire after 7 days, and it needs a computer to re-sign.
- Do not add a paid or key-gated API (OpenAI, Anthropic, Google, etc.) as a dependency. Free-tier APIs may be offered only as an optional, clearly labeled prototype aid, never required.
- Do not upload user photos anywhere by default.
- Do not let a model invent clothes. Every suggested item must resolve to an inventory ID.
- Do not claim a model, library, or free tier works on iPhone Safari without it being tested or sourced.

## 8. Open questions for the owner

- Which iOS version is the phone on? (iOS 26 or later gets WebGPU in Safari. Older versions fall back to slower WASM.)
- Is syncing between devices needed, or is export/import enough?
- Which license for the app code: MIT or Apache-2.0?
- Does the owner want a fully automatic "find every garment in this photo" mode, or is tap-to-select acceptable?

## 9. Style of collaboration

- The owner is an experienced software developer, comfortable with Linux, Docker, and infrastructure. Skip beginner explanations, but flag platform limits clearly.
- Prefer small, testable steps and a working demo on the actual phone over architecture documents.
- When a free-tier fact matters, give the source and the date.
- If a requirement can't be met for free, say so plainly and offer the cheapest free workaround. Do not quietly substitute a paid option.
