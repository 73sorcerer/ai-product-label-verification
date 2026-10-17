import * as THREE from "three";

/** Load the unchanged original photograph; never repaint the label. */
export async function loadBottlePhoto() {
  const photo = new Image();
  photo.src = "/products/hero-hot-sauce.png";
  await photo.decode();
  return photo;
}

/** Image-based relief model: the front is projected directly from the photo.
 * The reverse surface continues the edge colors; unseen sides are inferred.
 */
export function createHotSauceModel(photo: HTMLImageElement) {
  const width = photo.naturalWidth, height = photo.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(photo, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  const outlines: { left: number; right: number; y: number }[] = [];
  for (let y = 0; y < height; y++) {
    let left = width, right = -1;
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 210) { left = Math.min(left, x); right = x; }
    }
    if (right > left) outlines.push({ left, right, y });
  }
  if (!outlines.length) throw new Error("Bottle photograph has no opaque silhouette");
  const map = new THREE.Texture(photo);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; map.needsUpdate = true;
  // Extend small unprinted photographic patches onto the inferred sides.
  // Keep their real paper grain, sauce flecks and cap detail rather than painting
  // replacement materials or stretching a single pixel column.
  const sideCanvas = document.createElement("canvas"); sideCanvas.width = 512; sideCanvas.height = height;
  const sideContext = sideCanvas.getContext("2d")!, sidePixels = sideContext.createImageData(512, height);
  for (let y = 0; y < height; y++) {
    const outline = outlines[Math.max(0, Math.min(outlines.length - 1, y - outlines[0].y))];
    const span = outline.right - outline.left;
    for (let x = 0; x < 512; x++) {
      const weight = x / 511;
      const leftX = Math.round(outline.left + span * (.015 + .10 * Math.sin(weight * Math.PI)));
      const rightX = Math.round(outline.right - span * (.015 + .10 * Math.sin(weight * Math.PI)));
      const leftOffset = (outline.y * width + leftX) * 4, rightOffset = (outline.y * width + rightX) * 4;
      const offset = (y * 512 + x) * 4;
      for (let channel = 0; channel < 3; channel++) sidePixels.data[offset + channel] = pixels[leftOffset + channel] * (1 - weight) + pixels[rightOffset + channel] * weight;
      sidePixels.data[offset + 3] = 255;
    }
  }
  sideContext.putImageData(sidePixels, 0, 0);
  const sideMap = new THREE.CanvasTexture(sideCanvas); sideMap.colorSpace = THREE.SRGBColorSpace;
  const scale = 3.4 / height;
  const bottle = new THREE.Group(); bottle.name = "Original photographic hot sauce bottle";
  const rowCount = 256, segments = 96;
  function surface(back: boolean) {
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [], colors: number[] = [];
    for (let row = 0; row <= rowCount; row++) {
      const outline = outlines[Math.round(row / rowCount * (outlines.length - 1))];
      const center = (outline.left + outline.right) / 2, radius = (outline.right - outline.left) / 2;
      for (let segment = 0; segment <= segments; segment++) {
        const theta = -Math.PI / 2 + segment / segments * Math.PI + (back ? Math.PI : 0);
        const x = center + Math.sin(theta) * radius;
        positions.push((x - width / 2) * scale, (height / 2 - outline.y) * scale, Math.cos(theta) * radius * scale);
        // Only the unseen rear is filled by sampling unprinted edge stock.
        // Front UVs preserve the actual photographed label and highlights.
        uvs.push(back ? (Math.sin(theta) + 1) / 2 : x / width, 1 - outline.y / height);
        const shade = back ? .82 + Math.abs(Math.sin(theta)) * .18 : 1;
        colors.push(shade, shade, shade);
      }
    }
    for (let row = 0; row < rowCount; row++) for (let segment = 0; segment < segments; segment++) {
      const a = row * (segments + 1) + segment, b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({ map: back ? sideMap : map, alphaTest: .4, vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = back ? "Inferred side surface" : "Unchanged photograph projection";
    bottle.add(mesh);
  }
  surface(false); surface(true);
  return bottle;
}
