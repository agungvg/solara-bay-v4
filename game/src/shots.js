// Screenshot staging for Solara Bay: ?shot=cover|chase|foot|night&seed=N
// drops the game into a deterministic, fully-dressed action frame — the
// player mid-chase or mid-fight, wanted level live, police closing, a
// mission in progress and dialogue on screen — with no menu in the way.
// The game keeps simulating (autopilot drives in car shots) so the frame
// is a real render of the running game, not a still.

import { DIALOGUE_LINES } from './data.js';
import { startMission } from './missions.js';
import { raiseWanted, syncPoliceUnits } from './police.js';
import { showDialogue } from './hud.js';
import { makeEnemy } from './people.js';

export const SHOT_PRESETS = {
  cover: {
    mode: 'sunset', mission: 6, stage: 2, wanted: 4, cash: 18450, xp: 3900,
    dialogue: 'cover', inCar: true, carX: -140, carZ: 30, carHeading: Math.PI,
    speed: 31, clockMinutes: 16 * 60, district: 'KUMALA STRAND',
  },
  chase: {
    mode: 'dusk', mission: 7, stage: 1, wanted: 5, cash: 19320, xp: 5100,
    dialogue: 'chase', inCar: true, carX: -140, carZ: -60, carHeading: Math.PI,
    speed: 26, clockMinutes: 18 * 60 + 40, district: 'KUMALA STRAND',
  },
  foot: {
    mode: 'night', mission: 4, stage: 1, wanted: 2, cash: 7270, xp: 1675,
    dialogue: 'foot', inCar: false, carX: 48, carZ: 84, carHeading: Math.PI / 2,
    speed: 0, clockMinutes: 19 * 60 + 31, district: 'OLD PASARU',
  },
  night: {
    mode: 'night', mission: 2, stage: 1, wanted: 3, cash: 9860, xp: 2400,
    dialogue: 'night', inCar: true, carX: -150, carZ: 90, carHeading: Math.PI,
    speed: 14, clockMinutes: 21 * 60 + 5, district: 'KUMALA STRAND',
  },
};

export function parseShotQuery(search) {
  const params = new URLSearchParams(search);
  const shot = params.get('shot');
  if (!shot || !SHOT_PRESETS[shot]) return null;
  const seed = Number(params.get('seed') || '7');
  return { name: shot, preset: SHOT_PRESETS[shot], seed: Number.isFinite(seed) ? seed : 7 };
}

export function applyShotPreset(game, shotInfo, els) {
  const p = shotInfo.preset;
  game.state.cash = p.cash;
  game.state.xp = p.xp;
  game.clockMinutes = p.clockMinutes;
  game.shotMode = shotInfo.name;
  game.autopilot = p.inCar;
  // Mission at the requested stage.
  startMission(game.missions, p.mission, game.scene);
  game.missions.stageIndex = p.stage;
  // Player placement.
  game.player.x = p.carX;
  game.player.z = p.carZ;
  game.player.heading = p.carHeading;
  game.player.yaw = p.carHeading;
  if (p.inCar) {
    const car = game.playerCar;
    car.x = p.carX;
    car.z = p.carZ;
    car.heading = p.carHeading;
    car.speed = p.speed;
    car.condition = p.name === 'cover' ? 62 : p.name === 'chase' ? 48 : 88;
    car.mesh.position.set(p.carX, 0, p.carZ);
    car.mesh.rotation.y = p.carHeading;
    game.player.inCar = true;
    game.player.car = car;
    game.player.mesh.visible = false;
  } else {
    game.player.inCar = false;
    game.player.car = null;
    game.player.mesh.position.set(p.carX, 0, p.carZ);
    game.player.mesh.visible = true;
    game.state.weaponIndex = 2; // SMG out for the foot shot
  }
  // Wanted level + police placed closing in.
  game.police.wanted = 0;
  game.police.units = [];
  raiseWanted(game.police, p.wanted, game.scene);
  syncPoliceUnits(game.police, game.scene);
  const spots = [
    [-9, -16], [11, -22], [-17, 6], [15, 12], [-7, -34], [21, -8], [-25, -14], [7, 20],
  ];
  game.police.units.forEach((u, i) => {
    const s = spots[i % spots.length];
    u.x = p.carX + s[0];
    u.z = p.carZ + s[1];
    u.heading = Math.atan2(p.carX - u.x, p.carZ - u.z);
    u.speed = 18 + i;
    u.distance = Math.hypot(s[0], s[1]);
    u.mesh.position.set(u.x, 0, u.z);
    u.mesh.rotation.y = u.heading;
  });
  // Dialogue on screen.
  const line = DIALOGUE_LINES[p.dialogue];
  if (line) showDialogue(els, line.speaker, line.role, line.text, line.speaker.startsWith('CAPT') ? '#2a4a8a' : '#3a9ad9');
  // Mission 4 / 8 combat stages need their enemy crew on the street.
  if (p.mission === 4 || p.mission === 8) {
    const spots = p.mission === 4
      ? [[66, 72], [74, 78], [80, 70], [70, 80], [84, 76]]
      : [[108, 112], [116, 120], [104, 124], [118, 110], [110, 126], [112, 116]];
    for (const [ex, ez] of spots) game.enemies.push(makeEnemy(game.scene, ex, ez));
  }
  // A few pedestrians on the Strand sidewalk, right in the chase frame.
  const strollSpots = [[-132, -8], [-148, -18], [-132, -26], [-148, -38], [-132, -48], [-148, -58]];
  strollSpots.forEach(([sx, sz], i) => {
    const p = game.pedestrians[i % game.pedestrians.length];
    if (!p) return;
    p.x = sx;
    p.z = game.player.z + sz;
    p.heading = Math.PI;
    p.mesh.position.set(p.x, 0, p.z);
  });
  game.hintText = '';
  game.nextMissionHint = p.name === 'cover' ? 'NEXT  Vanish' : p.name === 'chase' ? 'NEXT  Lose the heat' : '';
  window.__solaraShot = shotInfo.name;
}
