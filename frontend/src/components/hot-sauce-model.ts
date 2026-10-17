import * as THREE from "three";
export async function loadBottlePhoto() {
    const photo = new Image();
    photo.src = "/products/hero-hot-sauce.png";
    await photo.decode();
    return photo;
}
/** Real bottle surfaces; front artwork is UV-mapped from the supplied photo. */
export function createHotSauceModel(photo: HTMLImageElement) {
    const model = new THREE.Group();
    model.name = "Original Hot Sauce — full wrap";
    function texture(canvas: HTMLCanvasElement) {
        const map = new THREE.CanvasTexture(canvas);
        map.colorSpace = THREE.SRGBColorSpace;
        map.wrapS = THREE.RepeatWrapping;
        map.anisotropy = 8;
        return map;
    }
    const source = document.createElement("canvas");
    source.width = photo.naturalWidth;
    source.height = photo.naturalHeight;
    const sourceContext = source.getContext("2d", { willReadFrequently: true })!;
    sourceContext.drawImage(photo, 0, 0);
    const pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
    const artwork = document.createElement("canvas");
    artwork.width = 2048;
    artwork.height = 1024;
    const ctx = artwork.getContext("2d")!;
    ctx.fillStyle = "#eee4ce";
    ctx.fillRect(0, 0, 2048, 1024);
    const image = ctx.getImageData(0, 0, 2048, 1024);
    // Undo the photographed paper's tilt and cylindrical projection while keeping
    // its actual ink and grain. The front occupies 180 degrees of a 300-degree wrap.
    for (let y = 0; y < 1024; y++)
        for (let x = 512; x < 1536; x++) {
            const angle = (x / 2048 - .5) * Math.PI * 2;
            const u = .035 + .93 * (Math.sin(angle) + 1) / 2, v = .012 + .976 * y / 1023;
            const leftX = 244 - 99 * v, rightX = 850 - 110 * v;
            const leftY = 500 + 680 * v, rightY = 590 + 700 * v;
            const sx = Math.round(leftX + (rightX - leftX) * u), sy = Math.round(leftY + (rightY - leftY) * u);
            const from = (sy * source.width + sx) * 4, to = (y * 2048 + x) * 4;
            for (let channel = 0; channel < 3; channel++)
                image.data[to + channel] = pixels[from + channel];
        }
    // Carry the photographed paper edges into the sides and blend gently into
    // matching back stock, so the join has no abrupt color step.
    for (let y = 0; y < 1024; y++)
        for (let x = 0; x < 2048; x++) {
            if (x >= 512 && x < 1536)
                continue;
            const edge = x < 512 ? 512 : 1535;
            const distance = Math.abs(x - edge), mix = Math.min(1, distance / 260);
            const from = (y * 2048 + edge) * 4, to = (y * 2048 + x) * 4;
            const paper = [238, 228, 206];
            for (let c = 0; c < 3; c++)
                image.data[to + c] = image.data[from + c] * (1 - mix) + paper[c] * mix;
        }
    ctx.putImageData(image, 0, 0);
    // Remaining 60 degrees form a plain branded back panel. No invented nutrition.
    // Paint split copies across u=0/1; the actual texture seam is at the back.
    function backPanel(center: number) {
        ctx.save();
        ctx.translate(center, 0);
        ctx.textAlign = "center";
        ctx.fillStyle = "#292822";
        ctx.font = "600 48px Arial, sans-serif";
        ctx.fillText("ORIGINAL", 0, 320);
        ctx.fillText("HOT SAUCE", 0, 380);
        ctx.fillRect(-110, 435, 220, 2);
        ctx.font = "34px Arial, sans-serif";
        ctx.fillText("All Natural", 0, 505);
        ctx.fillText("Ingredients", 0, 545);
        ctx.font = "30px Arial, sans-serif";
        ctx.fillText("12 OZ (340 g)", 0, 690);
        ctx.restore();
    }
    backPanel(0);
    backPanel(2048);
    const labelMap = texture(artwork);
    const sauceCanvas = document.createElement("canvas");
    sauceCanvas.width = 512;
    sauceCanvas.height = 512;
    sauceCanvas.getContext("2d")!.drawImage(photo, 500, 340, 180, 145, 0, 0, 512, 512);
    const sauceMap = texture(sauceCanvas);
    const glass = new THREE.MeshPhysicalMaterial({ color: "#ffffff", transmission: 1, thickness: .6, roughness: .05, ior: 1.5, envMapIntensity: .85 });
    const sauce = new THREE.MeshPhysicalMaterial({ color: "#8d301a", map: sauceMap, roughness: .35, clearcoat: .3, envMapIntensity: .35 });
    function lathe(name: string, points: number[][], material: THREE.Material) {
        const geometry = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 128);
        const positions = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
        const low = Math.min(...points.map(p => p[1])), high = Math.max(...points.map(p => p[1]));
        for (let i = 0; i < uv.count; i++)
            uv.setY(i, (positions.getY(i) - low) / (high - low));
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = name;
        model.add(mesh);
        return mesh;
    }
    const profile = [[0, -1.62], [.48, -1.62], [.60, -1.60], [.67, -1.56], [.71, -1.49], [.72, -1.39], [.72, .68], [.715, .78], [.69, .88], [.64, .97], [.55, 1.05], [.51, 1.11], [.50, 1.20], [.50, 1.39], [0, 1.39]];
    lathe("Glass bottle with rounded heavy base", profile, glass);
    lathe("Dark red pepper sauce", profile.map(([r, y]) => [r * .965, y * .94 + .045]), sauce);
    const heel = new THREE.Mesh(new THREE.TorusGeometry(.62, .065, 16, 128), glass);
    heel.rotation.x = Math.PI / 2;
    heel.position.y = -1.54;
    heel.name = "Thick rounded glass heel";
    model.add(heel);
    const paper = new THREE.MeshStandardMaterial({ map: labelMap, roughness: .96, envMapIntensity: .15 });
    const label = new THREE.Mesh(new THREE.CylinderGeometry(.726, .726, 1.70, 160, 1, true), paper);
    label.rotation.y = Math.PI;
    label.position.y = -.36;
    label.name = "300 degree photographic label plus matching back panel";
    model.add(label);
    const capMaterial = new THREE.MeshStandardMaterial({ color: "#121516", metalness: .15, roughness: .34 });
    lathe("Ribbed black cap", [[0, 1.32], [.52, 1.32], [.55, 1.35], [.555, 1.40], [.555, 1.70], [.54, 1.75], [.50, 1.77], [0, 1.77]], capMaterial);
    const ribs = new THREE.InstancedMesh(new THREE.CylinderGeometry(.006, .006, .30, 5), capMaterial, 112);
    const transform = new THREE.Object3D();
    for (let i = 0; i < 112; i++) {
        const a = i / 112 * Math.PI * 2;
        transform.position.set(Math.sin(a) * .555, 1.55, Math.cos(a) * .555);
        transform.updateMatrix();
        ribs.setMatrixAt(i, transform.matrix);
    }
    ribs.name = "Fine cap grip ribs";
    model.add(ribs);
    const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    model.position.sub(center);
    model.userData.pivotOffset = center.toArray();
    return model;
}
