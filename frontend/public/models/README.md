# Original Hot Sauce ? full-turn model

The current model has rounded glass geometry, a dark red sauce mesh, a ribbed
black cap, and a continuous paper label. Front artwork is mapped from the
unchanged `products/hero-hot-sauce.png`; the back has a matching branded panel.
This is an artistic model, not a measured scan of the product.

- Source: `src/components/hot-sauce-model.ts`; load `loadBottlePhoto()` first.
- `original-hot-sauce.glb`: editable export with embedded textures.
- Artwork layout: 300-degree main paper wrap and a matching 60-degree back panel;
  the texture repeats horizontally with its join placed at the back.
- Glass: transmission 1, thickness 0.6, roughness 0.05, IOR 1.5. Studio reflections
  are supplied at runtime by `hot-sauce-scene.ts`, not embedded into the GLB.
- The model's bounding-box center is offset to the inner group's origin.
  The outer group maintains a fixed -0.26-radian Z tilt while the inner group
  turns freely around Y. Dragging never changes position or scale.
- Arrows turn 45 degrees in 400ms. Drag uses target-angle smoothing and decaying
  momentum. After 3 seconds without interaction, it eases to the nearest front.
- Reduced motion disables drag, momentum, easing and idle return; arrow buttons
  and keys remain usable. Home/the reset button returns to the nearest front.
- The unchanged original photo remains visible during loading or without WebGL.

Geometry and materials are authored for this project. No replacement label font
or externally sourced geometry is used. The website builds the model locally;
its optional GLB download is not part of the landing page's loading payload.
