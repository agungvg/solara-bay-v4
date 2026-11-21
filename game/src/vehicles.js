// Vehicles for Solara Bay: low-poly cars built from boxes, traffic that
// follows the street grid, police units that chase and ram, and the SBP
// helicopter that shadows the player at high wanted levels.

import * as THREE from 'three';
import { makeSeededRandom, rangeRandom, pickFrom } from './rng.js';
import { CAR_MODELS } from './data.js';
import { ROAD_LINES } from './world.js';

export function buildCarMesh(model, isPolice) {
  const car = new THREE.Group();
  car.name = model.name;
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf2f2ee : model.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2433 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55;
  car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
  cabin.position.set(0, 1.1, -0.2);
  car.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 0.7), paint);
  nose.position.set(0, 0.5, 2.4);
  car.add(nose);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheelSpots = [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]];
  for (const [wx, wz] of wheelSpots) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    car.add(wheel);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const hx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.08), headMat);
    head.position.set(hx, 0.55, 2.78);
    car.add(head);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222831 }));
    bar.position.set(0, 1.5, -0.2);
    bar.name = 'lightbar';
    car.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.42),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    red.position.set(-0.3, 1.62, -0.2);
    red.name = 'beacon-red';
    car.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x2a6aff }));
    blue.position.set(0.3, 1.62, -0.2);
    blue.name = 'beacon-blue';
    car.add(blue);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42),
      new THREE.MeshLambertMaterial({ color: 0x1a4a8a }));
    stripe.position.y = 0.72;
    car.add(stripe);
  }
  car.traverse((child) => { child.castShadow = false; });
  return car;
}

export function makeCarState(model, isPolice, x, z, heading) {
  return {
    model, isPolice: !!isPolice, mesh: buildCarMesh(model, isPolice),
    x, z, heading, speed: 0, condition: 100, targetSpeed: 0,
    steer: 0, ramHits: 0, role: 'PARKED', callsign: '',
  };
}

export function placeCarOnRoad(car, x, z, heading) {
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
}

// Traffic: cars cruise the grid, turning at intersections, braking for the
// car ahead. They stay on roads so the streets always read as streets.
export function spawnTrafficCars(scene, seed, count) {
  const random = makeSeededRandom(seed + 77);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const model = pickFrom(random, CAR_MODELS);
    const horizontal = random() < 0.5;
    const line = pickFrom(random, ROAD_LINES);
    const along = rangeRandom(random, -150, 150);
    const lane = (random() < 0.5 ? 2.5 : -2.5);
    const x = horizontal ? along : line + lane;
    const z = horizontal ? line + lane : along;
    const heading = horizontal ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? Math.PI : 0);
    const car = makeCarState(model, false, x, z, heading);
    car.role = 'TRAFFIC';
    car.targetSpeed = rangeRandom(random, 7, 12);
    car.speed = car.targetSpeed;
    placeCarOnRoad(car, x, z, heading);
    scene.add(car.mesh);
    cars.push(car);
  }
  return cars;
}

export function updateTrafficCars(cars, dt, playerCar) {
  for (const car of cars) {
    // Slow down if another car is close ahead.
    let blocked = false;
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 9) {
        const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        if (ahead > 0) { blocked = true; break; }
      }
    }
    if (playerCar && Math.hypot(playerCar.x - car.x, playerCar.z - car.z) < 8) blocked = true;
    const want = blocked ? 0 : car.targetSpeed;
    car.speed += (want - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    // Wrap around the city edge so traffic never runs out.
    if (car.x > 165) car.x = -165;
    if (car.x < -165) car.x = 165;
    if (car.z > 165) car.z = -165;
    if (car.z < -165) car.z = 165;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
}

export function buildHelicopter(scene) {
  const heli = new THREE.Group();
  heli.name = 'SBP Osprey One';
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a4a6a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 5), bodyMat);
  heli.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x9ac9e8 }));
  glass.position.set(0, 0.2, 2.2);
  heli.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5), bodyMat);
  tail.position.set(0, 0.4, -4.5);
  heli.add(tail);
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  const blade = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.add(blade);
  const blade2 = blade.clone();
  blade2.rotation.y = Math.PI / 2;
  rotor.add(blade2);
  rotor.position.y = 1.2;
  heli.add(rotor);
  const spot = new THREE.Mesh(new THREE.ConeGeometry(2.2, 8, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.18 }));
  spot.position.y = -5;
  spot.rotation.x = Math.PI;
  spot.name = 'searchlight';
  heli.add(spot);
  heli.visible = false;
  scene.add(heli);
  return heli;
}

export function updateHelicopter(heli, targetX, targetZ, dt, time, active) {
  heli.visible = active;
  if (!active) return;
  // Hold it just left of the road centre, ahead of the player, low enough
  // to sit inside the chase camera's frame (clear of the HUD panels).
  const hx = targetX - 4 + Math.sin(time * 0.25) * 4;
  const hz = targetZ - 26 + Math.cos(time * 0.2) * 3;
  heli.position.set(hx, 13 + Math.sin(time * 0.5) * 1.0, hz);
  heli.rotation.y = Math.atan2(targetX - hx, targetZ - hz);
  const rotor = heli.getObjectByName('rotor');
  if (rotor) rotor.rotation.y += dt * 22;
}
