/**
 * A game's special rules changed on Character selection before it begins (Trevor, 2026-10-29:
 * "special rules implement into the character selection screen"; New game chose them until
 * then). The game keeps the rules beside it (game-mode-store.ts) and in its script's Bootlegger
 * lines (`scriptForRules`), as a game started with them does; the screen opens again on the
 * new rules, since what it shows (duplicates, hidden characters, required characters) follows
 * from them.
 */
import {
	inPlayFor,
	NO_RESTRICTIONS,
	scriptForRules,
	STANDARD,
	withRules,
	type SpecialRule
} from '#lib/core/modes/index.ts';
import { BOOTLEGGER, scriptRules } from '#lib/core/rules/script-rules.ts';
import type { SetupGamePort } from '#lib/features/setup/game-port.ts';
import { setupSelection } from '#lib/features/setup/selection.svelte.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { findMode } from './custom-modes.svelte.ts';
import { findRule } from './custom-rules.svelte.ts';
import { readGameMode, writeGameMode } from './game-mode-store.ts';
import { readExtras, writeExtras } from './mode-extras.ts';
import { saveDraft } from './new-game-draft.ts';
import { switched, type SwitchChoices } from './rule-switches.ts';

/** Bumped as a game's rules change, so Character selection opens again on them. */
export const gameRules = $state({ version: 0 });

/** The rules a game has, switched as the Storyteller set them. */
export function rulesOf(ids: readonly string[], choices: SwitchChoices): SpecialRule[] {
	return ids.flatMap((id) => findRule(id) ?? []).map((r) => switched(r, choices));
}

export async function applyGameRules(
	port: SetupGamePort,
	ids: readonly string[],
	choices: SwitchChoices
): Promise<void> {
	const game = port.game;
	if (!game) return;
	const gameId = game.gameId;
	const record = readGameMode(gameId) ?? {
		modeId: STANDARD.id,
		rules: [],
		restrictions: NO_RESTRICTIONS
	};
	const rules = rulesOf(ids, choices);
	if (JSON.stringify(rules) === JSON.stringify(record.rules)) return;
	const script = scriptForRules(game.script, record.rules, rules);
	if (JSON.stringify(script) !== JSON.stringify(game.script)) {
		if (!run(port, { type: 'ChangeScript', script })) return;
		// The Bootlegger carries the lines in play, as a game started with them has it
		// (startingRuleCharacters), and leaves with them unless the script lists it.
		const has = game.ruleCharacters.includes(BOOTLEGGER);
		const lines = scriptRules(script.meta).length > 0;
		const listed = script.entries.some((e) => e.kind === 'official' && e.id === BOOTLEGGER);
		if (lines && !has && !run(port, { type: 'AddRuleCharacter', characterId: BOOTLEGGER })) return;
		if (!lines && has && !listed)
			run(port, { type: 'RemoveRuleCharacter', characterId: BOOTLEGGER });
	}
	writeGameMode(gameId, { ...record, rules });
	const base = findMode(record.modeId) ?? STANDARD;
	const before = withRules(base, record.rules);
	const after = withRules(base, rules);
	setupSelection.open(gameId, game.seating.length);
	// What a new rule always has in play goes in once, as at Start game (seedInPlay).
	const had = inPlayFor(before);
	for (const id of inPlayFor(after))
		if (!had.includes(id) && setupSelection.copies(id) === 0) setupSelection.setCopies(id, 1);
	// Hidden characters leave with the rule that added them.
	if (
		before.parts.pool?.kind === 'script-plus-hidden' &&
		after.parts.pool?.kind !== 'script-plus-hidden'
	) {
		for (const id of readExtras(gameId) ?? []) setupSelection.setCopies(id, 0);
		writeExtras(gameId, []);
	}
	// Back to New game keeps them for the next game, as it keeps the script.
	saveDraft({ ruleIds: [...ids], switchChoices: { ...choices } });
	// The screen opens the saved game again, so the new script must be saved first.
	await port.flush();
	gameRules.version++;
}

function run(port: SetupGamePort, command: Parameters<SetupGamePort['dispatch']>[0]): boolean {
	const result = port.dispatch(command);
	if (!result.ok) reportError(new Error(result.error.message), { area: 'setup' });
	return result.ok;
}
