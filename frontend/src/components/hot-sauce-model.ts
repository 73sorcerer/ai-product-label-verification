import * as THREE from "three";

/** Original product geometry. Y is up; the label faces +Z. */
export function createHotSauceModel() {
  const bottle = new THREE.Group();
  bottle.name = "VeriLabel Original Hot Sauce";
  let seed = 651;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  function texture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    paint(canvas.getContext("2d")!);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace; result.anisotropy = 4;
    return result;
  }
  const sauceMap = texture(1024, 1024, ctx => {
    ctx.fillStyle = "#9c2509"; ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 38000; i++) {
      ctx.fillStyle = ["#d54712", "#6c1407", "#bb350c", "#ec7b25"][Math.floor(random() * 4)];
      ctx.globalAlpha = .15 + random() * .35;
      ctx.beginPath(); ctx.ellipse(random() * 1024, random() * 1024, .4 + random() * 2.2, .5 + random() * 3, random() * 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  const labelMap = texture(2048, 1024, ctx => {
    ctx.fillStyle = "#f4edda"; ctx.fillRect(0, 0, 2048, 1024);
    for (let i = 0; i < 55000; i++) {
      ctx.fillStyle = random() > .5 ? "#a89776" : "#fffef4"; ctx.globalAlpha = .12;
      ctx.fillRect(random() * 2048, random() * 1024, 1 + random() * 2, 1 + random() * 2);
    }
    ctx.globalAlpha = 1; ctx.fillStyle = "#171b19"; ctx.textAlign = "center";
    function condensed(text: string, y: number, size: number, width: number) {
      ctx.save(); ctx.font = `900 ${size}px Impact, "Arial Narrow", sans-serif`;
      const scale = width / ctx.measureText(text).width;
      ctx.translate(1024, y); ctx.scale(scale, 1); ctx.fillText(text, 0, 0); ctx.restore();
    }
    condensed("ORIGINAL", 330, 235, 650); condensed("HOT SAUCE", 580, 235, 690);
    ctx.font = "500 38px Arial, sans-serif"; ctx.fillText("All Natural Ingredients", 1024, 710);
    ctx.fillRect(925, 774, 198, 3);
    ctx.font = "600 34px Arial, sans-serif"; ctx.fillText("NET WT. 12 OZ (340 g)", 1024, 857);
    ctx.textAlign = "left"; ctx.font = "bold 31px Arial, sans-serif"; ctx.fillText("ORIGINAL HOT SAUCE", 80, 300);
    ctx.font = "24px Arial, sans-serif";
    ["Made with simple ingredients.", "Shake well before use.", "Refrigerate after opening.", "VeriLabel demonstration product."].forEach((line, i) => ctx.fillText(line, 80, 365 + i * 48));
    for (let x = 80; x < 380; x += 6) ctx.fillRect(x, 650, random() > .5 ? 2 : 4, 150);
    ctx.font = "22px monospace"; ctx.fillText("0 12345 67890 29", 80, 835);
  });
  function lathe(name: string, profile: number[][], material: THREE.Material) {
    const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 128);
    const positions = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
    const minY = Math.min(...profile.map(point => point[1])), maxY = Math.max(...profile.map(point => point[1]));
    for (let i = 0; i < uv.count; i++) uv.setY(i, (positions.getY(i) - minY) / (maxY - minY));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; bottle.add(mesh); return mesh;
  }
  const profile = [[0, -1.62], [.50, -1.62], [.61, -1.60], [.67, -1.55], [.69, -1.46], [.69, .70], [.68, .83], [.64, .95], [.55, 1.05], [.49, 1.11], [.48, 1.23], [.48, 1.40], [0, 1.40]];
  lathe("Pepper sauce", profile.map(([r, y]) => [r * .985, y + .015]), new THREE.MeshPhysicalMaterial({ map: sauceMap, roughness: .32, clearcoat: .6, clearcoatRoughness: .18, envMapIntensity: .55 }));
  // Thin transparent shell over opaque sauce avoids the background refraction
  // artifacts of screen-space transmission on nested, filled containers.
  const glass = new THREE.MeshPhysicalMaterial({ color: "#fff4e8", roughness: .12, transparent: true, opacity: .12, depthWrite: false, ior: 1.47, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: .7 });
  lathe("Rounded glass bottle", profile, glass);
  function ring(name: string, radius: number, tube: number, y: number, material: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 128), material);
    mesh.rotation.x = Math.PI / 2; mesh.position.y = y; mesh.name = name; bottle.add(mesh);
  }
  ring("Heavy glass heel", .615, .052, -1.56, glass);
  ring("Glass neck thread", .49, .025, 1.17, glass);
  ring("Glass neck rim", .49, .024, 1.28, glass);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(.697, .697, 1.65, 128, 1, true), new THREE.MeshStandardMaterial({ map: labelMap, roughness: .87 }));
  label.rotation.y = Math.PI; label.position.y = -.37; label.name = "Cream paper wrap label"; bottle.add(label);
  const capMaterial = new THREE.MeshStandardMaterial({ color: "#171b1c", roughness: .34, metalness: .15 });
  lathe("Black screw cap", [[0, 1.32], [.50, 1.32], [.53, 1.34], [.535, 1.38], [.535, 1.70], [.52, 1.75], [.49, 1.77], [0, 1.77]], capMaterial);
  const ribs = new THREE.InstancedMesh(new THREE.CylinderGeometry(.006, .006, .30, 5), capMaterial, 112);
  ribs.name = "112 fine cap grip ribs";
  const transform = new THREE.Object3D();
  for (let i = 0; i < 112; i++) {
    const angle = i / 112 * Math.PI * 2;
    transform.position.set(Math.sin(angle) * .535, 1.55, Math.cos(angle) * .535); transform.updateMatrix(); ribs.setMatrixAt(i, transform.matrix);
  }
  bottle.add(ribs); ring("Cap lower band", .525, .017, 1.36, capMaterial);
  return bottle;
}
