# Wardrobe

A private, local-first digital wardrobe and outfit generator, built as an installable iPhone PWA.

## Current status

This is an early prototype. It currently has device-test screens for local clothing recognition and tap-to-select garment segmentation; it does not yet save a wardrobe or generate outfits.

The CLIP test downloads about 190 MB of quantized model files from Hugging Face the first time it runs. The segmentation test downloads about 14 MB of quantized SlimSAM model files. Photos are processed in the browser and are not uploaded by this app.

## Run locally

Requires Node.js 20 or later.

```sh
npm ci
npm run dev
```

For a production build:

```sh
npm run build
npm run preview
```

## Try on iPhone

GitHub Actions deploys the static PWA to GitHub Pages when changes are pushed to `main`.

1. In the repository settings, open **Pages** and set the source to **GitHub Actions**.
2. Wait for the **Deploy PWA to GitHub Pages** workflow to finish successfully.
3. Open `https://liranbratk.github.io/wardrobe-app/` in Safari on the iPhone. Use **Share → Add to Home Screen** to install the PWA.
4. Choose a clothing photo and run **Test on-device tagging**. Use Wi-Fi for the initial model download.
5. Note the backend and cold load/inference times, and whether Safari freezes, reloads, or evicts the page.

The UI reports model-load and inference times separately. iOS Safari does not expose a reliable standard page-memory measurement to the app.
The spike releases the loaded model after each run to reduce memory pressure when selecting another photo. The downloaded model files remain browser-cached, so subsequent tests do not need to download them again.

## Privacy and network behavior

- The app has no account, backend, or image-upload endpoint.
- The selected photo is passed directly to in-browser inference.
- The model is fetched from Hugging Face on first use; the runtime assets are served with the app. These requests disclose normal connection metadata to those providers, but this app does not send the selected photo or wardrobe data.
- Browser storage can be evicted. Export/import backups and inventory storage are planned but not implemented yet.

## Model and dependency notices

The app code is licensed under MIT. Model weights, model usage terms, and third-party dependencies are licensed separately; this project does not relicense them. Do not treat the current CLIP model as approved for a released product.

The current spike uses [Xenova/clip-vit-base-patch32](https://huggingface.co/Xenova/clip-vit-base-patch32), pinned to revision `d15189d7028b43f1d3e65039190477f6af591c2a`. Its model repository does not declare a license. The repository references [OpenAI CLIP](https://github.com/openai/CLIP), whose upstream code license is MIT, but its model card says deployment is out of scope and calls for task-specific testing. Rights and suitability must be confirmed before relying on these weights.

The segmentation spike uses [Xenova/slimsam-77-uniform](https://huggingface.co/Xenova/slimsam-77-uniform), pinned to revision `5850ab45f587c112167512ffef949107115e26a0`. Its model repository declares Apache-2.0. The model is used only to test tap-prompt segmentation on the owner's phone; it is not bundled in the app.

## Project constraints

- No paid APIs, subscriptions, or always-on backend.
- User photos and wardrobe data stay on-device by default.
- Suggestions must only reference real items in the local inventory.
- The target is an installable PWA; native iOS/Xcode workflows are not used.

## License

The app code is licensed under the MIT License. See [LICENSE](LICENSE).
