/**
 * How to write a game mode or special rule file (Trevor, 2026-10-18: instructions that cover every aspect of
 * the format, kept up to date at all times). The guide on New game's Add mode dialog is
 * drawn from this, and `format-guide.test.ts` fails when a part, field or kind the format
 * uses isn't described here, or when the format changes without `GAME_MODE_REVISION` going
 * up.
 */

export {
	GAME_MODE_REVISION,
	type GuideField,
	type GuideKind,
	type GuideSection
} from './guide-fields.ts';
export * from './mode-guide.ts';
export * from './rule-guide.ts';
