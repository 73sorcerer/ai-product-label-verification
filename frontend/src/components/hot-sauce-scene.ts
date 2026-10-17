import * as THREE from "three";
import { createHotSauceModel } from "./hot-sauce-model";
export { loadBottlePhoto } from "./hot-sauce-model";
export function createBottleScene(host: HTMLElement, onFailure: () => void, photo: HTMLImageElement) {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .85;
    const canvas = renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 30);
    camera.position.set(0, .15, 8);
    camera.lookAt(0, 0, 0);
    // A studio environment map supplies broad photographic reflections, rather
    // than baking highlights into the glass or adding another rendering library.
    const pmrem = new THREE.PMREMGenerator(renderer), room = new THREE.Scene();
    room.background = new THREE.Color(.35, .35, .35);
    const panels: THREE.Mesh[] = [];
    for (const [width, height, x, y, z, intensity] of [[2, 5, -3, 2, 3, 3], [.8, 4, 3, 1, 1, 2], [3, 2, 0, 5, 0, 1.5]]) {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity) }));
        panel.position.set(x, y, z);
        panel.lookAt(0, 0, 0);
        room.add(panel);
        panels.push(panel);
    }
    const environment = pmrem.fromScene(room, .04);
    scene.environment = environment.texture;
    scene.environmentIntensity = .7;
    panels.forEach(panel => { panel.geometry.dispose(); (panel.material as THREE.Material).dispose(); });
    pmrem.dispose();
    const light = new THREE.DirectionalLight(0xfff3df, 2);
    light.position.set(-3, 4, 5);
    scene.add(light);
    const outer = new THREE.Group();
    outer.name = "Fixed resting tilt";
    outer.rotation.z = -.26;
    const spin = new THREE.Group();
    spin.name = "Centered Y rotation";
    const model = createHotSauceModel(photo);
    spin.add(model);
    outer.add(spin);
    scene.add(outer);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const TAU = Math.PI * 2;
    let target = 0, velocity = 0, dragging = false, returning = false, frame = 0, idleTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false, visible = true, lastFrame = 0;
    let arrow: {
        from: number;
        to: number;
        start: number;
    } | null = null;
    function schedule() { if (!frame && !disposed)
        frame = requestAnimationFrame(draw); }
    function armIdle() {
        clearTimeout(idleTimer);
        if (motion.matches || dragging)
            return;
        idleTimer = setTimeout(() => { if (disposed || motion.matches || dragging)
            return; velocity = 0; arrow = null; returning = true; target = Math.round(spin.rotation.y / TAU) * TAU; schedule(); }, 3000);
    }
    function draw(time: number) {
        frame = 0;
        if (disposed || !visible || document.hidden) {
            lastFrame = 0;
            return;
        }
        const dt = lastFrame ? Math.min((time - lastFrame) / 16.667, 10) : 1;
        lastFrame = time;
        if (arrow) {
            const progress = Math.min(1, (time - arrow.start) / 400), ease = 1 - Math.pow(1 - progress, 3);
            spin.rotation.y = THREE.MathUtils.lerp(arrow.from, arrow.to, ease);
            if (progress === 1)
                arrow = null;
        }
        else {
            if (!dragging && !motion.matches && !returning && Math.abs(velocity) > .0001) {
                target += velocity * dt;
                velocity *= Math.pow(.92, dt);
            }
            else if (!dragging)
                velocity = 0;
            spin.rotation.y += (target - spin.rotation.y) * (motion.matches ? 1 : returning ? 1 - Math.pow(.975, dt) : .1);
            if (Math.abs(target - spin.rotation.y) < .00005)
                spin.rotation.y = target;
        }
        // Read-only telemetry for browser verification of the immutable world pivot.
        canvas.dataset.angle = String(spin.rotation.y);
        canvas.dataset.target = String(target);
        canvas.dataset.tilt = String(outer.rotation.z);
        canvas.dataset.pivot = JSON.stringify(spin.getWorldPosition(new THREE.Vector3()).toArray());
        canvas.dataset.pose = JSON.stringify({ position: outer.position.toArray(), scale: outer.scale.toArray() });
        renderer.render(scene, camera);
        if (dragging || arrow || Math.abs(velocity) > .0001 || spin.rotation.y !== target)
            schedule();
        else
            lastFrame = 0;
    }
    function resize() { const { width, height } = host.getBoundingClientRect(); if (!width || !height)
        return; renderer.setSize(width, height, false); const aspect = width / height, halfHeight = Math.max(1.92, 1.2 / aspect); camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix(); schedule(); }
    function lost(event: Event) { event.preventDefault(); onFailure(); }
    function changedMotion() { dragging = false; velocity = 0; arrow = null; returning = false; target = spin.rotation.y; clearTimeout(idleTimer); if (!motion.matches)
        armIdle(); schedule(); }
    canvas.addEventListener("webglcontextlost", lost);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible)
        schedule(); });
    intersection.observe(host);
    document.addEventListener("visibilitychange", schedule);
    motion.addEventListener("change", changedMotion);
    resize();
    return {
        beginDrag() { if (motion.matches)
            return null; clearTimeout(idleTimer); arrow = null; returning = false; velocity = 0; dragging = true; target = spin.rotation.y; schedule(); return THREE.MathUtils.radToDeg(target); },
        dragTo(degrees: number, elapsedMs: number) { if (!dragging || motion.matches)
            return; const next = THREE.MathUtils.degToRad(degrees); const speed = THREE.MathUtils.clamp((next - target) * 16.667 / Math.max(elapsedMs, 8), -.12, .12); velocity = velocity * .5 + speed * .5; target = next; schedule(); },
        endDrag(momentum = true, releaseDelay = 0) { dragging = false; velocity = !momentum || motion.matches ? 0 : velocity * Math.exp(-Math.max(0, releaseDelay) / 250); armIdle(); schedule(); },
        step(direction: number) { dragging = false; velocity = 0; returning = false; target += direction * Math.PI / 4; arrow = motion.matches ? null : { from: spin.rotation.y, to: target, start: performance.now() }; armIdle(); schedule(); },
        reset() { dragging = false; velocity = 0; returning = false; target = Math.round(spin.rotation.y / TAU) * TAU; arrow = motion.matches ? null : { from: spin.rotation.y, to: target, start: performance.now() }; armIdle(); schedule(); },
        dispose() {
            disposed = true;
            clearTimeout(idleTimer);
            cancelAnimationFrame(frame);
            resizeObserver.disconnect();
            intersection.disconnect();
            document.removeEventListener("visibilitychange", schedule);
            motion.removeEventListener("change", changedMotion);
            canvas.removeEventListener("webglcontextlost", lost);
            const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
            model.traverse(object => { if (object instanceof THREE.Mesh) {
                geometries.add(object.geometry);
                for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                    materials.add(material);
                    for (const value of Object.values(material))
                        if (value instanceof THREE.Texture)
                            textures.add(value);
                }
                if (object instanceof THREE.InstancedMesh)
                    object.dispose();
            } });
            geometries.forEach(value => value.dispose());
            materials.forEach(value => value.dispose());
            textures.forEach(value => value.dispose());
            environment.dispose();
            renderer.dispose();
            canvas.remove();
        },
    };
}
