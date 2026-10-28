/**
 * How to write a game mode file (Trevor, 2026-10-18: instructions that cover every aspect of
 * the format, kept up to date at all times). The guide on New game's Add mode dialog is
 * drawn from this, and `format-guide.test.ts` fails when a part, field or kind the format
 * uses isn't described here, or when the format changes without `GAME_MODE_REVISION` going
 * up.
 */
import { MODE_PARTS, RULE_PARTS } from './types.ts';
import { CITE, INSTRUCTIONS } from './guide-fields.ts';
import { GUIDE_PARTS, GUIDE_TOP } from './mode-guide.ts';
import { RULE_GUIDE_PARTS, RULE_GUIDE_TOP } from './rule-guide.ts';

export {
	GAME_MODE_REVISION,
	type GuideField,
	type GuideKind,
	type GuidePart
} from './guide-fields.ts';
export * from './mode-guide.ts';
export * from './rule-guide.ts';

/** Every field name the guide describes, at any depth: for the test that keeps it current. */
export function documentedFields(): Set<string> {
	const names = new Set<string>(['kind', 'cite', 'title', 'url', 'characterId', 'type']);
	for (const f of [...GUIDE_TOP, ...RULE_GUIDE_TOP]) names.add(f.name);
	for (const part of RULE_PARTS) names.add(part);
	for (const part of MODE_PARTS) names.add(part);
	for (const extra of ['modes', 'rules']) names.add(extra);
	for (const p of [...GUIDE_PARTS, ...RULE_GUIDE_PARTS]) {
		for (const f of [...p.fields, CITE, INSTRUCTIONS]) names.add(f.name);
		for (const k of p.kinds) for (const f of k.fields) names.add(f.name);
	}
	for (const extra of ['afterDay', 'together', 'winner', 'min', 'max']) names.add(extra);
	return names;
}

/** The guide's shape, as one line: the test pins it to `GAME_MODE_REVISION`. */
export function guideFingerprint(): string {
	return [...GUIDE_PARTS, ...RULE_GUIDE_PARTS]
		.map(
			(p) =>
				`${p.part}:${p.fields.map((f) => f.name).join(',')}|${p.kinds
					.map((k) => `${k.kind}(${k.fields.map((f) => f.name).join(',')})`)
					.join(',')}`
		)
		.join(';');
}
