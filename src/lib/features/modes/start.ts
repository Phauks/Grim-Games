import { toScript, type GameData, type LoadedScript, type Script } from '#lib/core/data/index.ts';
import {
	campaignRule,
	inPlayFor,
	modeScript,
	STANDARD,
	type StorytellerRestrictions
} from '#lib/core/modes/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import { findMode } from './custom-modes.svelte.ts';
import { writeGameMode } from './game-mode-store.ts';
import { saveCampaign, type Campaign } from './campaigns.ts';
import { seedInPlay } from './in-play.ts';
import { saveTownGroup } from './town-groups.ts';

interface StartInput<G> {
	modeId: string;
	restrictions: StorytellerRestrictions;
	data: GameData;
	loaded: LoadedScript;
	/** The Storyteller's Role Recycling choice for a draft mode. */
	roleRecycling?: boolean;
	/** Creates and saves the game with the mode's script. */
	create: (script: Script) => Promise<G>;
}

/**
 * Starts a game in a mode: the game is created with the mode's script (its pool, less banned
 * and restricted characters, plus those it always puts on the script), and the mode is kept
 * beside the game on this device. A campaign mode (Flesh and Bone) also starts its campaign,
 * with this as its first game.
 */
export async function startInMode<
	G extends { game: { gameId: GameId; seating: readonly unknown[]; script: Script } }
>(input: StartInput<G>): Promise<G> {
	const mode = findMode(input.modeId) ?? STANDARD;
	const script = modeScript(
		mode,
		toScript(input.loaded),
		input.loaded.characters,
		input.data.characters,
		input.restrictions
	);
	const open = await input.create(script);
	writeGameMode(open.game.gameId, {
		modeId: mode.id,
		restrictions: input.restrictions,
		...(input.roleRecycling !== undefined ? { roleRecycling: input.roleRecycling } : {})
	});
	seedInPlay(open.game.gameId, open.game.seating.length, inPlayFor(mode));
	if (campaignRule(mode))
		saveCampaign({
			campaignId: crypto.randomUUID(),
			modeId: mode.id,
			restrictions: input.restrictions,
			games: [{ gameId: open.game.gameId, eliminated: [], script: open.game.script }],
			createdAt: Date.now()
		});
	return open;
}

/**
 * Where a new game opens: the draft or choose screen for a mode that doesn't use the bag
 * (Sushi Buffet, Whale Buffet), the hidden characters for one that adds them (A Script of
 * Infinite Possibilities), otherwise the board.
 */
export function startHref(modeId: string, gameId: GameId): ResolvedPathname {
	const mode = findMode(modeId) ?? STANDARD;
	const kind = mode.parts.assignment?.kind;
	if (kind === 'draft' || kind === 'choose-own')
		return resolve('/grimoire/[gameId]/deal', { gameId });
	if (mode.parts.pool?.kind === 'script-plus-hidden')
		return resolve('/grimoire/[gameId]/extras', { gameId });
	return resolve('/grimoire/[gameId]', { gameId });
}

interface TownsInput<G> {
	modeId: string;
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
	const mode = findMode(input.modeId) ?? STANDARD;
	const gameIds: GameId[] = [];
	for (const [i, loaded] of input.scripts.entries()) {
		const script = modeScript(
			mode,
			toScript(loaded),
			loaded.characters,
			input.data.characters,
			input.restrictions
		);
		const open = await input.create(script, input.sizes[i] ?? input.sizes[0]);
		writeGameMode(open.game.gameId, { modeId: mode.id, restrictions: input.restrictions });
		gameIds.push(open.game.gameId);
	}
	const groupId = crypto.randomUUID();
	saveTownGroup({ groupId, modeId: mode.id, gameIds, createdAt: Date.now() });
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
	writeGameMode(open.game.gameId, { modeId: campaign.modeId, restrictions: campaign.restrictions });
	saveCampaign({
		...campaign,
		games: [
			...campaign.games,
			{ gameId: open.game.gameId, eliminated: [], script: open.game.script }
		]
	});
	return open;
}
