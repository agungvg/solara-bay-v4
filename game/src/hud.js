// Dense HUD for Solara Bay: mission card, police response panel, wanted
// stars, cash + rank, weapon slots, crew cards, dialogue, minimap with
// district card, speed + vehicle + damage, radio line and clock. Every value
// is read live from the game state each frame.

import { DISTRICTS, CREW, WEAPONS, MISSIONS } from './data.js';
import { missionProgressLabel } from './missions.js';
import { policePanelRows } from './police.js';

export function bustPortraitSVG(color, bg) {
  return `<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">`
    + `<rect width="48" height="48" rx="6" fill="${bg}"/>`
    + `<circle cx="24" cy="19" r="9" fill="${color}"/>`
    + `<path d="M6 48 Q24 28 42 48 Z" fill="${color}"/>`
    + `<path d="M15 12 Q24 2 33 12 Q33 7 24 7 Q15 7 15 12Z" fill="#241a12"/>`
    + `</svg>`;
}

export function buildHudElements() {
  return {
    missionTitle: document.getElementById('mission-title'),
    missionChapter: document.getElementById('mission-chapter'),
    missionStage: document.getElementById('mission-stage'),
    missionObjective: document.getElementById('mission-objective'),
    missionNext: document.getElementById('mission-next'),
    missionBar: document.getElementById('mission-bar'),
    policeList: document.getElementById('police-list'),
    policeCount: document.getElementById('police-count'),
    policeNote: document.getElementById('police-note'),
    cash: document.getElementById('cash'),
    stars: document.getElementById('stars'),
    clock: document.getElementById('clock'),
    rankName: document.getElementById('rank-name'),
    rankBar: document.getElementById('rank-bar'),
    rankText: document.getElementById('rank-text'),
    weapons: document.getElementById('weapons'),
    crew: document.getElementById('crew'),
    dialogue: document.getElementById('dialogue'),
    dialogueSpeaker: document.getElementById('dialogue-speaker'),
    dialogueRole: document.getElementById('dialogue-role'),
    dialogueText: document.getElementById('dialogue-text'),
    dialoguePortrait: document.getElementById('dialogue-portrait'),
    minimap: document.getElementById('minimap'),
    districtName: document.getElementById('district-name'),
    districtRoad: document.getElementById('district-road'),
    districtGrip: document.getElementById('district-grip'),
    districtMeter: document.getElementById('district-meter'),
    healthBar: document.getElementById('health-bar'),
    healthText: document.getElementById('health-text'),
    armourBar: document.getElementById('armour-bar'),
    armourText: document.getElementById('armour-text'),
    speed: document.getElementById('speed'),
    vehicleName: document.getElementById('vehicle-name'),
    vehicleTune: document.getElementById('vehicle-tune'),
    damageBar: document.getElementById('damage-bar'),
    damageText: document.getElementById('damage-text'),
    radio: document.getElementById('radio'),
    hint: document.getElementById('hint'),
  };
}

