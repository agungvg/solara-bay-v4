// Solara Bay main loop: boots three.js, wires input, driving, on-foot play,
// combat, missions, police, sound, HUD, save/load and the menu. The game
// runs entirely from static files under game/ — no network requests.

import * as THREE from 'three';
import { buildWorld, ROAD_LINES } from './world.js';
import { makeSeededRandom, rangeRandom, pickFrom } from './rng.js';
import { CAR_MODELS, MISSIONS } from './data.js';
import { makeCarState, placeCarOnRoad, spawnTrafficCars, updateTrafficCars, buildHelicopter, updateHelicopter } from './vehicles.js';
import { buildPersonMesh, spawnPedestrians, updatePedestrians, makeEnemy, updateEnemies } from './people.js';
import { createSoundEngine } from './audio.js';
import { createMissionState, startMission, updateMission, recordRamHit, recordCombatKill, missionListForMenu, currentMission, currentStage } from './missions.js';
import { createPoliceState, raiseWanted, updatePolice, checkPlayerRam } from './police.js';
import { buildHudElements, refreshStaticHud, updateHud, showDialogue, hideDialogue } from './hud.js';
import { parseShotQuery, applyShotPreset } from './shots.js';

const SAVE_KEY = 'solara-bay-v4-save';
const RANK_LADDER = [
  { xp: 0, name: 'ROOKIE' }, { xp: 1000, name: 'WHEELMAN' }, { xp: 2500, name: 'FIXER' },
  { xp: 5000, name: 'SHOT CALLER' }, { xp: 9000, name: 'KINGPIN' },
];

function rankForXp(xp) {
  let name = 'ROOKIE';
  let next = 1000;
  for (let i = 0; i < RANK_LADDER.length; i++) {
    if (xp >= RANK_LADDER[i].xp) {
      name = RANK_LADDER[i].name;
      next = RANK_LADDER[i + 1] ? RANK_LADDER[i + 1].xp : 15000;
    }
  }
  return { name, next };
}

