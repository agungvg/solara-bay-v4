// Procedural Solara Bay: streets that read as streets, a beach and ocean on
// the west edge, a pier, palms, and districts with distinct building palettes.
// All geometry is built from boxes, cylinders and planes with canvas textures
// painted at runtime — no external assets.

import * as THREE from 'three';
import { makeSeededRandom, rangeRandom, pickFrom } from './rng.js';

export const ROAD_LINES = [-120, -80, -40, 0, 40, 80, 120];
export const CITY_EDGE = 160;
export const BEACH_X = -150;
export const OCEAN_X = -200;

function paintBuildingTexture(random, base, lit) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  const rows = 10;
  const cols = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = random() < (lit ? 0.55 : 0.25);
      ctx.fillStyle = on ? '#ffd98a' : '#2c3550';
      ctx.fillRect(10 + c * 22, 12 + r * 24, 14, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function paintRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#565b66';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#f5d76e';
  ctx.fillRect(30, 4, 4, 22);
  ctx.fillRect(30, 38, 4, 22);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildSunsetSky(scene, mode) {
  // mode: 'sunset' | 'dusk' | 'night'
  const palettes = {
    sunset: { sky: 0xff9a5c, fog: 0xf7a56b, sun: 0xffd9a0, amb: 0x8a6a7a, hemi: 0xffb37a, ground: 0x9a7a5a },
    dusk: { sky: 0x7a5a8a, fog: 0x8a6a8a, sun: 0xffb37a, amb: 0x5a4a6a, hemi: 0x9a7a9a, ground: 0x6a5a5a },
    night: { sky: 0x141c33, fog: 0x1a2340, sun: 0x9ab4ff, amb: 0x2a3350, hemi: 0x33406a, ground: 0x3a3a4a },
  };
  const p = palettes[mode] || palettes.sunset;
  scene.background = new THREE.Color(p.sky);
  scene.fog = new THREE.Fog(p.fog, 120, 520);
  const nightMode = mode === 'night';
  const sun = new THREE.DirectionalLight(p.sun, nightMode ? 0.8 : 2.6);
  sun.position.set(-160, 150, 80);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfd4ff, nightMode ? 0.25 : 0.7);
  fill.position.set(160, 120, -80);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(p.hemi, p.ground, nightMode ? 0.55 : 1.35));
  const amb = new THREE.AmbientLight(p.amb, nightMode ? 0.4 : 0.75);
  scene.add(amb);
  // Low sun disc over the ocean so sunset shots have a light source to read.
  if (mode !== 'night') {
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(20, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }));
    sunDisc.position.set(-290, 48, -70);
    sunDisc.lookAt(0, 20, 0);
    scene.add(sunDisc);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(34, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb37a, transparent: true, opacity: 0.35, fog: false }));
    glow.position.set(-292, 48, -70);
    glow.lookAt(0, 20, 0);
    scene.add(glow);
  }
  return p;
}

