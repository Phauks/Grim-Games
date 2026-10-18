/**
 * A draft or choose-your-own in progress, kept on this device per game so passing the
 * device round the table survives a reload. Versioned key; anything unreadable starts over.
 */
import { readStored, writeStored } from '#lib/ui/stored.ts';
import type { CharacterId } from '#lib/core/data/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import type { DraftState } from '#lib/core/modes/index.ts';
import type { SeatedType } from '#lib/core/rules/distribution.ts';

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
