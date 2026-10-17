import * as THREE from "three";
import { createHotSauceModel } from "./hot-sauce-model";
export { loadBottlePhoto } from "./hot-sauce-model";

export function createBottleScene(host: HTMLElement, onFailure: () => void, photo: HTMLImageElement) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.domElement.setAttribute("aria-hidden", "true"); host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  // Orthographic projection keeps the front view faithful to the supplied image.
  const camera = new THREE.OrthographicCamera(-2, 2, 1.8, -1.8, .1, 30);
  camera.position.set(0, 0, 8);
  const model = createHotSauceModel(photo); scene.add(model);
  let frame = 0, angle = 0, target = 0, disposed = false, visible = true;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function draw() {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    angle = motion.matches ? target : THREE.MathUtils.lerp(angle, target, .14);
    if (Math.abs(angle - target) < .0005) angle = target;
    model.rotation.y = angle; renderer.domElement.dataset.angle = String(angle);
    renderer.render(scene, camera);
    if (angle !== target) frame = requestAnimationFrame(draw);
  }
  function schedule() { if (!frame && !disposed) frame = requestAnimationFrame(draw); }
  function resize() {
    const { width, height } = host.getBoundingClientRect(); if (!width || !height) return;
    renderer.setSize(width, height, false);
    const aspect = width / height, halfHeight = Math.max(1.8, 1.2 / aspect);
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix(); schedule();
  }
  function lost(event: Event) { event.preventDefault(); onFailure(); }
  renderer.domElement.addEventListener("webglcontextlost", lost);
  const observer = new ResizeObserver(resize); observer.observe(host);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) schedule(); }); intersection.observe(host);
  document.addEventListener("visibilitychange", schedule); motion.addEventListener("change", schedule); resize();
  return {
    rotate(degrees: number) { target = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(degrees, -90, 90)); schedule(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect();
      document.removeEventListener("visibilitychange", schedule); motion.removeEventListener("change", schedule);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      model.traverse(object => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            materials.add(material);
            if (material.map) textures.add(material.map);
            if (material.bumpMap) textures.add(material.bumpMap);
          }
          if (object instanceof THREE.InstancedMesh) object.dispose();
        }
      });
      geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose());
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
