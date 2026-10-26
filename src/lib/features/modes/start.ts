import { toScript, type GameData, type LoadedScript, type Script } from '#lib/core/data/index.ts';
import {
	campaignRule,
	inPlayFor,
	modeScript,
	STANDARD,
	withRules,
	type GameMode,
	type JinxedPairs,
	type SpecialRule,
	type StorytellerRestrictions
} from '#lib/core/modes/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import { findMode } from './custom-modes.svelte.ts';
import { readGameMode, writeGameMode } from './game-mode-store.ts';
import { saveCampaign, type Campaign } from './campaigns.ts';
import { seedInPlay } from './in-play.ts';
import { saveTownGroup } from './town-groups.ts';

interface StartInput<G> {
	modeId: string;
	/** The special rules chosen on top of the mode. */
	rules: readonly SpecialRule[];
	restrictions: StorytellerRestrictions;
	data: GameData;
	loaded: LoadedScript;
	/** The Storyteller's Role Recycling choice for a draft mode. */
	roleRecycling?: boolean;
	/** The Storyteller's Jinxed pairs choice for a draft mode. */
	jinxedPairs?: JinxedPairs;
	/** The Storyteller's Ivory draft choice for a draft mode. */
	ivoryDraft?: boolean;
	/** Creates and saves the game with the mode's script. */
	create: (script: Script) => Promise<G>;
}

/**
 * A mode's script with the chosen rules: the combined pool's script, with each rule's own
 * lines added to the script's Bootlegger lines so they show where a script's rules do. New
 * game's preview shows the same script before the game starts.
 */
export function rulesScript(
	mode: GameMode,
	rules: readonly SpecialRule[],
	script: Script,
	scriptCharacters: LoadedScript['characters'],
	data: GameData,
	restrictions: StorytellerRestrictions
): Script {
	const out = modeScript(mode, script, scriptCharacters, data.characters, restrictions);
	const lines = rules.flatMap((rule) => rule.parts.text ?? []);
	if (!lines.length) return out;
	const meta = out.meta ?? { name: '' };
	return { ...out, meta: { ...meta, bootlegger: [...(meta.bootlegger ?? []), ...lines] } };
}

/**
 * Starts a game in a mode: the game is created with the mode's script (its pool, less banned
 * and restricted characters, plus those it always puts on the script), and the mode and its
 * special rules are kept beside the game on this device. A campaign mode (Flesh and Bone) also
 * starts its campaign, with this as its first game.
 */
export async function startInMode<
	G extends { game: { gameId: GameId; seating: readonly unknown[]; script: Script } }
>(input: StartInput<G>): Promise<G> {
	const base = findMode(input.modeId) ?? STANDARD;
	const mode = withRules(base, input.rules);
	const script = rulesScript(
		mode,
		input.rules,
		toScript(input.loaded),
		input.loaded.characters,
		input.data,
		input.restrictions
	);
	const open = await input.create(script);
	writeGameMode(open.game.gameId, {
		modeId: base.id,
		rules: [...input.rules],
		restrictions: input.restrictions,
		...(input.roleRecycling !== undefined ? { roleRecycling: input.roleRecycling } : {}),
		...(input.jinxedPairs !== undefined ? { jinxedPairs: input.jinxedPairs } : {}),
		...(input.ivoryDraft !== undefined ? { ivoryDraft: input.ivoryDraft } : {})
	});
	seedInPlay(open.game.gameId, open.game.seating.length, inPlayFor(mode));
	if (campaignRule(mode))
		saveCampaign({
			campaignId: crypto.randomUUID(),
			modeId: base.id,
			restrictions: input.restrictions,
			games: [{ gameId: open.game.gameId, eliminated: [], script: open.game.script }],
			createdAt: Date.now()
		});
	return open;
}

/**
 * Where a new game opens: the draft or choose screen for a mode that doesn't use the bag
 * (Sushi Buffet, Whale Buffet), the hidden characters for one that adds them (the rule A Script
 * of Infinite Possibilities), otherwise the board.
 */
