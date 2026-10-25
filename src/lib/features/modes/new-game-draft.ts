import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import type { Game, GameId } from '#lib/core/model/index.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { forgetGame } from '#lib/features/grimoire/forget-game.ts';

/**
 * What New game was set to when Start game was pressed, so Back from the start flow's next
 * step brings New game back as it was (Trevor, 2026-10-23: "back buttons so users can always
 * go back to those previous menus"). Device-only; overwritten by the next Start.
 */
export interface NewGameDraft {
	/** The game Start made, dropped when Back returns to New game before it begins. */
	gameId?: GameId;
	/** Standard's script choice and player count (NewGame.svelte). */
	edition?: string;
	players?: number;
	/** The mode and its rules (GameModesPanel.svelte). */
	modeId?: string;
	ruleIds?: string[];
	switchChoices?: Record<string, boolean>;
	banned?: string[];
	allowed?: string[];
	modePlayers?: number;
	modeScript?: string;
}

const KEY = 'grim-games:new-game-draft:v1';
/** The hash New game reads to put the draft back. */
export const BACK_HASH = '#back';

const strings = (v: unknown) =>
	Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;
const number = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const text = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** The last draft, read leniently: anything unreadable is left out. */
export function readDraft(): NewGameDraft {
	const raw = readStored(KEY);
	if (!raw || typeof raw !== 'object') return {};
	const r = raw as Record<string, unknown>;
	const switches =
		r.switchChoices && typeof r.switchChoices === 'object'
			? Object.fromEntries(
					Object.entries(r.switchChoices as Record<string, unknown>).filter(
						(e): e is [string, boolean] => typeof e[1] === 'boolean'
					)
				)
			: undefined;
	const draft: NewGameDraft = {
		gameId: text(r.gameId) as GameId | undefined,
		edition: text(r.edition),
		players: number(r.players),
		modeId: text(r.modeId),
		ruleIds: strings(r.ruleIds),
		switchChoices: switches,
		banned: strings(r.banned),
		allowed: strings(r.allowed),
		modePlayers: number(r.modePlayers),
		modeScript: text(r.modeScript)
	};
	return Object.fromEntries(
		Object.entries(draft).filter(([, v]) => v !== undefined)
	) as NewGameDraft;
}

/** Adds to the draft; `fresh` starts a new one (the Start press). */
export function saveDraft(part: NewGameDraft, fresh = false): void {
	writeStored(KEY, { ...(fresh ? {} : readDraft()), ...part });
}

/** True when New game was opened by Back, so it should put the draft back. */
export function openedByBack(): boolean {
	return typeof location !== 'undefined' && location.hash === BACK_HASH;
}

/**
 * Nothing of the game has happened yet: no character on a seat and no tile drawn. Back then
 * returns to the step before rather than to the board.
 */
export function notBegun(game: Game): boolean {
	return (
		Object.values(game.seats).every((s) => !s.characterId) &&
		Object.values(game.bag?.tiles ?? {}).every((t) => !t.drawnBySeat && !t.confirmed)
	);
}

/** Back to New game as it was: the unstarted game Start made is dropped, so none piles up. */
export async function backToNewGame(gameId: GameId): Promise<void> {
	if (readDraft().gameId === gameId) await forgetGame(gameId);
	await goto(`${resolve('/new')}${BACK_HASH}` as ResolvedPathname);
}
