/**
 * Campaigns of a mode like Flesh and Bone, kept on this device: each game is an ordinary
 * saved game, and this record ties them together with the characters eliminated so far.
 * Versioned key; anything unreadable is dropped.
 */
import type { CharacterId, Script } from '#lib/core/data/index.ts';
import type { StorytellerRestrictions } from '#lib/core/modes/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

export interface CampaignGame {
	gameId: GameId;
	/** Eliminated after this game, once the next one starts. */
	eliminated: CharacterId[];
	/**
	 * This game's script, kept here so every version of the campaign's script stays in the
	 * Library after its game is deleted (Trevor, 2026-10-18). Added later: older records read
	 * the script from the saved game.
	 */
	script?: Script;
}

export interface Campaign {
	campaignId: string;
	modeId: string;
	restrictions: StorytellerRestrictions;
	/** In the order played; the last is the current game. */
	games: CampaignGame[];
	createdAt: number;
}

const KEY = 'grim-games:campaigns:v1';

const isIds = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((v) => typeof v === 'string');

function readAll(): Campaign[] {
	const raw = readStored(KEY);
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(c): c is Campaign =>
			typeof c === 'object' &&
			c !== null &&
			typeof c.campaignId === 'string' &&
			typeof c.modeId === 'string' &&
			typeof c.createdAt === 'number' &&
			isIds(c.restrictions?.banned) &&
			isIds(c.restrictions?.allowed) &&
			Array.isArray(c.games) &&
			c.games.every(
				(g: unknown) =>
					typeof g === 'object' &&
					g !== null &&
					typeof (g as CampaignGame).gameId === 'string' &&
					isIds((g as CampaignGame).eliminated) &&
					isScript((g as CampaignGame).script)
			)
	);
}

const isScript = (value: unknown): boolean =>
	value === undefined ||
	(typeof value === 'object' && value !== null && Array.isArray((value as Script).entries));

/** Every campaign on this device, newest first. */
export function campaigns(): Campaign[] {
	return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function saveCampaign(campaign: Campaign): void {
	// Storage blocked: each game is still a saved game of its own.
	const others = readAll().filter((c) => c.campaignId !== campaign.campaignId);
	writeStored(KEY, [...others, campaign]);
}

export function campaign(campaignId: string): Campaign | undefined {
	return readAll().find((c) => c.campaignId === campaignId);
}

/** The campaign a game is part of, for a link back from its board. */
export function campaignOf(gameId: GameId): Campaign | undefined {
	return readAll().find((c) => c.games.some((g) => g.gameId === gameId));
}

/** Every character eliminated in the campaign so far. */
export function eliminatedSoFar(c: Campaign): CharacterId[] {
	return c.games.flatMap((g) => g.eliminated);
}
