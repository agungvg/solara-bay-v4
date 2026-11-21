// Story data for Solara Bay: districts, crew, weapons, radio stations and
// the eight story missions. All names, people and places are invented here.

export const DISTRICTS = [
  { name: 'KUMALA STRAND', road: 'Strand Boulevard', mood: 'Beachfront strip', grip: 58, x: -140, z: 0 },
  { name: 'LANTAWA CENTRE', road: 'Meridian Avenue', mood: 'Glass towers', grip: 62, x: -20, z: -40 },
  { name: 'OLD PASARU', road: 'Pasar Lane', mood: 'Night market', grip: 74, x: 80, z: 80 },
  { name: 'BANYAN GREEN', road: 'Banyan Row', mood: 'Leafy blocks', grip: 70, x: 40, z: -80 },
  { name: 'LOMBOK WHARF', road: 'Harbor Road', mood: 'Docks and cranes', grip: 44, x: 100, z: -120 },
  { name: 'MIRADOR CREST', road: 'Linterna Street', mood: 'Hill estates', grip: 51, x: 100, z: 120 },
];

export const CREW = [
  { key: 'Z', name: 'SWAP PLATES', member: 'Mira · Driver', cooldown: 21, desc: 'Fresh plates, wanted drops one star.' },
  { key: 'X', name: 'QUICK FIX', member: 'Lio · Mechanic', cooldown: 34, desc: 'Patch the car back to 80% condition.' },
  { key: 'C', name: 'EYES OUT', member: 'Kiki · Lookout', cooldown: 18, desc: 'Police distances on the map for 20 s.' },
];

export const WEAPONS = [
  { slot: 1, name: 'FISTS', ammo: Infinity, icon: 'fist' },
  { slot: 2, name: '.38 REVOLVER', ammo: 60, icon: 'pistol' },
  { slot: 3, name: 'SMG', ammo: 90, icon: 'smg' },
  { slot: 4, name: '12G PUMP', ammo: 18, icon: 'shotgun' },
];

export const RADIO_STATIONS = [
  { name: 'OMBO 98.4', genre: 'Island Pop', track: 'Tide Runner — Sol Mara' },
  { name: 'NARANJA 99.1', genre: 'Sunset Rock', track: 'Arepa Lights — Kip Sorrento' },
  { name: 'WAVE 101.7', genre: 'Night Drive', track: 'Palm Static — Duo Lumen' },
];

