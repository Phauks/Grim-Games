/**
 * The game modes and special rules added on this device, as Library items (Trevor,
 * 2026-11-01: mode files in the Library beside scripts, characters and collections). They
 * stay in their own stores, which New game and Special rules read; the Library lists them
 * with folders and tags kept under `mode:<id>` and `rule:<id>`.
 */
import type { GameMode, SpecialRule } from '#lib/core/modes/index.ts';
import { foldForSearch } from '#lib/core/text/fold.ts';
import { customModes } from '#lib/features/modes/custom-modes.svelte.ts';
import { customRules } from '#lib/features/modes/custom-rules.svelte.ts';
import { modeFileText } from '#lib/features/modes/mode-share.ts';
import { modeKey, ruleKey, type LibraryItem } from './library-items.ts';

export interface ModeItem extends LibraryItem {
	kind: 'mode' | 'rule';
	/** One muted line under the name: its first author, as the file names them. */
	sub: string;
	mode: GameMode | SpecialRule;
}

function item(mode: GameMode | SpecialRule, kind: 'mode' | 'rule'): ModeItem {
	const aliases = 'aliases' in mode ? (mode.aliases ?? []) : [];
	return {
		key: kind === 'mode' ? modeKey(mode.id) : ruleKey(mode.id),
		kind,
		name: mode.name,
		haystack: foldForSearch([mode.name, ...aliases, mode.about ?? ''].join(' ')),
		sub: mode.authors?.[0]?.title ?? '',
		mode
	};
}

/** Every mode, then every rule, added on this device. */
export function modeItems(): ModeItem[] {
	return [
		...customModes.list.map((m) => item(m, 'mode')),
		...customRules.list.map((r) => item(r, 'rule'))
	];
}

/** The mode or rule behind a Library key, while it is still on this device. */
export function modeAt(key: string | undefined): GameMode | SpecialRule | undefined {
	return key ? modeItems().find((i) => i.key === key)?.mode : undefined;
}

/** The file Download saves: the mode file as Share and the Mode builder write it. */
export const modeJson = (mode: GameMode | SpecialRule): unknown => JSON.parse(modeFileText(mode));
