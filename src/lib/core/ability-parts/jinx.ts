/**
 * SPIKE: applies a jinx to the two characters' parts (`JinxPatch` in `types.ts`). The app
 * shows TPI's jinx text today and enforces only "only one can be in play"; as patches, a
 * jinx changes the clauses the rest of the app already reads, and a custom script's own
 * jinxes can do the same.
 */
import type { AbilityParts, Clause, JinxParts } from './types.ts';

export interface JinxResult {
	parts: Map<string, AbilityParts>;
	/** Both characters may not be in play together. */
	exclusive: boolean;
	/** Clauses switched off while their condition holds, as `character.clause`. */
	suppressed: { clause: string; while: string }[];
	/** What the Storyteller must handle by hand. */
	notes: string[];
}

export function applyJinx(parts: ReadonlyMap<string, AbilityParts>, jinx: JinxParts): JinxResult {
	const out = new Map(parts);
	const result: JinxResult = { parts: out, exclusive: false, suppressed: [], notes: [] };
	const edit = (id: string, change: (clauses: Clause[]) => Clause[]) => {
		const current = out.get(id);
		if (!current) throw new Error(`jinx ${jinx.characters.join('+')}: no parts for ${id}`);
		out.set(id, { ...current, clauses: change(current.clauses) });
	};
	for (const patch of jinx.patches) {
		switch (patch.op) {
			case 'exclusive':
				result.exclusive = true;
				break;
			case 'add':
				edit(patch.character, (clauses) => [...clauses, patch.clause]);
				break;
			case 'suppress':
				edit(patch.character, (clauses) => {
					if (!clauses.some((c) => c.id === patch.clause))
						throw new Error(`jinx: ${patch.character} has no clause ${patch.clause}`);
					return clauses;
				});
				result.suppressed.push({
					clause: `${patch.character}.${patch.clause}`,
					while: patch.while
				});
				break;
			case 'set':
				edit(patch.character, (clauses) =>
					clauses.map((c) => (c.id === patch.clause ? { ...c, [patch.field]: patch.value } : c))
				);
				break;
			case 'storyteller':
				result.notes.push(patch.note);
				break;
		}
	}
	return result;
}
