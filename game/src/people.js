// People of Solara Bay: the player, pedestrians and enemy crew.
// Figures are deliberately plain low-poly — a smooth head with a hair cap
// and NO facial features, seen small or from behind, so no frame ever shows
// a flat sticker face in close-up.

import * as THREE from 'three';
import { makeSeededRandom, rangeRandom, pickFrom } from './rng.js';
import { ROAD_LINES } from './world.js';

const SHIRTS = [0xe85a5a, 0x3a9ad9, 0xf5c542, 0x7ac74f, 0xd98a5a, 0x9a6ad9, 0xe8e8e8, 0x2a2a33];
const SKINS = [0xc98a5a, 0x8a5a3a, 0xe8b88a, 0x6a4530, 0xd9a06a];
const PANTS = [0x2a2a33, 0x3a4a6a, 0x5a3a2a, 0x4a4a4a];

export function buildPersonMesh(shirt, skin, pants) {
  const person = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x241a12 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), shirtMat);
  torso.position.y = 1.18;
  torso.name = 'torso';
  person.add(torso);
  for (const sx of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.26), pantsMat);
    leg.position.set(sx, 0.4, 0);
    leg.name = sx < 0 ? 'legL' : 'legR';
    person.add(leg);
  }
  for (const sx of [-0.4, 0.4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), shirtMat);
    arm.position.set(sx, 1.15, 0);
    arm.name = sx < 0 ? 'armL' : 'armR';
    person.add(arm);
  }
  // Plain smooth head, no face: a sphere with a hair cap on top.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skinMat);
  head.position.y = 1.82;
  head.name = 'head';
  person.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.y = 1.86;
  hair.name = 'hair';
  person.add(hair);
  return person;
}

export function makePedestrian(scene, random, x, z) {
  const mesh = buildPersonMesh(pickFrom(random, SHIRTS), pickFrom(random, SKINS), pickFrom(random, PANTS));
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh, x, z,
    heading: rangeRandom(random, 0, Math.PI * 2),
    speed: rangeRandom(random, 0.9, 1.6),
    walkPhase: random() * 6,
    sidewalk: pickFrom(random, ROAD_LINES),
    along: rangeRandom(random, -150, 150),
    horizontal: random() < 0.5,
  };
}

export function spawnPedestrians(scene, seed, count) {
  const random = makeSeededRandom(seed + 31);
  const folks = [];
  for (let i = 0; i < count; i++) {
    const horizontal = random() < 0.5;
    const line = pickFrom(random, ROAD_LINES);
    const along = rangeRandom(random, -150, 150);
    const side = random() < 0.5 ? 7.5 : -7.5;
    const x = horizontal ? along : line + side;
    const z = horizontal ? line + side : along;
    folks.push(makePedestrian(scene, random, x, z));
  }
  // Beach strollers on the sand.
  for (let i = 0; i < 8; i++) {
    folks.push(makePedestrian(scene, random, rangeRandom(random, -192, -160), rangeRandom(random, -150, 150)));
  }
  return folks;
}

export function updatePedestrians(folks, dt, time) {
  for (const p of folks) {
    p.walkPhase += dt * p.speed * 4;
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;
    if (Math.abs(p.x) > 158 || Math.abs(p.z) > 158) p.heading += Math.PI * 0.9;
    if (p.x < -196) p.heading = Math.PI / 2 + (Math.random() - 0.5);
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    const swing = Math.sin(p.walkPhase) * 0.45;
    const legL = p.mesh.getObjectByName('legL');
    const legR = p.mesh.getObjectByName('legR');
    const armL = p.mesh.getObjectByName('armL');
    const armR = p.mesh.getObjectByName('armR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
    if (armL) armL.rotation.x = -swing * 0.7;
    if (armR) armR.rotation.x = swing * 0.7;
  }
}

export function makeEnemy(scene, x, z) {
  const mesh = buildPersonMesh(0x1a1a22, 0xc98a5a, 0x1a1a22);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.4, 1.3, 0.3);
  mesh.add(gun);
  return { mesh, x, z, hp: 100, alive: true, heading: 0 };
}

export function updateEnemies(enemies, playerX, playerZ, dt) {
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = playerX - e.x;
    const dz = playerZ - e.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 26) continue;
    e.heading = Math.atan2(dx, dz);
    e.mesh.rotation.y = e.heading;
    if (dist > 6) {
      e.x += Math.sin(e.heading) * 2.2 * dt;
      e.z += Math.cos(e.heading) * 2.2 * dt;
      e.mesh.position.set(e.x, 0, e.z);
    }
  }
}
