/**
 * Writes what every `:reminder:` in TPI's night text means as JSON, for review outside the
 * app: `[{ id, name, night, index, tokens: [{ label, action }], either, text }]`, one row per
 * `:reminder:` in text order (`index` is 0-based within that night's text). Generated from
 * each rules file's `reminderPlaceholders` (`src/lib/core/data/rules/<id>.json`), so edit
 * those, not the output.
 *
 *   npm run export:reminder-placeholders -- <output.json>
 */
import { writeFileSync } from 'node:fs';
import { placeholderProblems, placeholdersFor } from '../src/lib/core/rules/night-text.ts';
import { readGameData } from './lib/game-data-files.ts';

const out = process.argv[2];
if (!out) {
	console.error('Usage: npm run export:reminder-placeholders -- <output.json>');
	process.exit(1);
}
const characters = readGameData().characters;
const problems = placeholderProblems(characters);
if (problems.length) {
	console.error(problems.join('\n'));
	process.exit(1);
}
const rows = characters.flatMap((c) =>
	(['first', 'other'] as const).flatMap((night) =>
		(placeholdersFor(c, night) ?? []).map((p, index) => ({
			id: c.id,
			name: c.name,
			night,
			index,
			tokens: p.tokens.map((t) => ({ label: t.label, action: t.action })),
			either: p.either ?? false,
			text: night === 'first' ? c.firstNightReminder : c.otherNightReminder
		}))
	)
);
writeFileSync(out, `${JSON.stringify(rows, null, '\t')}\n`);
console.log(`Wrote ${rows.length} :reminder: mappings to ${out}`);