export const MISSIONS = [
  {
    id: 1, chapter: 'CH.1 · LOW TIDE', title: 'FIRST WHEELS',
    giver: 'MIRA KESANG', pay: 800,
    stages: [
      { text: 'Steal any parked car on Meridian Ave', kind: 'steal' },
      { text: 'Lose the patrol tail', kind: 'escape' },
      { text: 'Park at the Banyan safehouse', kind: 'goto', at: [40, -80] },
    ],
  },
  {
    id: 2, chapter: 'CH.1 · LOW TIDE', title: 'HARBOR LIGHTS',
    giver: 'MIRA KESANG', pay: 1200,
    stages: [
      { text: 'Meet Mira at the end of Kumala Pier', kind: 'goto', at: [-196, 40] },
      { text: 'Collect the package from the dock shed', kind: 'goto', at: [100, -120] },
      { text: 'Deliver the package to the wharf office', kind: 'goto', at: [120, -100] },
    ],
  },
  {
    id: 3, chapter: 'CH.2 · UNDERTOW', title: 'THE COURIER RUN',
    giver: 'LIO TAN', pay: 2000,
    stages: [
      { text: 'Pick up the courier case in Old Pasaru', kind: 'goto', at: [80, 80] },
      { text: 'Drop it at the Lantern Mile kiosk', kind: 'goto', at: [-40, 40] },
      { text: 'Shake the two tails on the Strand', kind: 'escape' },
      { text: 'Return the case to Lio at Banyan Green', kind: 'goto', at: [40, -80] },
    ],
  },
  {
    id: 4, chapter: 'CH.2 · UNDERTOW', title: 'MARKET SQUEEZE',
    giver: 'MIRA KESANG', pay: 2400,
    stages: [
      { text: 'Enter the Pasaru night market', kind: 'goto', at: [80, 80] },
      { text: 'Clear the aisles of Kerono crew 0/5', kind: 'combat', count: 5 },
      { text: 'Melt away through the back stalls', kind: 'escape' },
    ],
  },
  {
    id: 5, chapter: 'CH.3 · HIGH WATER', title: 'PINK SLIPS',
    giver: 'KIKI ORA', pay: 3200,
    stages: [
      { text: 'Line up at the Strand start gantry', kind: 'goto', at: [-140, -120] },
      { text: 'Race checkpoint 1/3 — Mirador turn', kind: 'goto', at: [80, 120] },
      { text: 'Race checkpoint 2/3 — Lantern Mile', kind: 'goto', at: [-40, 40] },
      { text: 'Cross the finish on Strand Boulevard', kind: 'goto', at: [-140, 120] },
    ],
  },
  {
    id: 6, chapter: 'CH.3 · HIGH WATER', title: 'WRECK THE REGENT',
    giver: 'MIRA KESANG', pay: 4200,
    stages: [
      { text: 'Find the Regent on Strand Boulevard', kind: 'goto', at: [-140, -40] },
      { text: 'Tail the Regent without spooking it', kind: 'tail' },
      { text: 'Wreck the Regent before it reaches the pier', kind: 'ram', count: 3 },
      { text: 'Vanish — lose the heat', kind: 'escape' },
    ],
  },
  {
    id: 7, chapter: 'CH.4 · SPRING TIDE', title: 'BANCO SOLARA',
    giver: 'LIO TAN', pay: 9000,
    stages: [
      { text: 'Reach the Banco Solara front steps', kind: 'goto', at: [-20, -40] },
      { text: 'Grab the satchel inside the lobby', kind: 'goto', at: [-20, -20] },
      { text: 'Break the roadblock on Meridian Ave', kind: 'ram', count: 2 },
      { text: 'Lose the heat down Tangerine Mile', kind: 'escape' },
    ],
  },
  {
    id: 8, chapter: 'CH.4 · SPRING TIDE', title: 'THE LAMPLIGHTER',
    giver: 'KIKI ORA', pay: 12000,
    stages: [
      { text: 'Reach the Mirador estate gate', kind: 'goto', at: [100, 120] },
      { text: 'Break the Combine guard 0/6', kind: 'combat', count: 6 },
      { text: 'Light the beacon on the estate roof', kind: 'goto', at: [120, 120] },
      { text: 'Walk away clean — no wanted level', kind: 'escape' },
    ],
  },
];

export const DIALOGUE_LINES = {
  cover: { speaker: 'MIRA KESANG', role: 'Crew · Driver', text: "He's making for Kumala Pier! Ram the Regent before it reaches the water!" },
  chase: { speaker: 'CAPT. VANCE', role: 'SBP Dispatch', text: 'All units, suspect is southbound on the Strand. Osprey One has the light.' },
  foot: { speaker: 'MIRA KESANG', role: 'Crew · Driver', text: "Two down the left aisle! I've got the stall side, Tomo." },
  night: { speaker: 'LIO TAN', role: 'Crew · Mechanic', text: 'Package is warm, harbor lights are on. Bring it in slow, no sirens.' },
};

export const CAR_MODELS = [
  { name: 'RUKAN PELO GT', kind: 'sports', color: 0xff7a3c, topSpeed: 62, accel: 26 },
  { name: 'SOLARA SEDAN', kind: 'sedan', color: 0x3c7aff, topSpeed: 44, accel: 18 },
  { name: 'BANYAN PICKUP', kind: 'pickup', color: 0x7ac74f, topSpeed: 40, accel: 16 },
  { name: 'MERIDIAN TAXI', kind: 'taxi', color: 0xf5c542, topSpeed: 42, accel: 17 },
  { name: 'WHARF VAN', kind: 'van', color: 0xd8d3c8, topSpeed: 36, accel: 13 },
];