export function nearestDistrict(x, z) {
  let best = DISTRICTS[0];
  let bestDist = Infinity;
  for (const d of DISTRICTS) {
    const dist = Math.hypot(x - d.x, z - d.z);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}

function starRow(wanted) {
  let out = '';
  for (let i = 0; i < 5; i++) out += i < wanted ? '★' : '☆';
  return out;
}

function weaponIcon(kind) {
  if (kind === 'fist') return '✊';
  if (kind === 'pistol') return '🔫';
  if (kind === 'smg') return '▭▬';
  return '▬▬';
}

export function refreshStaticHud(els, state) {
  // Weapon slots.
  els.weapons.innerHTML = WEAPONS.map((w, i) => {
    const active = state.weaponIndex === i ? ' active' : '';
    const ammo = w.ammo === Infinity ? '∞' : `${state.ammo[w.slot] ?? w.ammo}`;
    return `<div class="wslot${active}"><span class="wkey">${w.slot}</span>`
      + `<span class="wicon">${weaponIcon(w.icon)}</span>`
      + `<span class="wname">${w.name}</span><span class="wammo">${ammo}</span></div>`;
  }).join('');
  // Crew ability cards with small stylised bust portraits (no faces).
  const colors = ['#3a9ad9', '#f5a742', '#9a6ad9'];
  els.crew.innerHTML = CREW.map((c, i) => {
    const cd = state.crewCooldown[i] || 0;
    const ready = cd <= 0;
    return `<div class="crew-card${ready ? '' : ' cooling'}">`
      + `<span class="crew-portrait">${bustPortraitSVG(colors[i], '#22303f')}</span>`
      + `<span class="crew-info"><b>${c.name}</b><i>${c.member}</i></span>`
      + `<span class="crew-key">${ready ? c.key : Math.ceil(cd) + 's'}</span></div>`;
  }).join('');
}

export function showDialogue(els, speaker, role, text, color) {
  els.dialogue.style.display = 'flex';
  els.dialogueSpeaker.textContent = speaker;
  els.dialogueRole.textContent = role;
  els.dialogueText.textContent = text;
  els.dialoguePortrait.innerHTML = bustPortraitSVG(color || '#3a9ad9', '#22303f');
}

export function hideDialogue(els) {
  els.dialogue.style.display = 'none';
}

export function updateHud(els, game, dt) {
  const s = game.state;
  const mission = missionProgressLabel(game.missions);
  els.missionTitle.textContent = mission.text;
  els.missionChapter.textContent = mission.chapter || 'FREE ROAM · SOLARA BAY';
  els.missionStage.textContent = mission.stage;
  els.missionObjective.textContent = mission.objective || 'Explore the city — press M for missions.';
  els.missionNext.textContent = game.nextMissionHint || '';
  const pct = mission.total ? (mission.done / mission.total) * 100 : 0;
  els.missionBar.style.width = `${pct}%`;

  const rows = policePanelRows(game.police);
  els.policeCount.textContent = `${game.police.units.length} UNITS`;
  els.policeList.innerHTML = rows.map((r) => {
    const roleClass = r.role === 'RAMMING' ? 'role-ram' : r.role === 'FLANKING' ? 'role-flank' : 'role-pursuit';
    return `<div class="police-row"><span class="pname">${r.name}</span>`
      + `<span class="prole ${roleClass}">${r.role}</span>`
      + `<span class="pdist">${r.dist} m</span></div>`;
  }).join('') || '<div class="police-row"><span class="pname">NO UNITS</span><span class="prole">—</span><span class="pdist">—</span></div>';
  els.policeNote.textContent = game.police.wanted >= 3 ? 'AIR UNIT DEPLOYED · OSPREY-1 OVERHEAD'
    : game.police.wanted >= 1 ? 'UNITS RESPONDING' : 'STREETS QUIET';

  els.cash.textContent = `$${s.cash.toLocaleString('en-US')}`;
  els.stars.textContent = starRow(game.police.wanted);
  els.stars.className = game.police.wanted > 0 ? 'stars hot' : 'stars';
  const hh = Math.floor(game.clockMinutes / 60) % 24;
  const mm = Math.floor(game.clockMinutes % 60);
  els.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  els.rankName.textContent = s.rankName;
  els.rankBar.style.width = `${Math.min(100, (s.xp / s.xpNext) * 100)}%`;
  els.rankText.textContent = `${s.xp.toLocaleString('en-US')} / ${s.xpNext.toLocaleString('en-US')} XP`;

  const district = nearestDistrict(game.player.x, game.player.z);
  els.districtName.textContent = district.name;
  els.districtRoad.textContent = district.road + ' · ' + district.mood;
  els.districtGrip.textContent = `GRIP ${district.grip}%`;
  els.districtMeter.style.width = `${district.grip}%`;

  els.healthBar.style.width = `${s.health}%`;
  els.healthText.textContent = Math.round(s.health);
  els.armourBar.style.width = `${s.armour}%`;
  els.armourText.textContent = Math.round(s.armour);

  if (game.player.inCar && game.player.car) {
    const kmh = Math.round(Math.abs(game.player.car.speed) * 3.6);
    els.speed.textContent = kmh;
    els.vehicleName.textContent = game.player.car.model.name;
    els.vehicleTune.textContent = `TUNE ${game.player.car.tune || 3} · ${game.player.car.model.kind.toUpperCase()}`;
    els.damageBar.style.width = `${game.player.car.condition}%`;
    els.damageText.textContent = `${Math.round(game.player.car.condition)}% ${game.player.car.condition > 60 ? 'CLEAN' : game.player.car.condition > 25 ? 'DENTED' : 'SMOKING'}`;
  } else {
    els.speed.textContent = Math.round(game.player.speed * 3.6);
    els.vehicleName.textContent = 'ON FOOT';
    els.vehicleTune.textContent = 'WALKING · SOLARA BAY';
    els.damageBar.style.width = '100%';
    els.damageText.textContent = '—';
  }
  const station = game.sound.currentStation();
  els.radio.textContent = `♪ RADIO ${station.name} — ${station.track}`;
  els.hint.textContent = game.hintText || '';
  els.hint.style.display = game.hintText ? 'block' : 'none';
  drawMinimap(els.minimap, game);
}

export function drawMinimap(canvas, game) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1a2a3a';
  ctx.fillRect(0, 0, W, H);
  const toMap = (x, z) => [((x + 200) / 400) * W, ((z + 200) / 400) * H];
  // Ocean + sand on the west.
  const [ox] = toMap(-200, 0);
  ctx.fillStyle = '#2a7a9a';
  ctx.fillRect(0, 0, Math.max(0, ox + W * 0.05), H);
  ctx.fillStyle = '#e8cf9a';
  ctx.fillRect(Math.max(0, ox + W * 0.05), 0, 8, H);
  // Roads.
  ctx.strokeStyle = '#8a8a9a';
  ctx.lineWidth = 3;
  for (const line of [-120, -80, -40, 0, 40, 80, 120, -140]) {
    const [ax, ay] = toMap(line, -170);
    const [bx, by] = toMap(line, 170);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    const [cx, cy] = toMap(-170, line);
    const [dx, dy] = toMap(170, line);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke();
  }
  // Mission marker.
  const stage = game.missions ? (game.missions.activeId ? currentStagePos(game.missions) : null) : null;
  if (stage) {
    const [mx, my] = toMap(stage[0], stage[1]);
    ctx.fillStyle = '#ffc94a';
    ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.stroke();
  }
  // Traffic dots.
  ctx.fillStyle = '#ffffff';
  for (const car of game.traffic || []) {
    const [tx, ty] = toMap(car.x, car.z);
    ctx.fillRect(tx - 1, ty - 1, 2, 2);
  }
  // Police dots.
  ctx.fillStyle = '#ff4a4a';
  for (const u of game.police.units) {
    const [ux, uy] = toMap(u.x, u.z);
    ctx.beginPath(); ctx.arc(ux, uy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const [px, py] = toMap(game.player.x, game.player.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(game.player.heading);
  ctx.fillStyle = '#7dff9a';
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // North tick.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('N', W / 2 - 4, 12);
}

function currentStagePos(missions) {
  const m = missions.activeId;
  if (!m) return null;
  const mission = MISSIONS.find((x) => x.id === m);
  if (!mission) return null;
  const stage = mission.stages[Math.min(missions.stageIndex, mission.stages.length - 1)];
  return stage && stage.at ? stage.at : null;
}
