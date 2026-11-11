/**
 * How to write a game mode or special rule file (Trevor, 2026-10-18: instructions that cover every aspect of
 * the format, kept up to date at all times). The guide on New game's Add mode dialog is
 * drawn from this, and `format-guide.test.ts` fails when a part, field or kind the format
 * uses isn't described here, or when the format changes without `GAME_MODE_REVISION` going
 * up.
 */
import type { FieldSpec } from '#lib/core/data/field-spec.ts';
import { FILE_SECTIONS } from './types.ts';
import { SETUP_SPECS } from './setup-spec.ts';
import { GUIDE_SECTIONS, GUIDE_TOP } from './mode-guide.ts';
import { RULE_GUIDE_SECTIONS } from './rule-guide.ts';

export {
	GAME_MODE_REVISION,
	type GuideField,
	type GuideKind,
	type GuideSection
} from './guide-fields.ts';
export * from './mode-guide.ts';
export * from './rule-guide.ts';

/** Every field name the guide describes, at any depth: for the test that keeps it current. */
export function documentedFields(): Set<string> {
	const names = new Set<string>(['title', 'url', 'modes', 'rules', ...FILE_SECTIONS]);
	for (const f of GUIDE_TOP) names.add(f.name);
	const walk = (spec: FieldSpec) => {
		if (spec.kind === 'object')
			for (const f of spec.fields) {
				names.add(f.key);
				walk(f.spec);
			}
		else if (spec.kind === 'list') walk(spec.of);
		else if (spec.kind === 'variants') for (const v of spec.variants) walk(v.spec);
	};
	for (const spec of Object.values(SETUP_SPECS)) walk(spec);
	return names;
}

/** The guide's shape, as one line: the test pins it to `GAME_MODE_REVISION`. */
export function guideFingerprint(): string {
	return [...GUIDE_SECTIONS, ...RULE_GUIDE_SECTIONS]
		.map(
			(p) =>
				`${p.part}:${p.fields.map((f) => f.name).join(',')}|${p.kinds
					.map((k) => `${k.kind}(${k.fields.map((f) => f.name).join(',')})`)
					.join(',')}`
		)
		.join(';');
}