export function startHref(
	modeId: string,
	rules: readonly SpecialRule[],
	gameId: GameId
): ResolvedPathname {
	const mode = withRules(findMode(modeId) ?? STANDARD, rules);
	const kind = mode.parts.assignment?.kind;
	if (kind === 'draft' || kind === 'choose-own')
		return resolve('/grimoire/[gameId]/deal', { gameId });
	if (mode.parts.pool?.kind === 'script-plus-hidden')
		return resolve('/grimoire/[gameId]/extras', { gameId });
	// Every other start goes on to Character selection, Standard too (Trevor, 2026-10-23).
	return resolve('/grimoire/[gameId]/setup', { gameId });
}

interface TownsInput<G> {
	modeId: string;
	rules: readonly SpecialRule[];
	restrictions: StorytellerRestrictions;
	data: GameData;
	/** One script per town. */
	scripts: LoadedScript[];
	/** Players per town. */
	sizes: number[];
	create: (script: Script, players: number) => Promise<G>;
}

/**
 * Starts a game of several towns: one saved game per town, tied together by a town group.
 * Returns the group's id.
 */
export async function startTowns<G extends { game: { gameId: GameId } }>(
	input: TownsInput<G>
): Promise<string> {
	const base = findMode(input.modeId) ?? STANDARD;
	const mode = withRules(base, input.rules);
	const gameIds: GameId[] = [];
	for (const [i, loaded] of input.scripts.entries()) {
		const script = rulesScript(
			mode,
			input.rules,
			toScript(loaded),
			loaded.characters,
			input.data,
			input.restrictions
		);
		const open = await input.create(script, input.sizes[i] ?? input.sizes[0]);
		writeGameMode(open.game.gameId, {
			modeId: base.id,
			rules: [...input.rules],
			restrictions: input.restrictions
		});
		gameIds.push(open.game.gameId);
	}
	const groupId = crypto.randomUUID();
	saveTownGroup({ groupId, modeId: base.id, gameIds, createdAt: Date.now() });
	return groupId;
}

interface ContinueInput<G> {
	campaign: Campaign;
	/** The saved version of the campaign's script to play with. */
	script: Script;
	/** The campaign's current game, whose player names carry over; absent if deleted. */
	latest?: { game: { seating: readonly string[]; seats: Record<string, { playerName?: string }> } };
	create: (script: Script) => Promise<G>;
}

/**
 * The next game of an ongoing campaign, started from New game with one of its saved script
 * versions (Trevor, 2026-10-18: "if an on-going campaign, prompt which script you want to
 * use"). Named as the campaign page names its next game; the same players carry over.
 */
export async function continueCampaign<
	G extends {
		game: { gameId: GameId; seating: readonly string[]; script: Script };
		run: (command: { type: 'RenameSeat'; seatId: string; playerName: string }) => unknown;
	}
>(input: ContinueInput<G>, name: (first: string, number: number) => string): Promise<G> {
	const { campaign } = input;
	const first = campaign.games[0]?.script?.meta?.name ?? input.script.meta?.name ?? '';
	const open = await input.create({
		...input.script,
		meta: { ...input.script.meta, name: name(first, campaign.games.length + 1) }
	});
	for (const [i, seatId] of (input.latest?.game.seating ?? []).entries()) {
		const playerName = input.latest?.game.seats[seatId]?.playerName;
		const to = open.game.seating[i];
		if (playerName && to) open.run({ type: 'RenameSeat', seatId: to, playerName });
	}
	writeGameMode(open.game.gameId, {
		modeId: campaign.modeId,
		// The rules carry over from the campaign's first game.
		rules: readGameMode(campaign.games[0]?.gameId ?? '')?.rules ?? [],
		restrictions: campaign.restrictions
	});
	saveCampaign({
		...campaign,
		games: [
			...campaign.games,
			{ gameId: open.game.gameId, eliminated: [], script: open.game.script }
		]
	});
	return open;
}

/**
 * The start-flow step before Character selection (Trevor, 2026-10-23: one start flow, Back
 * on every step): a mode's Extras where it hides characters, else New game.
 */
export function stepBeforeCharacters(gameId: GameId): 'extras' | 'new' {
	const record = readGameMode(gameId);
	if (!record) return 'new';
	const mode = withRules(findMode(record.modeId) ?? STANDARD, record.rules);
	return mode.parts.pool?.kind === 'script-plus-hidden' ? 'extras' : 'new';
}
