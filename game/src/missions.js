// Story missions for Solara Bay: eight missions, each with staged
// objectives. A stage completes when the player reaches its marker, rams
// its target enough times, clears its enemy count, or escapes the heat.
// The beacon column in the world and the minimap both point at the stage.

import { MISSIONS } from './data.js';
import * as THREE from 'three';

export function createMissionState() {
  return {
    activeId: 0, stageIndex: 0, stageProgress: 0,
    completed: new Set(), startedAt: 0, beacon: null,
  };
}

export function currentMission(state) {
  return MISSIONS.find((m) => m.id === state.activeId) || null;
}

export function currentStage(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.stages[Math.min(state.stageIndex, mission.stages.length - 1)];
}

export function startMission(state, id, scene) {
  const mission = MISSIONS.find((m) => m.id === id);
  if (!mission) return null;
  state.activeId = id;
  state.stageIndex = 0;
  state.stageProgress = 0;
  state.startedAt = performance.now();
  moveBeacon(state, scene);
  return mission;
}

export function missionProgressLabel(state) {
  const mission = currentMission(state);
  if (!mission) return { text: 'NO ACTIVE MISSION', stage: '—', total: 0, done: 0 };
  return {
    text: mission.title,
    stage: `STAGE ${state.stageIndex + 1}/${mission.stages.length}`,
    total: mission.stages.length,
    done: state.stageIndex,
    chapter: mission.chapter,
    objective: currentStage(state) ? currentStage(state).text : '',
  };
}

export function makeBeacon(scene) {
  const geo = new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffc94a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(geo, mat);
  beacon.position.y = 30;
  beacon.visible = false;
  scene.add(beacon);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.0, 24),
    new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  ring.visible = false;
  scene.add(ring);
  return { column: beacon, ring };
}

export function moveBeacon(state, scene) {
  if (!state.beacon) state.beacon = makeBeacon(scene);
  const stage = currentStage(state);
  const hasTarget = stage && stage.at;
  state.beacon.column.visible = !!hasTarget;
  state.beacon.ring.visible = !!hasTarget;
  if (hasTarget) {
    state.beacon.column.position.set(stage.at[0], 30, stage.at[1]);
    state.beacon.ring.position.set(stage.at[0], 0.15, stage.at[1]);
  }
}

export function advanceStage(state, scene) {
  const mission = currentMission(state);
  if (!mission) return false;
  state.stageIndex += 1;
  state.stageProgress = 0;
  if (state.stageIndex >= mission.stages.length) {
    state.completed.add(mission.id);
    state.activeId = 0;
    state.stageIndex = 0;
    if (state.beacon) {
      state.beacon.column.visible = false;
      state.beacon.ring.visible = false;
    }
    return true; // mission complete
  }
  moveBeacon(state, scene);
  return false;
}

// Called every frame: returns an event string ('stage' | 'complete' | null)
// when a stage condition is met by the player's position or actions.
export function updateMission(state, scene, player, wanted) {
  const stage = currentStage(state);
  if (!stage) return null;
  if (stage.kind === 'goto' && stage.at) {
    const dist = Math.hypot(player.x - stage.at[0], player.z - stage.at[1]);
    if (dist < 6) {
      const done = advanceStage(state, scene);
      return done ? 'complete' : 'stage';
    }
  }
  if (stage.kind === 'escape' && wanted <= 0) {
    const done = advanceStage(state, scene);
    return done ? 'complete' : 'stage';
  }
  if (stage.kind === 'steal' && player.inCar) {
    const done = advanceStage(state, scene);
    return done ? 'complete' : 'stage';
  }
  if (stage.kind === 'tail' || stage.kind === 'ram') {
    // Ram / tail stages are advanced by the combat code calling
    // recordRamHit / recordCombatKill; here we only guard the timer.
    return null;
  }
  return null;
}

export function recordRamHit(state, scene) {
  const stage = currentStage(state);
  if (!stage || stage.kind !== 'ram') return null;
  state.stageProgress += 1;
  if (state.stageProgress >= (stage.count || 1)) {
    const done = advanceStage(state, scene);
    return done ? 'complete' : 'stage';
  }
  return 'hit';
}

export function recordCombatKill(state, scene) {
  const stage = currentStage(state);
  if (!stage || stage.kind !== 'combat') return null;
  state.stageProgress += 1;
  if (state.stageProgress >= (stage.count || 1)) {
    const done = advanceStage(state, scene);
    return done ? 'complete' : 'stage';
  }
  return 'kill';
}

export function missionListForMenu(state) {
  return MISSIONS.map((m) => ({
    id: m.id, chapter: m.chapter, title: m.title, pay: m.pay,
    done: state.completed.has(m.id),
    active: state.activeId === m.id,
  }));
}
