# Original Hot Sauce

Original VeriLabel model, authored for this project. No downloaded geometry,
third-party product branding, or purchased textures are included.

- `original-hot-sauce.glb`: editable export with embedded label and sauce textures.
- Authoritative source: `src/components/hot-sauce-model.ts`.
- The website generates the same model locally, so it does not download the GLB.
- Separate parts: glass shell, sauce, paper label, cap, cap ribs, and glass rings.
- Coordinates: Y up, label toward +Z, height 3.39 scene units. Dimensions are
  artistic proportions, not manufacturing measurements.
- Rotation is limited by `hot-sauce-scene.ts` to -90 through +90 degrees.

The model recreates the existing product's appearance; it is not a scan of the
photograph. The unchanged original photograph remains the loading/no-WebGL
fallback. Rendering and the GLB use the project's existing license.
