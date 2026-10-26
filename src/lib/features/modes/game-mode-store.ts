/**
 * The game mode a game was started in, its special rules and the Storyteller's own
 * restrictions, kept on this device beside the game (like seat layouts, device-notes.ts) so
 * the game's event log and its saved format don't change. The key carries a version; anything
 * unreadable reads as a standard game.
 *
 * v2 (2026-10-18) adds the special rules, each kept whole so a custom rule deleted later still
 * plays in the game that used it. A v1 game saved in a mode that became a rule (Specters, A
 * Script of Infinite Possibilities) reads as Standard with that rule.
 */
import type { GameId } from '#lib/core/model/index.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import {
	parseSpecialRule,
	JINXED_PAIRS,
	specialRuleById,
	upgradeModeChoice,
	type JinxedPairs,
	type SpecialRule,
	type StorytellerRestrictions
} from '#lib/core/modes/index.ts';

export interface GameModeRecord {
	modeId: string;
	/** The special rules on top of the mode, in the order chosen. */
	rules: SpecialRule[];
	restrictions: StorytellerRestrictions;
	/** Role Recycling for a draft (Sushi Buffet): unchosen characters go back in the pool. The
	 * Storyteller's choice on New game; left out, the mode's own setting. */
	roleRecycling?: boolean;
	/** Jinxed pairs for a draft: blocked, less likely or allowed. Left out, allowed. */
	jinxedPairs?: JinxedPairs;
}

const KEY = (gameId: GameId) => `grim-games:game-mode:v2:${gameId}`;
const V1_KEY = (gameId: GameId) => `grim-games:game-mode:v1:${gameId}`;

const ids = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

function restrictionsOf(value: unknown): StorytellerRestrictions {
	const r = (value ?? {}) as Partial<StorytellerRestrictions>;
	return { banned: ids(r.banned), allowed: ids(r.allowed) };
}

const recycling = (r: { roleRecycling?: unknown; jinxedPairs?: unknown }) => ({
	...(typeof r.roleRecycling === 'boolean' ? { roleRecycling: r.roleRecycling } : {}),
	...((JINXED_PAIRS as readonly unknown[]).includes(r.jinxedPairs)
		? { jinxedPairs: r.jinxedPairs as JinxedPairs }
		: {})
});

export function readGameMode(gameId: GameId): GameModeRecord | undefined {
	const raw = readStored(KEY(gameId));
	if (raw && typeof raw === 'object') {
		const r = raw as Record<string, unknown>;
		if (typeof r.modeId !== 'string') return undefined;
		const rules = Array.isArray(r.rules)
			? r.rules.flatMap((rule) => {
					const parsed = parseSpecialRule(rule);
					return parsed.ok ? [parsed.rule] : [];
				})
			: [];
		return {
			modeId: r.modeId,
			rules,
			restrictions: restrictionsOf(r.restrictions),
			...recycling(r)
		};
	}
	return readV1(gameId);
}

/** A game saved before special rules: a mode that became a rule is Standard with it. */
function readV1(gameId: GameId): GameModeRecord | undefined {
	const raw = readStored(V1_KEY(gameId));
	if (!raw || typeof raw !== 'object') return undefined;
	const r = raw as Record<string, unknown>;
	if (typeof r.modeId !== 'string') return undefined;
	const choice = upgradeModeChoice(r.modeId);
	return {
		modeId: choice.modeId,
		rules: choice.ruleIds.flatMap((id) => specialRuleById(id) ?? []),
		restrictions: restrictionsOf(r.restrictions),
		...recycling(r)
	};
}

export function writeGameMode(gameId: GameId, record: GameModeRecord): void {
	// Storage full or blocked: the game itself is saved; only the mode label is lost.
	writeStored(KEY(gameId), record);
}