export function bootSolaraBay() {
  const shotInfo = parseShotQuery(window.location.search);
  const seed = shotInfo ? shotInfo.seed : 7;
  const mode = shotInfo ? shotInfo.preset.mode : 'sunset';

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById('game-canvas').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  const world = buildWorld(scene, seed, mode);

  const els = buildHudElements();
  const sound = createSoundEngine();

  const game = {
    scene, camera, renderer, mode, seed, els, sound,
    state: { cash: 250, xp: 0, xpNext: 1000, rankName: 'ROOKIE', health: 100, armour: 40, weaponIndex: 0, ammo: { 2: 60, 3: 90, 4: 18 }, crewCooldown: [0, 0, 0] },
    missions: createMissionState(),
    police: createPoliceState(),
    clockMinutes: 15 * 60 + 20,
    player: { x: -140, z: 20, heading: Math.PI, yaw: Math.PI, pitch: 0.32, speed: 0, inCar: false, car: null, mesh: null },
    traffic: [], pedestrians: [], enemies: [], parkedCars: [],
    playerCar: null, targetCar: null, heli: null,
    keys: {}, paused: false, started: false, shotMode: null, autopilot: false,
    hintText: '', nextMissionHint: '', saveTimer: 0, shootTimer: 0, damageFlash: 0,
  };
  // Debug / screenshot hook: lets a headless driver read live game state.
  window.__solaraGame = game;
  window.__solaraReady = false;

  // The player's own car, a Rukan Pelo GT parked on the Strand.
  const playerCar = makeCarState(CAR_MODELS[0], false, -140, 20, Math.PI);
  playerCar.tune = 3;
  playerCar.role = 'PLAYER';
  placeCarOnRoad(playerCar, -140, 20, Math.PI);
  scene.add(playerCar.mesh);
  game.playerCar = playerCar;

  // Parked cars the player can steal, lined along Meridian Ave.
  const random = makeSeededRandom(seed + 5);
  for (let i = 0; i < 6; i++) {
    const model = pickFrom(random, CAR_MODELS.slice(1));
    const car = makeCarState(model, false, -40 + i * 2.5, -60 + i * 22, Math.PI / 2);
    car.tune = 1 + (i % 3);
    car.role = 'PARKED';
    placeCarOnRoad(car, -40 + (i % 2 ? 6 : -6), -90 + i * 30, i % 2 ? -Math.PI / 2 : Math.PI / 2);
    scene.add(car.mesh);
    game.parkedCars.push(car);
  }

  game.traffic = spawnTrafficCars(scene, seed, 22);
  // Extra traffic cruising the Strand so the cover chase reads as a chase.
  for (let i = 0; i < 4; i++) {
    const model = pickFrom(random, CAR_MODELS);
    const car = makeCarState(model, false, -140 + (i % 2 ? 2.5 : -2.5), -100 + i * 55, Math.PI);
    car.role = 'TRAFFIC';
    car.targetSpeed = rangeRandom(random, 8, 11);
    car.speed = car.targetSpeed;
    placeCarOnRoad(car, car.x, car.z, Math.PI);
    scene.add(car.mesh);
    game.traffic.push(car);
  }
  game.pedestrians = spawnPedestrians(scene, seed, 34);
  game.heli = buildHelicopter(scene);

  // Player figure: plain low-poly, no face, seen from behind.
  const playerMesh = buildPersonMesh(0x2a9ad9, 0xc98a5a, 0x2a2a33);
  playerMesh.position.set(game.player.x, 0, game.player.z);
  scene.add(playerMesh);
  game.player.mesh = playerMesh;

  // Mission target car for WRECK THE REGENT (mission 6): a dark Regent.
  const targetCar = makeCarState({ name: 'ORU REGENT', kind: 'luxury', color: 0x1a1a22, topSpeed: 46, accel: 20 }, false, -140, -60, Math.PI);
  targetCar.role = 'TARGET';
  targetCar.targetSpeed = 14;
  targetCar.speed = 14;
  placeCarOnRoad(targetCar, -140, -60, Math.PI);
  targetCar.mesh.visible = false;
  scene.add(targetCar.mesh);
  game.targetCar = targetCar;

  // ---- save / load ----
  function saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: game.state.cash, xp: game.state.xp, health: game.state.health,
        armour: game.state.armour, completed: [...game.missions.completed],
        activeId: game.missions.activeId, stageIndex: game.missions.stageIndex,
        x: game.player.x, z: game.player.z,
      }));
    } catch (err) { /* storage is best-effort */ }
  }
  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) { return null; }
  }
  function applySave(save) {
    game.state.cash = save.cash;
    game.state.xp = save.xp;
    game.state.health = save.health;
    game.state.armour = save.armour;
    game.missions.completed = new Set(save.completed || []);
    game.player.x = save.x || -140;
    game.player.z = save.z || 20;
    if (save.activeId) startMission(game.missions, save.activeId, scene);
    game.missions.stageIndex = save.stageIndex || 0;
  }

  // ---- input ----
  const keyMap = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', ShiftLeft: 'run', ShiftRight: 'run' };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') { togglePause(); return; }
    if (e.code === 'KeyM') { togglePause(true); return; }
    if (e.code === 'KeyE') { tryEnterExitCar(); return; }
    if (e.code === 'KeyF') { tryShoot(); return; }
    if (e.code === 'KeyR') { sound.cycleStation(); return; }
    if (e.code === 'Digit1') game.state.weaponIndex = 0;
    if (e.code === 'Digit2') game.state.weaponIndex = 1;
    if (e.code === 'Digit3') game.state.weaponIndex = 2;
    if (e.code === 'Digit4') game.state.weaponIndex = 3;
    if (e.code === 'KeyZ') useCrewAbility(0);
    if (e.code === 'KeyX') useCrewAbility(1);
    if (e.code === 'KeyC') useCrewAbility(2);
    if (keyMap[e.code]) game.keys[keyMap[e.code]] = true;
    sound.resume();
  });
  window.addEventListener('keyup', (e) => { if (keyMap[e.code]) game.keys[keyMap[e.code]] = false; });
  let dragging = false;
  let lastMouse = { x: 0, y: 0 };
  renderer.domElement.addEventListener('mousedown', (e) => { dragging = true; lastMouse = { x: e.clientX, y: e.clientY }; sound.resume(); });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    game.player.yaw -= (e.clientX - lastMouse.x) * 0.005;
    game.player.pitch = Math.max(0.08, Math.min(1.1, game.player.pitch + (e.clientY - lastMouse.y) * 0.004));
    lastMouse = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener('click', () => { if (game.started && !game.paused) tryShoot(); });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function useCrewAbility(i) {
    if (game.state.crewCooldown[i] > 0) return;
    if (i === 0) {
      game.police.wanted = Math.max(0, game.police.wanted - 1);
      game.state.crewCooldown[0] = 21;
      showDialogue(els, 'MIRA KESANG', 'Crew · Driver', 'Plates swapped. They lost the scent — for now.', '#3a9ad9');
    } else if (i === 1) {
      if (game.player.car) game.player.car.condition = Math.min(100, game.player.car.condition + 40);
      game.state.crewCooldown[1] = 34;
      showDialogue(els, 'LIO TAN', 'Crew · Mechanic', 'Patched her up. She will hold together, mostly.', '#f5a742');
    } else {
      game.state.crewCooldown[2] = 18;
      showDialogue(els, 'KIKI ORA', 'Crew · Lookout', 'Eyes out: every unit is marked on your map.', '#9a6ad9');
    }
    sound.blip(880, 0.15);
    refreshStaticHud(els, game.state);
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestDist = maxDist;
    const all = [game.playerCar, ...game.parkedCars, ...game.traffic];
    for (const car of all) {
      const d = Math.hypot(car.x - game.player.x, car.z - game.player.z);
      if (d < bestDist) { bestDist = d; best = car; }
    }
    return best;
  }

  function tryEnterExitCar() {
    if (!game.started || game.paused) return;
    if (game.player.inCar) {
      const car = game.player.car;
      game.player.inCar = false;
      game.player.car = null;
      game.player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
      game.player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
      game.player.mesh.visible = true;
      game.player.mesh.position.set(game.player.x, 0, game.player.z);
      game.hintText = 'WASD move · E enter car · F shoot · M missions';
      return;
    }
    const car = nearestCar(4.5);
    if (!car) return;
    if (car.role === 'PARKED' || car.role === 'TRAFFIC') {
      raiseWanted(game.police, 1, scene);
      showDialogue(els, 'CAPT. VANCE', 'SBP Dispatch', 'Stolen vehicle reported on the Strand. All units respond.', '#2a4a8a');
      game.hintText = 'Car stolen — the heat is on. Lose them or swap plates (Z).';
    }
    game.player.inCar = true;
    game.player.car = car;
    car.role = 'PLAYER';
    game.player.mesh.visible = false;
    sound.blip(520, 0.12);
    const stage = currentStage(game.missions);
    if (stage && stage.kind === 'steal') updateMission(game.missions, scene, game.player, game.police.wanted);
  }

  const raycaster = new THREE.Raycaster();
  function tryShoot() {
    if (!game.started || game.paused || game.shootTimer > 0) return;
    const weapon = game.state.weaponIndex;
    if (weapon === 0) {
      // Fists: melee swing at the nearest enemy.
      for (const e of game.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - game.player.x, e.z - game.player.z) < 2.2) {
          e.hp -= 34;
          if (e.hp <= 0) killEnemy(e);
          sound.blip(180, 0.08);
          break;
        }
      }
      game.shootTimer = 0.35;
      return;
    }
    const slot = weapon + 1;
    if ((game.state.ammo[slot] || 0) <= 0) { sound.blip(140, 0.1); game.shootTimer = 0.3; return; }
    game.state.ammo[slot] -= 1;
    game.shootTimer = weapon === 2 ? 0.09 : weapon === 3 ? 0.8 : 0.32;
    sound.gunshot();
    raiseWanted(game.police, 0, scene);
    if (game.police.wanted < 1) raiseWanted(game.police, 1, scene);
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const targets = [];
    for (const e of game.enemies) if (e.alive) targets.push(e.mesh);
    for (const u of game.police.units) targets.push(u.mesh);
    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length) {
      // Walk up from the hit child mesh to the enemy root group.
      let node = hits[0].object;
      while (node && node.parent && node.parent !== scene) node = node.parent;
      const enemy = game.enemies.find((e) => e.mesh === node);
      if (enemy && enemy.alive) {
        enemy.hp -= weapon === 3 ? 70 : weapon === 2 ? 22 : 34;
        if (enemy.hp <= 0) killEnemy(enemy);
      }
    }
    refreshStaticHud(els, game.state);
  }

  function killEnemy(e) {
    e.alive = false;
    e.mesh.visible = false;
    game.state.cash += 120;
    game.state.xp += 60;
    const result = recordCombatKill(game.missions, scene);
    if (result === 'complete') missionComplete();
    else if (result === 'stage') showDialogue(els, 'MIRA KESANG', 'Crew · Driver', 'Aisle clear. Move to the next one.', '#3a9ad9');
    sound.blip(990, 0.12);
  }

  function missionComplete() {
    // Pay the most recently finished mission (the highest completed id).
    const doneIds = [...game.missions.completed];
    const lastId = doneIds.length ? Math.max(...doneIds) : 1;
    const mission = MISSIONS.find((m) => m.id === lastId);
    const pay = mission ? mission.pay : 800;
    game.state.cash += pay;
    game.state.xp += 400;
    showDialogue(els, 'MIRA KESANG', 'Crew · Driver', 'Job done. The Bay is yours, Tomo. Take the money and lay low.', '#3a9ad9');
    saveGame();
  }

  function spawnMissionEnemies(count, cx, cz) {
    for (const e of game.enemies) scene.remove(e.mesh);
    game.enemies = [];
    const r = makeSeededRandom(seed + count * 13);
    for (let i = 0; i < count; i++) {
      game.enemies.push(makeEnemy(scene, cx + rangeRandom(r, -12, 12), cz + rangeRandom(r, -12, 12)));
    }
  }

  // ---- menus ----
  const menuEl = document.getElementById('menu');
  const pauseEl = document.getElementById('pause');
  const missionListEl = document.getElementById('mission-list');
  const pauseMissionsEl = document.getElementById('pause-missions');
  function renderMissionLists() {
    const html = missionListForMenu(game.missions).map((m) => (
      `<button class="mission-btn${m.done ? ' done' : ''}${m.active ? ' active' : ''}" data-mission="${m.id}">`
      + `<b>${m.id}. ${m.title}</b><span>${m.chapter} · $${m.pay.toLocaleString('en-US')}${m.done ? ' · DONE' : ''}</span></button>`
    )).join('');
    missionListEl.innerHTML = html;
    pauseMissionsEl.innerHTML = html;
    for (const btn of document.querySelectorAll('.mission-btn')) {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.mission);
        const mission = startMission(game.missions, id, scene);
        if (mission) {
          if (mission.id === 4 || mission.id === 8) spawnMissionEnemies(mission.id === 4 ? 5 : 6, mission.id === 4 ? 80 : 100, mission.id === 4 ? 80 : 120);
          if (mission.id === 6) game.targetCar.mesh.visible = true;
          showDialogue(els, mission.giver, 'Mission giver', mission.stages[0].text, '#3a9ad9');
          game.nextMissionHint = `NEXT  ${mission.stages[1] ? mission.stages[1].text : 'Finish the job'}`;
          sound.blip(660, 0.15);
          refreshStaticHud(els, game.state);
        }
        resumeGame();
      });
    }
  }
  function showHud() {
    document.getElementById('hud').style.display = 'block';
  }
  function startGame(fromSave) {
    if (fromSave) {
      const save = loadGame();
      if (save) applySave(save);
    }
    game.started = true;
    showHud();
    menuEl.style.display = 'none';
    pauseEl.style.display = 'none';
    game.hintText = 'WASD move · E enter car · F shoot · M missions · Esc pause';
    sound.resume();
    if (!game.missions.activeId) {
      startMission(game.missions, 1, scene);
      showDialogue(els, 'MIRA KESANG', 'Crew · Driver', 'Tomo. First rule of the Bay: never pay for a car you can borrow.', '#3a9ad9');
    }
    refreshStaticHud(els, game.state);
  }
  function togglePause(showMissions) {
    if (!game.started) return;
    game.paused = !game.paused;
    pauseEl.style.display = game.paused ? 'flex' : 'none';
    if (game.paused) { renderMissionLists(); saveGame(); }
  }
  function resumeGame() {
    game.paused = false;
    showHud();
    pauseEl.style.display = 'none';
    menuEl.style.display = 'none';
    game.started = true;
    sound.resume();
  }
  document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
  document.getElementById('btn-new').addEventListener('click', () => startGame(false));
  document.getElementById('btn-resume').addEventListener('click', resumeGame);
  document.getElementById('btn-save').addEventListener('click', () => { saveGame(); sound.blip(880, 0.12); });
  document.getElementById('btn-quit').addEventListener('click', () => { saveGame(); location.reload(); });
  const hasSave = !!loadGame();
  document.getElementById('btn-continue').style.display = hasSave ? 'inline-block' : 'none';
  renderMissionLists();

  // ---- collision with buildings ----
  function resolveBuildingCollision(obj, radius) {
    for (const b of world.colliders) {
      const dx = obj.x - b.x;
      const dz = obj.z - b.z;
      if (Math.abs(dx) < b.hw + radius && Math.abs(dz) < b.hd + radius) {
        const pushX = (b.hw + radius) - Math.abs(dx);
        const pushZ = (b.hd + radius) - Math.abs(dz);
        if (pushX < pushZ) obj.x += dx > 0 ? pushX : -pushX;
        else obj.z += dz > 0 ? pushZ : -pushZ;
        return true;
      }
    }
    return false;
  }

  // ---- per-frame updates ----
  const clock = new THREE.Clock();
  let elapsed = 0;

  function updateDriving(dt) {
    const car = game.player.car;
    if (!car) return;
    if (game.autopilot) {
      // Shot mode: cruise the Strand south, gentle weave, police on the tail.
      car.speed += (car.model.topSpeed * 0.5 - car.speed) * dt * 0.8;
      const targetX = -140 + Math.sin(elapsed * 0.4) * 1.5;
      car.heading += ((Math.PI - car.heading) * 0.2 + (targetX - car.x) * 0.02) * dt * 3;
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      if (car.z < -150) { car.z = 120; }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      game.player.x = car.x;
      game.player.z = car.z;
      game.player.heading = car.heading;
      return;
    }
    const accel = game.keys.up ? car.model.accel : 0;
    const brake = game.keys.down ? 14 : 0;
    car.speed += (accel - brake) * dt;
    if (!game.keys.up && !game.keys.down) car.speed *= Math.max(0, 1 - dt * 0.6);
    car.speed = Math.max(-8, Math.min(car.model.topSpeed, car.speed));
    const steerInput = (game.keys.left ? 1 : 0) - (game.keys.right ? 1 : 0);
    const steerAmount = steerInput * 1.9 * dt * Math.min(1, Math.abs(car.speed) / 10);
    car.heading += steerAmount * (car.speed >= 0 ? 1 : -1);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const probe = { x: nx, z: nz };
    if (resolveBuildingCollision(probe, 2)) {
      car.speed *= 0.4;
      car.condition = Math.max(0, car.condition - 2);
      if (Math.abs(car.speed) > 8) sound.crash();
    } else {
      car.x = nx;
      car.z = nz;
    }
    car.x = Math.max(-195, Math.min(165, car.x));
    car.z = Math.max(-165, Math.min(165, car.z));
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.z = -steerInput * Math.min(0.06, Math.abs(car.speed) * 0.002);
    game.player.x = car.x;
    game.player.z = car.z;
    game.player.heading = car.heading;
    // Target car ramming (mission 6).
    if (game.targetCar.mesh.visible) {
      const d = Math.hypot(game.targetCar.x - car.x, game.targetCar.z - car.z);
      if (d < 3.4 && Math.abs(car.speed) > 5) {
        game.targetCar.speed *= 0.5;
        const result = recordRamHit(game.missions, scene);
        if (result === 'complete') missionComplete();
        else if (result === 'hit') showDialogue(els, 'MIRA KESANG', 'Crew · Driver', 'Again! Hit him again!', '#3a9ad9');
        sound.crash();
      }
    }
    checkPlayerRam(game.police, car, () => { sound.crash(); });
  }

  function updateOnFoot(dt) {
    const p = game.player;
    const run = game.keys.run ? 2.1 : 1;
    const speed = 5.2 * run;
    let mx = 0;
    let mz = 0;
    if (game.keys.up) mz += 1;
    if (game.keys.down) mz -= 1;
    if (game.keys.left) mx -= 1;
    if (game.keys.right) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      const yaw = p.yaw;
      const wx = mx * Math.cos(yaw) - mz * Math.sin(yaw);
      const wz = mx * Math.sin(yaw) + mz * Math.cos(yaw);
      const nx = p.x + wx * speed * dt;
      const nz = p.z + wz * speed * dt;
      const probe = { x: nx, z: nz };
      if (!resolveBuildingCollision(probe, 0.6)) { p.x = nx; p.z = nz; }
      p.heading = Math.atan2(wx, wz);
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    const swing = Math.sin(elapsed * 9) * (p.speed > 0 ? 0.5 : 0);
    const legL = p.mesh.getObjectByName('legL');
    const legR = p.mesh.getObjectByName('legR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
  }

  function updateCamera(dt) {
    const p = game.player;
    let targetX = p.x;
    let targetZ = p.z;
    let camDist = 10;
    let camHeight = 3.4;
    let lookYaw = p.yaw;
    if (p.inCar && p.car) {
      lookYaw = p.car.heading;
      camDist = 10.5;
      camHeight = 3.1;
      // Chase camera eases behind the car's heading.
      p.yaw += ((p.car.heading - p.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 2.2);
      lookYaw = p.yaw;
    }
    const rightX = Math.cos(lookYaw);
    const rightZ = -Math.sin(lookYaw);
    const sideOffset = p.inCar ? 3.6 : 0;
    const cx = targetX - Math.sin(lookYaw) * camDist + rightX * sideOffset;
    const cz = targetZ - Math.cos(lookYaw) * camDist + rightZ * sideOffset;
    camera.position.set(cx, camHeight + Math.sin(p.pitch) * 1.2, cz);
    camera.lookAt(targetX + rightX * 1.2, 1.6, targetZ + rightZ * 1.2);
  }

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    elapsed += dt;
    if (game.started && !game.paused) {
      game.clockMinutes += dt * 0.6;
      game.shootTimer = Math.max(0, game.shootTimer - dt);
      for (let i = 0; i < 3; i++) game.state.crewCooldown[i] = Math.max(0, game.state.crewCooldown[i] - dt);
      if (game.player.inCar) updateDriving(dt);
      else updateOnFoot(dt);
      updateTrafficCars(game.traffic, dt, game.player.inCar ? game.player.car : null);
      updatePedestrians(game.pedestrians, dt, elapsed);
      updateEnemies(game.enemies, game.player.x, game.player.z, dt);
      updatePolice(game.police, game.player, dt, elapsed, scene);
      updateHelicopter(game.heli, game.player.x, game.player.z, dt, elapsed, game.police.heliActive);
      // Target car cruises the Strand during mission 6.
      if (game.targetCar.mesh.visible) {
        const t = game.targetCar;
        t.x += Math.sin(t.heading) * t.speed * dt;
        t.z += Math.cos(t.heading) * t.speed * dt;
        if (t.z < -150) t.z = 120;
        t.mesh.position.set(t.x, 0, t.z);
        t.mesh.rotation.y = t.heading;
      }
      // Ocean shimmer.
      const ocean = world.group.getObjectByName('ocean');
      if (ocean) ocean.position.y = 0.05 + Math.sin(elapsed * 0.7) * 0.03;
      // Mission progress.
      const event = updateMission(game.missions, scene, game.player, game.police.wanted);
      if (event === 'complete') missionComplete();
      else if (event === 'stage') {
        sound.blip(760, 0.15);
        const stage = currentStage(game.missions);
        if (stage) showDialogue(els, 'MIRA KESANG', 'Crew · Driver', stage.text, '#3a9ad9');
      }
      // Rank + save.
      const rank = rankForXp(game.state.xp);
      game.state.rankName = rank.name;
      game.state.xpNext = rank.next;
      game.saveTimer += dt;
      if (game.saveTimer > 30) { game.saveTimer = 0; saveGame(); }
      sound.setEngine(Math.abs(game.player.inCar && game.player.car ? game.player.car.speed * 3.6 : 0), game.player.inCar);
      sound.tickRadio(dt, game.police.wanted);
      sound.tickSiren(dt, game.police.wanted);
      updateHud(els, game, dt);
      if (game.damageFlash > 0) game.damageFlash -= dt;
    }
    updateCamera(dt);
    renderer.render(scene, camera);
    if (!window.__solaraReady) window.__solaraReady = true;
  }

  // ---- boot ----
  if (shotInfo) {
    game.started = true;
    showHud();
    menuEl.style.display = 'none';
    applyShotPreset(game, shotInfo, els);
    refreshStaticHud(els, game.state);
    updateHud(els, game, 0);
  }
  tick();
  return game;
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    bootSolaraBay();
  } catch (err) {
    const el = document.getElementById('error');
    if (el) { el.style.display = 'block'; el.textContent = 'Solara Bay failed to start: ' + err.message; }
  }
});
