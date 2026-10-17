/**
 * A draft or choose-your-own in progress, kept on this device per game so passing the
 * device round the table survives a reload. Versioned key; anything unreadable starts over.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import type { DraftState } from '#lib/core/modes/index.ts';
import type { SeatedType } from '#lib/core/rules/distribution.ts';

export type DealProgress =
	| { kind: 'draft'; state: DraftState }
	| { kind: 'choose'; types: SeatedType[]; picks: CharacterId[] };

const KEY = (gameId: GameId) => `grim-games:mode-deal:v1:${gameId}`;

export function readDeal(gameId: GameId): DealProgress | undefined {
	try {
		const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(KEY(gameId)) ?? 'null');
		if (!raw || typeof raw !== 'object') return undefined;
		const r = raw as Partial<DealProgress>;
		if (r.kind === 'draft' && r.state && Array.isArray(r.state.picks)) return r as DealProgress;
		if (r.kind === 'choose' && Array.isArray(r.types) && Array.isArray(r.picks))
			return r as DealProgress;
		return undefined;
	} catch {
		return undefined;
	}
}

export function writeDeal(gameId: GameId, progress: DealProgress | undefined): void {
	try {
		if (progress) globalThis.localStorage?.setItem(KEY(gameId), JSON.stringify(progress));
		else globalThis.localStorage?.removeItem(KEY(gameId));
	} catch {
		// Storage blocked: the deal still works for this visit.
	}
}