export function buildWorld(scene, seed, mode) {
  const random = makeSeededRandom(seed);
  const group = new THREE.Group();
  group.name = 'SolaraBayCity';
  scene.add(group);
  const palette = buildSunsetSky(scene, mode);
  const night = mode === 'night';

  const groundMat = new THREE.MeshLambertMaterial({ color: 0xb59a78 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-40, -0.05, 0);
  group.add(ground);

  // Sand beach + ocean on the west edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 420),
    new THREE.MeshLambertMaterial({ color: 0xf0dcae }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-176, 0.02, 0);
  group.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 460),
    new THREE.MeshLambertMaterial({ color: night ? 0x14264a : 0x2a7a9a, transparent: true, opacity: 0.92 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-310, 0.05, 0);
  ocean.name = 'ocean';
  group.add(ocean);

  // Roads: asphalt strips with dashed centre lines, plus sidewalks.
  const roadTex = paintRoadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb8a88e });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf5f0dc });
  for (const line of ROAD_LINES) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(330, 10), roadMat.clone());
      road.material.map = roadTex.clone();
      road.material.map.repeat.set(330 / 16, 1);
      road.rotation.x = -Math.PI / 2;
      if (horizontal) road.rotation.z = Math.PI / 2;
      road.position.set(horizontal ? 0 : line, 0.06, horizontal ? line : 0);
      group.add(road);
      const walkA = new THREE.Mesh(new THREE.PlaneGeometry(330, 3), walkMat);
      walkA.rotation.x = -Math.PI / 2;
      if (horizontal) walkA.rotation.z = Math.PI / 2;
      walkA.position.set(horizontal ? 0 : line + 7, 0.07, horizontal ? line + 7 : 0);
      group.add(walkA);
      const walkB = walkA.clone();
      walkB.position.set(horizontal ? 0 : line - 7, 0.07, horizontal ? line - 7 : 0);
      group.add(walkB);
      // Dashed centre line.
      for (let d = -150; d < 150; d += 12) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(4, 0.05, 0.5), stripeMat);
        dash.position.set(horizontal ? d : line, 0.1, horizontal ? line : d);
        group.add(dash);
      }
    }
  }
  // Beachfront Strand Boulevard, wider, with a palm-lined median.
  const strand = new THREE.Mesh(new THREE.PlaneGeometry(340, 14), roadMat.clone());
  strand.material.map = roadTex.clone();
  strand.material.map.repeat.set(340 / 16, 1);
  strand.rotation.x = -Math.PI / 2;
  strand.rotation.z = Math.PI / 2;
  strand.position.set(-140, 0.06, 0);
  group.add(strand);

  // Buildings, one per city block, varied heights and warm palettes.
  const colliders = [];
  const blockColors = ['#e8a56a', '#d98a7a', '#c98a8a', '#e8c98a', '#7aa8c9', '#9ac9a8', '#b89ac9', '#e8b8a8'];
  const litTexture = (c) => paintBuildingTexture(random, c, night);
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const bx of ROAD_LINES) {
    for (const bz of ROAD_LINES) {
      if (bx === -120) continue; // beachfront blocks stay low
      const cx = bx + 20;
      const cz = bz + 20;
      if (cx > CITY_EDGE || cz > CITY_EDGE) continue;
      const tall = Math.abs(cx) < 60 && Math.abs(cz) < 60;
      const h = tall ? rangeRandom(random, 26, 62) : rangeRandom(random, 8, 24);
      const w = rangeRandom(random, 16, 26);
      const d = rangeRandom(random, 16, 26);
      const tex = litTexture(pickFrom(random, blockColors));
      tex.repeat.set(2, Math.max(1, Math.round(h / 14)));
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const b = new THREE.Mesh(buildingGeo, mat);
      b.scale.set(w, h, d);
      b.position.set(cx, h / 2, cz);
      group.add(b);
      colliders.push({ x: cx, z: cz, hw: w / 2, hd: d / 2 });
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.6, d + 1),
        new THREE.MeshLambertMaterial({ color: 0x5a4a3a }));
      roof.position.set(cx, h + 0.3, cz);
      group.add(roof);
    }
  }
  // Low beachfront hotels along the Strand.
  for (let z = -140; z <= 140; z += 40) {
    const h = rangeRandom(random, 6, 11);
    const tex = litTexture(pickFrom(random, ['#f5c9a8', '#e8b89a', '#ffd9a8']));
    tex.repeat.set(2, 1);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const b = new THREE.Mesh(buildingGeo, mat);
    b.scale.set(14, h, 20);
    b.position.set(-124, h / 2, z + 10);
    group.add(b);
    colliders.push({ x: -124, z: z + 10, hw: 7, hd: 10 });
  }

  // Palms along the beach, the Strand median and the pier approach.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const frondMat = new THREE.MeshLambertMaterial({ color: night ? 0x2a5a3a : 0x3a9a5a });
  function addPalm(x, z, scale) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * scale, 0.45 * scale, 7 * scale, 6), trunkMat);
    trunk.position.y = 3.5 * scale;
    trunk.rotation.z = 0.08;
    palm.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9 * scale, 4.5 * scale, 4), frondMat);
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.6 * scale, 7.2 * scale, Math.sin(a) * 1.6 * scale);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      palm.add(frond);
    }
    palm.position.set(x, 0, z);
    group.add(palm);
  }
  for (let z = -160; z <= 160; z += 16) addPalm(-158, z + rangeRandom(random, -4, 4), rangeRandom(random, 0.9, 1.3));
  for (let z = -150; z <= 150; z += 24) addPalm(-133, z, rangeRandom(random, 0.9, 1.2));
  for (let z = -120; z <= 120; z += 40) addPalm(20, z + 20, 1);

  // Kumala Pier: wooden deck out over the ocean with lamps and an end shelter.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a55 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 1, 8), pierMat);
  pier.position.set(-185, 1.2, 40);
  group.add(pier);
  for (let x = -160; x >= -215; x -= 12) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6), pierMat);
    post.position.set(x, 0.2, 36);
    group.add(post);
    const post2 = post.clone();
    post2.position.z = 44;
    group.add(post2);
  }
  const shelter = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 8),
    new THREE.MeshLambertMaterial({ color: 0xd98a5a }));
  shelter.position.set(-212, 3.2, 40);
  group.add(shelter);

  // Street lamps at intersections.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3a42 });
  const glowMat = new THREE.MeshBasicMaterial({ color: night ? 0xffd98a : 0xfff2c9 });
  for (const lx of [-120, -40, 40, 120]) {
    for (const lz of [-120, -40, 40, 120]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), lampMat);
      pole.position.set(lx + 8, 3.5, lz + 8);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), glowMat);
      lamp.position.set(lx + 8, 7.2, lz + 8);
      group.add(lamp);
    }
  }

  // Night-market stalls in Old Pasaru.
  const stallColors = [0xe85a5a, 0x3a9ad9, 0xf5c542, 0x7ac74f];
  for (let i = 0; i < 10; i++) {
    const sx = 66 + (i % 5) * 9;
    const sz = 66 + Math.floor(i / 5) * 12;
    const stall = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 4),
      new THREE.MeshLambertMaterial({ color: stallColors[i % stallColors.length] }));
    stall.position.set(sx, 1.2, sz);
    group.add(stall);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.3, 4.6),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    awning.position.set(sx, 2.8, sz);
    group.add(awning);
  }

  // Beach umbrellas and a billboard over the Strand.
  const umbMat = new THREE.MeshLambertMaterial({ color: 0x3a9ad9 });
  for (let i = 0; i < 12; i++) {
    const ux = -168 - random() * 18;
    const uz = -150 + i * 28 + rangeRandom(random, -6, 6);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(3, 1.6, 8), umbMat);
    cone.position.set(ux, 2.6, uz);
    group.add(cone);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 5), lampMat);
    pole.position.set(ux, 1.2, uz);
    group.add(pole);
  }
  // Billboard over the Strand, painted with the city's own ad.
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 256;
  boardCanvas.height = 96;
  const bctx = boardCanvas.getContext('2d');
  const grad = bctx.createLinearGradient(0, 0, 256, 96);
  grad.addColorStop(0, '#ff7a3c');
  grad.addColorStop(1, '#c94a8a');
  bctx.fillStyle = grad;
  bctx.fillRect(0, 0, 256, 96);
  bctx.fillStyle = '#fff';
  bctx.font = '900 34px sans-serif';
  bctx.fillText('SOLARA BAY', 14, 44);
  bctx.font = '700 17px sans-serif';
  bctx.fillStyle = '#ffe9b0';
  bctx.fillText('VISIT THE STRAND', 14, 72);
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 0.6),
    new THREE.MeshLambertMaterial({ map: boardTex }));
  board.position.set(-126, 12, -80);
  group.add(board);
  for (const px of [-131, -121]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 6), lampMat);
    post.position.set(px, 4.5, -80);
    group.add(post);
  }

  return { group, palette, ocean, colliders };
}
