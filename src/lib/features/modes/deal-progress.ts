/**
 * A draft or choose-your-own in progress, kept on this device per game so passing the
 * device round the table survives a reload. Versioned key; anything unreadable starts over.
 */
import { readStored, writeStored } from '#lib/ui/stored.ts';
import type { CharacterId } from '#lib/core/data/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import type { Character } from '#lib/core/data/index.ts';
import {
	dealTypes,
	draftedTurned,
	pickableCharacters,
	reservedHidden,
	startDraft,
	type DraftState,
	type GameMode
} from '#lib/core/modes/index.ts';
import type { SeatedType } from '#lib/core/data/types.ts';
import { isReplacedAfterDraw } from '#lib/core/rules/setup/bag-characters.ts';
import type { TypeCounts } from '#lib/core/rules/setup/distribution.ts';
import type { GameModeRecord } from './game-mode-store.ts';

/**
 * `drawn` is the bag tiles taken, in seat order (1-based places on the shared bag);
 * `held` is the tile the next seat has drawn and not chosen from yet. Both were added after
 * the first saves, which read as the first tiles drawn in order.
 */
export type DealProgress = (
	| { kind: 'draft'; state: DraftState }
	| { kind: 'choose'; types: SeatedType[]; picks: CharacterId[] }
) & { drawn?: number[]; held?: number };

const KEY = (gameId: GameId) => `grim-games:mode-deal:v1:${gameId}`;

export function readDeal(gameId: GameId): DealProgress | undefined {
	const raw = readStored(KEY(gameId));
	if (!raw || typeof raw !== 'object') return undefined;
	const r = raw as Partial<DealProgress>;
	if (r.kind === 'draft' && r.state && Array.isArray(r.state.picks)) return r as DealProgress;
	if (r.kind === 'choose' && Array.isArray(r.types) && Array.isArray(r.picks))
		return r as DealProgress;
	return undefined;
}

export function writeDeal(gameId: GameId, progress: DealProgress | undefined): void {
	// Storage blocked: the deal still works for this visit.
	writeStored(KEY(gameId), progress);
}

/**
 * A deal from the start: a draft with the New game settings (`record`), or the types dealt for
 * players to choose from; none for a mode that does neither.
 */
export function freshDeal(
	mode: GameMode,
	record: GameModeRecord | undefined,
	characters: readonly Character[],
	counts: TypeCounts,
	jinxes: Parameters<typeof startDraft>[4]
): DealProgress | undefined {
	const assignment = mode.setup.assignment;
	if (assignment?.kind === 'draft') {
		const modifiers = mode.setup.setupModifiers?.kind === 'as-chosen';
		return {
			kind: 'draft',
			state: startDraft(
				{
					...assignment,
					recycleUnchosen: record?.roleRecycling ?? assignment.recycleUnchosen,
					oneTypePerOffer: record?.oneTypePerOffer ?? assignment.oneTypePerOffer,
					dealsRequired: record?.dealsRequired ?? true,
					modifiers,
					jinxes: record?.jinxedPairs ?? 'allow',
					ivory: record?.ivoryDraft ?? false,
					hidden: characters.filter(isReplacedAfterDraw).map((c) => c.id),
					...(record?.marionette ? { reserve: reservedHidden(characters)[0] } : {})
				},
				counts,
				// Lil' Monsta is never dealt, but drafted it turns its player into a Minion.
				modifiers
					? [...pickableCharacters(mode, characters), ...draftedTurned(characters)]
					: pickableCharacters(mode, characters),
				Math.random,
				jinxes
			)
		};
	}
	if (assignment?.kind === 'choose-own')
		return { kind: 'choose', types: dealTypes(counts, Math.random), picks: [] };
	return undefined;
}
