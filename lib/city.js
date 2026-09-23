import * as THREE from "three";

// ---- grid layout ----
// 8 districts arranged in a 3x3 grid around a central spawn plaza (which is
// left empty). Each district is a CELL x CELL area; STREET is the road gap
// between districts.
export const CELL = 200;
export const STREET = 30;
export const PITCH = CELL + STREET;
export const CITY_RADIUS = PITCH * 1.5 + 40; // outer play-area boundary

const GRID_OFFSETS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
];

// Danger increases going outward/clockwise from spawn — a simple, tunable
// first pass, not a strict distance function (corners and edges tie on
// Euclidean distance in a 3x3 grid, so this just assigns a clear spread).
const DANGER_ORDER = [1, 2, 3, 8, 4, 7, 6, 5];

export function buildDistricts() {
  return GRID_OFFSETS.map(([col, row], i) => ({
    id: i,
    col, row,
    cx: col * PITCH,
    cz: row * PITCH,
    danger: DANGER_ORDER[i],
    hue: (i / GRID_OFFSETS.length + 0.02) % 1,
  }));
}

// Given a world position, find the nearest district (or null if in the
// central plaza / outside any district cell).
export function getDistrictAt(districts, x, z) {
  let best = null, bestDist = Infinity;
  for (const d of districts) {
    const dist = Math.hypot(x - d.cx, z - d.cz);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  if (best && bestDist < CELL * 0.75) return best;
  return null; // central plaza or a street — treated as base difficulty
}

// ---- building templates ----
// 20 fixed shapes (width, height, depth, facade index). Reused everywhere
// via instancing; per-instance color is what actually varies at runtime.
const FACADES = ["concrete", "brick", "glass"];
export const BUILDING_TEMPLATES = Array.from({ length: 20 }, (_, i) => {
  const w = 18 + ((i * 7) % 22);
  const d = 18 + ((i * 11) % 22);
  const h = 10 + ((i * 13) % 34);
  return { id: i, w, h, d, facade: FACADES[i % FACADES.length] };
});

function makeFacadeTexture(tone) {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const base = tone === "brick" ? "#8a5a45" : tone === "glass" ? "#4d6a78" : "#8a8a82";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const winColor = tone === "glass" ? "rgba(200,230,255,0.55)" : "rgba(40,40,45,0.75)";
  const cell = tone === "glass" ? 22 : 32;
  const pad = tone === "glass" ? 2 : 6;
  for (let y = 10; y < size - 10; y += cell) {
    for (let x = 10; x < size - 10; x += cell) {
      ctx.fillStyle = winColor;
      ctx.fillRect(x, y, cell - pad, cell - pad * 1.6);
    }
  }
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  for (let y = 0; y < size; y += cell) {
    ctx.fillRect(0, y, size, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeRoadTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2b2b2e";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 4;
  ctx.setLineDash([20, 16]);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function makeFacadeMaterials() {
  const mats = {};
  FACADES.forEach((tone) => {
    mats[tone] = new THREE.MeshStandardMaterial({
      map: makeFacadeTexture(tone),
      roughness: tone === "glass" ? 0.3 : 0.85,
      metalness: tone === "glass" ? 0.4 : 0.05,
      vertexColors: true,
    });
  });
  return mats;
}

export function makeRoadMaterial() {
  const tex = makeRoadTexture();
  tex.repeat.set(1, CELL / 20);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
}

// ---- full layout generation ----
// Lays out a 3x3 sub-grid of lots inside each district; 8 lots get a random
// building template, 1 fixed lot becomes the warehouse. Returns everything
// needed to build the instanced meshes, the warehouses, and to run
// spawn/collision checks against building footprints.
export function generateCity() {
  const districts = buildDistricts();
  const lotPitch = CELL / 3;
  const lotSize = lotPitch * 0.62;

  // buildingsByTemplate[templateId] = array of { x, z, ry, color }
  const buildingsByTemplate = BUILDING_TEMPLATES.map(() => []);
  const warehouses = [];
  const footprints = []; // { x, z, halfW, halfD } for spawn/collision checks

  let templateCursor = 0;
  districts.forEach((d) => {
    let lotIndex = 0;
    const warehouseLot = 4; // center lot of the 3x3 sub-grid
    for (let lr = -1; lr <= 1; lr++) {
      for (let lc = -1; lc <= 1; lc++) {
        const lx = d.cx + lc * lotPitch;
        const lz = d.cz + lr * lotPitch;
        if (lotIndex === warehouseLot) {
          warehouses.push({ x: lx, z: lz, districtId: d.id, ry: (lc <= 0 ? 0 : Math.PI) });
          footprints.push({ x: lx, z: lz, halfW: 16, halfD: 12 });
        } else {
          const t = BUILDING_TEMPLATES[templateCursor % BUILDING_TEMPLATES.length];
          templateCursor++;
          const ry = (Math.floor(Math.random() * 4) * Math.PI) / 2;
          const light = 0.42 + Math.random() * 0.18;
          const color = new THREE.Color().setHSL(d.hue, 0.35, light);
          buildingsByTemplate[t.id].push({ x: lx, z: lz, ry, color });
          footprints.push({ x: lx, z: lz, halfW: Math.max(t.w, t.d) / 2 + 2, halfD: Math.max(t.w, t.d) / 2 + 2 });
        }
        lotIndex++;
      }
    }
  });

  return { districts, buildingsByTemplate, warehouses, footprints, lotSize };
}

// Coarse check used for enemy-spawn placement so enemies don't spawn inside
// a building's footprint.
export function isInsideAnyFootprint(footprints, x, z) {
  for (const f of footprints) {
    if (Math.abs(x - f.x) < f.halfW && Math.abs(z - f.z) < f.halfD) return true;
  }
  return false;
}

// Simple warehouse: four walls with a gap in the front for a doorway, a
// roof, and a scatter of crate/bag props inside.
export function buildWarehouseGroup(THREE_, wallMat, propMat) {
  const group = new THREE_.Group();
  const W = 34, D = 26, H = 12, DOOR = 8;

  const wall = (w, h, x, z, ry) => {
    const m = new THREE_.Mesh(new THREE_.BoxGeometry(w, h, 1), wallMat);
    m.position.set(x, h / 2, z);
    m.rotation.y = ry;
    group.add(m);
    return m;
  };

  // front wall (with door gap), split into two segments
  const sideW = (W - DOOR) / 2;
  wall(sideW, H, -(DOOR / 2 + sideW / 2), D / 2, 0);
  wall(sideW, H, (DOOR / 2 + sideW / 2), D / 2, 0);
  // back + side walls
  wall(W, H, 0, -D / 2, 0);
  wall(D, H, -W / 2, 0, Math.PI / 2);
  wall(D, H, W / 2, 0, Math.PI / 2);
  // flat roof
  const roof = new THREE_.Mesh(new THREE_.BoxGeometry(W + 1, 1, D + 1), wallMat);
  roof.position.set(0, H + 0.5, 0);
  group.add(roof);

  // interior props: crates (boxes) and bags (squashed spheres)
  const rand = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 5; i++) {
    const isBag = Math.random() < 0.4;
    let prop;
    if (isBag) {
      prop = new THREE_.Mesh(new THREE_.SphereGeometry(1.1, 8, 6), propMat);
      prop.scale.set(1, 0.6, 1.3);
    } else {
      const s = rand(1.6, 2.6);
      prop = new THREE_.Mesh(new THREE_.BoxGeometry(s, s, s), propMat);
    }
    prop.position.set(rand(-W / 2 + 4, W / 2 - 4), isBag ? 0.6 : 1, rand(-D / 2 + 4, D / 2 - 4));
    prop.rotation.y = Math.random() * Math.PI;
    group.add(prop);
  }

  return group;
}

// Difficulty scaling for enemies spawned while the player is in a given
// district (danger 1-8). A first-pass tuning, easy to adjust later.
export function difficultyForDanger(danger) {
  const d = danger || 1;
  return {
    healthMul: 1 + (d - 1) * 0.15,
    speedBonus: (d - 1) * 0.12,
    spawnIntervalMul: Math.max(0.5, 1 - (d - 1) * 0.08),
  };
}
