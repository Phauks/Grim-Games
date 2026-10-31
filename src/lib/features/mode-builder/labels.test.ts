import { describe, expect, it } from 'vitest';
import { buildParts, partFields, topFields, type BuildKind } from '#lib/core/modes/index.ts';
import { en } from '#lib/i18n/messages/en.ts';

/** Every part, kind and field the Mode builder draws from the guide has a label of its own. */
describe('Mode builder labels', () => {
	it('names every part, kind and field in plain words', () => {
		const has = (group: string, name: string, parent?: string) =>
			(parent && `modes.${group}.${parent}.${name}` in en) || `modes.${group}.${name}` in en;
		const missing = new Set<string>();
		for (const kind of ['game-mode', 'special-rule'] as BuildKind[]) {
			for (const f of topFields(kind)) if (!has('field', f.name)) missing.add(`field ${f.name}`);
			for (const p of buildParts(kind)) {
				if (!has('part', p.part)) missing.add(`part ${p.part}`);
				for (const k of p.kinds) if (!has('kind', k.kind)) missing.add(`kind ${k.kind}`);
				for (const k of [undefined, ...p.kinds.map((x) => x.kind)])
					for (const f of partFields(p, k))
						if (!has('field', f.name, p.part)) missing.add(`field ${p.part}.${f.name}`);
			}
		}
		expect([...missing]).toEqual([]);
	});
});
