// Wanted level and the Solara Bay Police response: units spawn by wanted
// level, chase, ram and flank, and at wanted 4+ they set a roadblock ahead
// of the player. Distances feed the police response panel in the HUD.

import { makeCarState, placeCarOnRoad } from './vehicles.js';
import { CAR_MODELS } from './data.js';

const UNIT_NAMES = ['KITE-1', 'MARLIN-3', 'CORAL-48', 'CORAL-85', 'CORAL-43', 'HERON-2', 'TERN-5', 'OSPREY-1'];
const UNIT_ROLES = ['RAMMING', 'PURSUIT', 'FLANKING', 'PURSUIT', 'RAMMING', 'FLANKING'];

export function createPoliceState() {
  return {
    wanted: 0, heat: 0, units: [], roadblock: null,
    lastRaiseAt: 0, decayTimer: 0, heliActive: false,
  };
}

export function raiseWanted(police, amount, scene) {
  police.wanted = Math.min(5, police.wanted + amount);
  police.heat = 100;
  police.lastRaiseAt = performance.now();
  syncPoliceUnits(police, scene);
}

export function lowerWanted(police, amount, scene) {
  police.wanted = Math.max(0, police.wanted - amount);
  syncPoliceUnits(police, scene);
}

export function syncPoliceUnits(police, scene) {
  const wantCount = police.wanted === 0 ? 0 : police.wanted + 2;
  while (police.units.length < wantCount) {
    const i = police.units.length;
    const car = makeCarState(CAR_MODELS[1], true, 0, 0, 0);
    car.callsign = UNIT_NAMES[i % UNIT_NAMES.length];
    car.role = UNIT_ROLES[i % UNIT_ROLES.length];
    car.targetSpeed = 16 + police.wanted * 2;
    placeCarOnRoad(car, 60 + i * 8, -120, Math.PI);
    scene.add(car.mesh);
    police.units.push(car);
  }
  while (police.units.length > wantCount) {
    const car = police.units.pop();
    scene.remove(car.mesh);
  }
  police.heliActive = police.wanted >= 3;
}

export function updatePolice(police, player, dt, time, scene) {
  // Heat decays when the player stays out of sight of every unit.
  if (police.wanted > 0) {
    police.decayTimer += dt;
    if (police.decayTimer > 14) {
      police.decayTimer = 0;
      lowerWanted(police, 1, scene);
    }
  }
  const px = player.x;
  const pz = player.z;
  for (const unit of police.units) {
    const dx = px - unit.x;
    const dz = pz - unit.z;
    const dist = Math.hypot(dx, dz) || 1;
    let targetHeading = Math.atan2(dx, dz);
    if (unit.role === 'FLANKING') targetHeading += 0.6;
    if (unit.role === 'RAMMING') {
      const lead = 0.35;
      targetHeading = Math.atan2(dx + Math.sin(player.heading || 0) * lead * 10, dz + Math.cos(player.heading || 0) * lead * 10);
    }
    // Steer toward the target heading.
    let diff = targetHeading - unit.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    unit.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 3 * dt));
    const wantSpeed = dist > 90 ? 30 : dist < 6 ? 12 : 22 + police.wanted * 1.5;
    unit.speed += (wantSpeed - unit.speed) * Math.min(1, dt * 1.2);
    unit.x += Math.sin(unit.heading) * unit.speed * dt;
    unit.z += Math.cos(unit.heading) * unit.speed * dt;
    unit.mesh.position.set(unit.x, 0, unit.z);
    unit.mesh.rotation.y = unit.heading;
    unit.distance = dist;
    // Flashing beacons.
    const flash = Math.sin(time * 10 + unit.x) > 0;
    const red = unit.mesh.getObjectByName('beacon-red');
    const blue = unit.mesh.getObjectByName('beacon-blue');
    if (red) red.visible = flash;
    if (blue) blue.visible = !flash;
  }
  // Roadblock at wanted 4+: two police cars parked across the road ahead.
  if (police.wanted >= 4 && !police.roadblock) {
    const aheadX = px + Math.sin(player.heading || 0) * 45;
    const aheadZ = pz + Math.cos(player.heading || 0) * 45;
    const block = [];
    for (const off of [-4, 4]) {
      const car = makeCarState(CAR_MODELS[1], true, aheadX + off, aheadZ, (player.heading || 0) + Math.PI / 2);
      car.role = 'ROADBLOCK';
      car.callsign = 'BLOCK';
      placeCarOnRoad(car, aheadX + off, aheadZ, (player.heading || 0) + Math.PI / 2);
      scene.add(car.mesh);
      block.push(car);
    }
    police.roadblock = block;
  }
  if (police.wanted < 4 && police.roadblock) {
    for (const car of police.roadblock) scene.remove(car.mesh);
    police.roadblock = null;
  }
}

export function policePanelRows(police) {
  const rows = police.units.map((u) => ({
    name: u.callsign, role: u.role,
    dist: Math.round(u.distance || 0),
  }));
  rows.sort((a, b) => a.dist - b.dist);
  return rows.slice(0, 6);
}

export function checkPlayerRam(police, playerCar, onRam) {
  if (!playerCar) return;
  for (const unit of police.units) {
    const dist = Math.hypot(unit.x - playerCar.x, unit.z - playerCar.z);
    if (dist < 3.2 && Math.abs(playerCar.speed) > 6) {
      unit.speed *= 0.4;
      playerCar.condition = Math.max(0, playerCar.condition - 4);
      onRam(unit);
    }
  }
}
