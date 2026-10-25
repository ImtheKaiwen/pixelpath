import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const COLORS = {
  yellow: "#f0ca55",
  pink: "#ec91b9",
  darkpink: "#bb668d",
  white: "#e9e8e4",
  black: "#343434",
  blue: "#65c5cf",
  brown: "#916b51",
  other: "#a4a29c",
};

class Stage {
  constructor(host, onSelect) {
    this.host = host;
    this.onSelect = onSelect;
    this.model = null;
    this.step = 1;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#f5f6f4");
    this.scene.fog = new THREE.Fog("#f5f6f4", 80, 380);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 600;
    this.controls.screenSpacePanning = true;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd0ca, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(30, 50, 35);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xc9e8df, 0.8);
    fill.position.set(-25, 18, -20);
    this.scene.add(fill);
    this.content = new THREE.Group();
    this.scene.add(this.content);
    this.grid = new THREE.GridHelper(120, 24, 0xd3d7d3, 0xe7e9e6);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.42;
    this.scene.add(this.grid);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.groups = [];
    this.geometryCache = new Map();
    this.frames = 0;
    this.running = false;
    this.rotating = false;
    this._render = this._render.bind(this);
    this.controls.addEventListener("change", () => this.invalidate(3));
    this.renderer.domElement.addEventListener("pointerdown", () =>
      this.invalidate(30),
    );
    this.renderer.domElement.addEventListener(
      "wheel",
      () => this.invalidate(24),
      { passive: true },
    );
    this.renderer.domElement.addEventListener("click", (event) =>
      this.pick(event),
    );
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }
  setTheme(theme) {
    const dark = theme === "dark";
    const background = dark ? "#1b1d1b" : "#f5f6f4";
    this.scene.background.set(background);
    this.scene.fog.color.set(background);
    this.grid.material.opacity = dark ? 0.12 : 0.42;
    this.invalidate(3);
  }
  dimensions(piece) {
    const size = piece.size || 1;
    return [piece.sx || size, piece.sy || size, piece.sz || size];
  }
  geometry(sx, sy = sx, sz = sx) {
    const key = `${sx}:${sy}:${sz}`;
    if (!this.geometryCache.has(key)) {
      const geometry = new THREE.BoxGeometry(sx * 0.96, sy * 0.96, sz * 0.96);
      geometry.translate(0, 0, 0);
      this.geometryCache.set(key, geometry);
    }
    return this.geometryCache.get(key);
  }
  clear() {
    for (const item of this.groups) {
      this.content.remove(item.built, item.future);
      item.built.material.dispose();
      item.future.material.dispose();
    }
    this.groups = [];
    if (this.current) {
      this.content.remove(this.current);
      this.current.material.dispose();
      this.current = null;
    }
  }
  load(model) {
    this.clear();
    this.model = model;
    const buckets = new Map();
    model.pieces.forEach((piece, index) => {
      const [sx, sy, sz] = this.dimensions(piece);
      const key = `${sx}:${sy}:${sz}:${piece.color}`;
      if (!buckets.has(key))
        buckets.set(key, { sx, sy, sz, color: piece.color, items: [] });
      buckets.get(key).items.push({ piece, step: index + 1 });
    });
    for (const bucket of buckets.values()) {
      const color = COLORS[bucket.color] || COLORS.other,
        geometry = this.geometry(bucket.sx, bucket.sy, bucket.sz),
        count = bucket.items.length;
      const built = new THREE.InstancedMesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.72,
          metalness: 0,
        }),
        count,
      );
      const future = new THREE.InstancedMesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.9,
          transparent: true,
          opacity: 0.075,
          depthWrite: false,
        }),
        count,
      );
      built.frustumCulled = false;
      future.frustumCulled = false;
      built.userData.kind = "built";
      future.userData.kind = "future";
      this.content.add(future, built);
      this.groups.push({
        ...bucket,
        built,
        future,
        builtSteps: [],
        futureSteps: [],
      });
    }
    this.current = new THREE.Mesh(
      this.geometry(1),
      new THREE.MeshStandardMaterial({
        color: "#10a37f",
        roughness: 0.55,
        emissive: "#0b5e4d",
        emissiveIntensity: 0.13,
      }),
    );
    this.current.renderOrder = 3;
    this.content.add(this.current);
    const [x, , z] = model.dimensions;
    this.grid.position.set(x / 2, -0.08, z / 2);
    this.grid.scale.set(
      Math.max(1, Math.max(x, z) / 120),
      1,
      Math.max(1, Math.max(x, z) / 120),
    );
    this.show(1, { future: false, highlight: true, follow: false });
    this.focusAll();
  }
  matrixFor(piece, target = new THREE.Matrix4()) {
    const [sx, sy, sz] = this.dimensions(piece);
    const position = new THREE.Vector3(
      piece.x + sx / 2,
      piece.y + sy / 2,
      piece.z + sz / 2,
    );
    return target.compose(
      position,
      new THREE.Quaternion(),
      new THREE.Vector3(1, 1, 1),
    );
  }
  show(step, { future = false, highlight = true, follow = false } = {}) {
    if (!this.model) return;
    this.step = step;
    const matrix = new THREE.Matrix4();
    for (const group of this.groups) {
      let b = 0,
        f = 0;
      group.builtSteps = [];
      group.futureSteps = [];
      for (const entry of group.items) {
        if (entry.step < step) {
          group.built.setMatrixAt(b++, this.matrixFor(entry.piece, matrix));
          group.builtSteps.push(entry.step);
        } else if (entry.step > step && future) {
          group.future.setMatrixAt(f++, this.matrixFor(entry.piece, matrix));
          group.futureSteps.push(entry.step);
        }
      }
      group.built.count = b;
      group.future.count = f;
      group.built.instanceMatrix.needsUpdate = true;
      group.future.instanceMatrix.needsUpdate = true;
      group.future.visible = future && f > 0;
      group.built.visible = b > 0;
    }
    const piece = this.model.pieces[step - 1];
    if (piece) {
      const [sx, sy, sz] = this.dimensions(piece);
      this.current.geometry = this.geometry(sx, sy, sz);
      this.current.position.set(
        piece.x + sx / 2,
        piece.y + sy / 2,
        piece.z + sz / 2,
      );
      this.current.material.color.set(
        highlight ? "#10a37f" : COLORS[piece.color] || COLORS.other,
      );
      this.current.material.emissiveIntensity = highlight ? 0.16 : 0;
      this.current.visible = true;
    }
    if (follow) this.focusBuilt(step);
    else this.invalidate(3);
  }
  frameBox(box) {
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 2.5);
    const direction = new THREE.Vector3(1.1, 0.78, 1.35).normalize();
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, radius * 2.25);
    this.camera.near = Math.max(0.03, radius / 100);
    this.camera.far = Math.max(500, radius * 30);
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.invalidate(8);
  }
  focusBuilt(step = this.step) {
    if (!this.model) return;
    const box = new THREE.Box3();
    for (let i = 0; i < Math.min(step, this.model.pieces.length); i++) {
      const p = this.model.pieces[i];
      const [sx, sy, sz] = this.dimensions(p);
      box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z));
      box.expandByPoint(new THREE.Vector3(p.x + sx, p.y + sy, p.z + sz));
    }
    this.frameBox(box);
  }
  focusAll() {
    if (!this.model) return;
    const [x, y, z] = this.model.dimensions;
    this.frameBox(
      new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, y, z)),
    );
  }
  setRotating(value) {
    this.rotating = value;
    this.controls.autoRotate = value;
    this.controls.autoRotateSpeed = 0.75;
    this.invalidate(3);
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (w < 2 || h < 2) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.invalidate(2);
  }
  invalidate(frames = 2) {
    this.frames = Math.max(this.frames, frames);
    if (!this.running) {
      this.running = true;
      requestAnimationFrame(this._render);
    }
  }
  _render() {
    if (!this.running) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frames = Math.max(0, this.frames - 1);
    if (this.frames > 0 || this.rotating) requestAnimationFrame(this._render);
    else this.running = false;
  }
  pick(event) {
    if (!this.model) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const objects = [
      this.current,
      ...this.groups
        .flatMap((g) => [g.built, g.future])
        .filter((o) => o.visible),
    ];
    const hit = this.raycaster.intersectObjects(objects, false)[0];
    if (!hit) return;
    if (hit.object === this.current) this.onSelect(this.step);
    else {
      const group = this.groups.find(
        (g) => g.built === hit.object || g.future === hit.object,
      );
      const steps =
        hit.object === group.built ? group.builtSteps : group.futureSteps;
      this.onSelect(steps[hit.instanceId]);
    }
  }
  destroy() {
    this.running = false;
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clear();
    for (const g of this.geometryCache.values()) g.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

const Viewer3D = forwardRef(function Viewer3D(
  { model, step, showFuture, highlight, follow, onSelect, theme },
  ref,
) {
  const hostRef = useRef(null),
    stageRef = useRef(null);
  useEffect(() => {
    stageRef.current = new Stage(hostRef.current, onSelect);
    return () => stageRef.current?.destroy();
  }, []);
  useEffect(() => {
    if (stageRef.current) {
      stageRef.current.onSelect = onSelect;
    }
  }, [onSelect]);
  useEffect(() => {
    stageRef.current?.setTheme(theme);
  }, [theme]);
  useEffect(() => {
    if (!stageRef.current) return;
    stageRef.current.load(model);
    stageRef.current.show(step, { future: showFuture, highlight, follow });
  }, [model]);
  useEffect(() => {
    stageRef.current?.show(step, { future: showFuture, highlight, follow });
  }, [step, showFuture, highlight, follow]);
  useImperativeHandle(
    ref,
    () => ({
      focusAll: () => stageRef.current?.focusAll(),
      focusBuilt: () => stageRef.current?.focusBuilt(),
      setRotating: (v) => stageRef.current?.setRotating(v),
    }),
    [],
  );
  return <div className="viewer-canvas" ref={hostRef} />;
});

export default Viewer3D;
