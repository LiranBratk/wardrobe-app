# Wardrobe

A private, local-first digital wardrobe and outfit generator, built as an installable iPhone PWA. Photograph your clothes once; then describe the day ("the vibe today is this jacket and it's quite cool today") and get outfit suggestions built only from clothes you actually own.

Everything runs in the browser. There is no account, no backend, and no image upload.

## Features

- **Add clothes**: pick several photos from the library or camera, drag a box around one garment per item (or several items from one photo), and save. Photos are cropped and downscaled to 640 px JPEG on the device.
- **Auto-tagging**: an on-device CLIP model suggests category, pattern, style, and warmth. Dominant colours come from the pixels. Every tag is shown on a review screen before saving, because the model makes mistakes (for example jeans vs trousers).
- **Closet**: search, filter by slot (top, bottom, outerwear, shoes, ...), and edit or delete items.
- **Outfits**: type the vibe and weather in plain words or °C/°F. The app understands temperature words, rain, dress codes, and garment mentions ("this jacket"). You can also pin an anchor item. It returns up to three outfits with reasons. Suggestions are scored by vibe similarity (CLIP text vs item image), warmth, formality, colour harmony, and pattern mixing. Every suggested item is validated against your saved inventory.
- **Backup**: export everything (images plus tags) as a `.zip`, and import it back (merging by item ID). iPhone storage for web apps can be cleared by iOS, so export regularly.

## Using it on iPhone

1. Open `https://liranbratk.github.io/wardrobe-app/` in Safari, then **Share → Add to Home Screen**.
2. Use Wi-Fi the first time you tag clothes. The model files (~122 MB) download once and are then cached.
3. **Add** → choose photos → frame each garment → review the tags → save. Tight crops on a plain background tag best.
4. **Outfits** → describe the day → **Suggest outfits**.
5. **Backup** → **Export backup** now and then, and save the zip to Files or iCloud Drive.

The app tags with WebGPU when available and falls back to slower WASM. If WebGPU fails once, the app remembers and uses WASM. Close and reopen the app if tagging reports a WebGPU failure.

## Run locally

Requires Node.js 20 or later.

```sh
npm ci
npm run dev        # dev server
npm test           # unit tests (outfit engine, colour, tagging, backup)
npm run build      # type-check and production build
npm run preview    # serve the production build
```

GitHub Actions deploys the static build to GitHub Pages on every push to `main` (Pages source: **GitHub Actions**).

## How it works

| Part | Where |
| --- | --- |
| Storage | IndexedDB (`src/lib/db.ts`): item records with image blobs and CLIP embeddings, plus a cached label bank |
| Tagging | `src/lib/clip.ts`, `src/lib/ai.ts`, and `src/lib/tagging.ts`: CLIP image embedding vs precomputed text-label embeddings |
| Colour | `src/lib/color.ts`: border-background removal, k-means in Lab space, named palette, harmony rules |
| Outfits | `src/lib/outfit.ts`: prompt parsing, per-slot candidate pools, combination scoring, validation |
| Backup | `src/lib/backup.ts`: zip with `wardrobe.json` plus `images/` |

## Privacy and network behavior

- Photos are processed and stored only in this browser's storage on your device.
- The only network requests are the app itself (GitHub Pages) and the model files (Hugging Face, first use only). These reveal normal connection metadata to those providers. No photo, tag, or prompt is sent anywhere.
- Backups are files you save yourself; the app does not sync them.

## Design decisions

- **Manual crop instead of AI cutouts.** An on-device segmentation model ([Xenova/slimsam-77-uniform](https://huggingface.co/Xenova/slimsam-77-uniform), Apache-2.0) crashed iPhone Safari under both WebGPU and WASM. Copying a cutout from the Photos app was rejected as a workflow. Remote inference was rejected because photos must stay on the device and no cloud billing account is wanted. A drag-to-frame crop is reliable and fast. A future option is a lighter MIT-licensed matting model such as BiRefNet_lite, if it proves stable on the phone.
- **Deterministic outfit engine.** No LLM; the scoring rules are explainable and can only pick saved items.

## Model and dependency notices

The app code is licensed under MIT. Model weights and third-party dependencies are licensed separately; this project does not relicense them.

Tagging uses [Xenova/clip-vit-base-patch32](https://huggingface.co/Xenova/clip-vit-base-patch32), pinned to revision `d15189d7028b43f1d3e65039190477f6af591c2a` (vision q4 ~61 MB, text int8 ~62 MB). Its model repository does not declare a license. It references [OpenAI CLIP](https://github.com/openai/CLIP), whose code license is MIT, but the model card describes deployment as out of scope. This project uses it for personal, non-commercial use. Confirm the rights before redistributing or deploying the app as a product.

## License

MIT. See [LICENSE](LICENSE).
