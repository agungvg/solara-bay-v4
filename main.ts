// Solara Bay entry program (Node 22, standard library only): hands the game
// in by copying game/ and screenshots/ from beside this file into the
// output directory and writing /output/dossier.json with the vendored
// make.fun library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output, e.g. MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The program runs twice in the grader and both runs must write the same
// bytes, so it does no timestamps, no randomness and no network: it only
// copies the repository's own files and writes the dossier the library
// builds from them.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The sealed gate's caps (reference/gate.json): dossier text is capped at
// 160 KiB; at most 4 screenshots of at most 256 KiB; game/ at most 993
// files and 48 MiB, paths at most 1000 bytes.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`Solara Bay dossier written to ${join(outputDir, 'dossier.json')}`);
