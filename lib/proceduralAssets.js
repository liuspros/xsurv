import * as THREE from "three";

export function makeGripTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#141414";
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = "#050505";
  for (let y = 0; y < 32; y += 4) {
    for (let x = y % 8 === 0 ? 0 : 2; x < 32; x += 4) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 4);
  return tex;
}

export function makeFloorTexture() {
  const size = 512, cell = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#233623";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= size; i += cell) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  for (let n = 0; n < 40; n++) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 20, 20);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  return tex;
}

export function makeGlowTexture(inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function makeCloudTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const ctx = c.getContext("2d");
  for (let i = 0; i < 7; i++) {
    const x = 60 + Math.random() * 136, y = 50 + Math.random() * 30, r = 30 + Math.random() * 36;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

export function makeStarTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 16);
  return new THREE.CanvasTexture(c);
}

// Placeholder gun built from primitives. Replace by dropping a real
// /public/models/gun.glb in — see README.
export function buildProceduralGun() {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x3b3e42, roughness: 0.32, metalness: 0.85 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.4, metalness: 0.7 });
  const polymer = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.75, metalness: 0.1 });
  const gripMat = new THREE.MeshStandardMaterial({ map: makeGripTexture(), roughness: 0.85, metalness: 0.05 });

  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.4), steel);
  slide.position.set(0, 0.03, -0.02);
  group.add(slide);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.28), polymer);
  frame.position.set(0, -0.03, 0.02);
  group.add(frame);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 12), darkSteel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, -0.32);
  group.add(barrel);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.24), darkSteel);
  rail.position.set(0, 0.078, -0.06);
  group.add(rail);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.2, 0.09), gripMat);
  grip.position.set(0, -0.15, 0.13);
  grip.rotation.x = 0.28;
  group.add(grip);

  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 12, Math.PI), darkSteel);
  guard.rotation.z = Math.PI;
  guard.position.set(0, -0.05, 0.05);
  group.add(guard);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.075), darkSteel);
  mag.position.set(0, -0.16, 0.03);
  mag.rotation.x = -0.15;
  group.add(mag);

  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.03, 0.014), darkSteel);
  frontSight.position.set(0, 0.09, -0.42);
  group.add(frontSight);

  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.02), darkSteel);
  rearSight.position.set(0, 0.085, 0.14);
  group.add(rearSight);

  return group;
}

// Placeholder enemy built from a capsule (or box fallback on very old
// three.js versions). Replace by dropping a real /public/models/enemy.glb
// in — see README. Returns { mesh } to match the shape of a loaded model.
export function buildProceduralEnemy() {
  const geo =
    typeof THREE.CapsuleGeometry === "function"
      ? new THREE.CapsuleGeometry(0.5, 1.2, 4, 8)
      : new THREE.BoxGeometry(1, 2, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xaa3333, emissive: 0x330000 });
  return new THREE.Mesh(geo, mat);
}
