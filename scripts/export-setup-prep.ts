/**
 * Writes the setup preparation for every character as JSON, for review outside the app:
 * `[{ id, prep: [{ text, tokens, target? }] }]`, `prep` empty when there is none. Generated
 * from the `setupPrep` key of each `src/lib/core/data/rules/<id>.json`, so edit those, not the output.
 *
 *   npm run export:setup-prep -- <output.json>
 */
import { writeFileSync } from 'node:fs';
import { setupPrep } from '../src/lib/core/rules/setup-reminders.ts';
import { readGameData } from './lib/game-data-files.ts';

const out = process.argv[2];
if (!out) {
	console.error('Usage: npm run export:setup-prep -- <output.json>');
	process.exit(1);
}
const characters = readGameData().characters;
const rows = characters.map((c) => ({ id: c.id, prep: setupPrep(c.id, c.name) }));
writeFileSync(out, `${JSON.stringify(rows, null, '\t')}\n`);
console.log(
	`Wrote ${rows.length} characters (${rows.filter((r) => r.prep.length > 0).length} with prep) to ${out}`
);
