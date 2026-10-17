# Original photographic hot-sauce bottle

This image-based relief model uses the unchanged `products/hero-hot-sauce.png`
photograph as its front texture. Its label, sauce, cap, and glass details are
photographic, rather than repainted materials or substitute typography.

- Source: `src/components/hot-sauce-model.ts`; call `loadBottlePhoto()` before
  creating or exporting the model.
- `original-hot-sauce.glb`: editable model with embedded photographic textures.
- The front surface follows the photograph's opaque silhouette and a rounded
  depth profile. The unseen rear continues unprinted edge patches from the photo.
- Side depth and unseen surfaces are inferred from one image, not measured scans.
  The model does not establish the real product's shape or manufacturing dimensions.
- Front projection uses an orthographic camera to preserve the supplied artwork.
- Drag, buttons, and keyboard rotation remain limited to -90 through +90 degrees.
- The same unchanged photo remains visible during loading or without WebGL.

No replacement label font or externally sourced geometry is used. The GLB is
provided as an export; the website builds the model from the original image.
