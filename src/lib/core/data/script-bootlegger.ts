/**
 * A script's Bootlegger meta, read leniently like the rest of `_meta` (`script.ts`):
 * - `bootlegger`: its homebrew rules as lines of text (TPI's `script-schema.json`);
 * - `bootleggerRules` (M61f, an app extension): what those lines do, as a rules block with the
 *   same parts as a homebrew character's `rules`. Each rule the app can't read is left out with
 *   a warning, never the whole block. A block with no lines is left out: a rule the players
 *   can't read would be a hidden rule.
 */
import { parseCharacterRules, readableRules } from './character-rules.ts';
import type { ScriptMeta } from './types.ts';
import { isObject, Issues, type Json } from './validate.ts';

export function loadBootlegger(raw: Json, meta: ScriptMeta, warn: (message: string) => void): void {
	if (raw.bootlegger !== undefined) {
		const lines =
			typeof raw.bootlegger === 'string'
				? [raw.bootlegger]
				: Array.isArray(raw.bootlegger)
					? raw.bootlegger.filter((r): r is string => typeof r === 'string')
					: [];
		if (lines.length === 0 && raw.bootlegger !== '')
			warn('Ignored the homebrew rules (bootlegger): expected a list of text.');
		else meta.bootlegger = lines;
	}
	if (raw.bootleggerRules === undefined) return;
	if (!(meta.bootlegger ?? []).some((line) => line.trim() !== '')) {
		warn('Ignored the homebrew rules block (bootleggerRules): it needs bootlegger lines.');
		return;
	}
	if (!isObject(raw.bootleggerRules)) {
		warn('Ignored the homebrew rules block (bootleggerRules): expected an object.');
		return;
	}
	const { rules, dropped } = readableRules(raw.bootleggerRules);
	for (const { key, problems } of dropped)
		warn(`Ignored its rule "${key}", which this app can't use: ${problems.join('; ')}.`);
	const parsed = parseCharacterRules(rules, 'bootleggerRules', new Issues());
	if (parsed && Object.keys(parsed).length > 0) meta.bootleggerRules = parsed;
}
