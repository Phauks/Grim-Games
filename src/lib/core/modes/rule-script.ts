/**
 * A game's script when its special rules change before it begins (Trevor, 2026-10-29: the
 * rules are chosen on Character selection, after the game is made). Starting a game folds the
 * rules into its script (`rulesScript` in the start flow); this does the same to a script that
 * already has rules: the old rules' own lines leave its Bootlegger lines and the new rules'
 * join them, characters a new rule bans leave it, and those a new rule always puts on the
 * script or in play join it.
 */
import type { CharacterId, Script } from '#lib/core/data/types.ts';
import type { SpecialRule } from './types.ts';

const lines = (rules: readonly SpecialRule[]) => rules.flatMap((r) => r.parts.text ?? []);

export function scriptForRules(
	script: Script,
	before: readonly SpecialRule[],
	after: readonly SpecialRule[]
): Script {
	const old = new Set(lines(before));
	const kept = (script.meta?.bootlegger ?? []).filter((line) => !old.has(line));
	const bootlegger = [...kept, ...lines(after)];
	const banned = new Set<CharacterId>(after.flatMap((r) => r.parts.restricted?.banned ?? []));
	const entries = script.entries.filter(
		(e) => !banned.has(e.kind === 'custom' ? e.character.id : e.id)
	);
	const have = new Set(entries.map((e) => (e.kind === 'custom' ? e.character.id : e.id)));
	for (const id of after.flatMap((r) => [
		...(r.parts.forced?.onScript ?? []),
		...(r.parts.forced?.inPlay ?? [])
	])) {
		if (have.has(id) || banned.has(id)) continue;
		entries.push({ kind: 'official', id });
		have.add(id);
	}
	const meta = script.meta || bootlegger.length ? { name: '', ...script.meta } : undefined;
	if (meta) {
		if (bootlegger.length) meta.bootlegger = bootlegger;
		else delete meta.bootlegger;
	}
	return { ...script, ...(meta ? { meta } : {}), entries };
}
