/**
 * A draft's counts (Sushi Buffet, `draft.ts`): how many of each type the game has, the totals a
 * drafted character's setup change can give with the seats left, and applying one.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import { SEATED_TYPES, type SeatedType } from '#lib/core/data/types.ts';
import { type CountOp } from '#lib/core/data/parts/setup-modifier.ts';
import type { DraftState, PendingChange } from './draft.ts';

/** Seats still to draft. */
export function seatsLeft(state: DraftState): number {
	return SEATED_TYPES.reduce((n, type) => n + Math.max(0, state.slots[type]), 0);
}

/** How many of `type` have been drafted. */
export const drafted = (state: DraftState, type: SeatedType) =>
	state.picks.filter((id) => state.types[id] === type).length;

/** How many of `type` the game has in all: drafted plus still open. */
export const draftTotal = (state: DraftState, type: SeatedType) =>
	drafted(state, type) + Math.max(0, state.slots[type]);

/** The type a change to `type` is balanced against: Townsfolk, or Outsiders for Townsfolk. */
const balance = (type: SeatedType): SeatedType => (type === 'townsfolk' ? 'outsider' : 'townsfolk');

/** The totals `type` can reach: never below what is drafted, never past the open balance seats. */
export function range(state: DraftState, type: SeatedType): [number, number] {
	const total = draftTotal(state, type);
	return [drafted(state, type), total + Math.max(0, state.slots[balance(type)])];
}

const clamp = (state: DraftState, type: SeatedType, total: number) => {
	const [min, max] = range(state, type);
	return Math.min(max, Math.max(min, total));
};

/** The state with `type`'s total at `total` (clamped), the difference taken from its balance. */
export function setTotal(state: DraftState, type: SeatedType, total: number): DraftState {
	const diff = clamp(state, type, total) - draftTotal(state, type);
	if (diff === 0) return state;
	const other = balance(type);
	return {
		...state,
		slots: { ...state.slots, [type]: state.slots[type] + diff, [other]: state.slots[other] - diff }
	};
}

/** The totals a change can give, lowest first. */
export function totalsFor(state: DraftState, op: CountOp): number[] {
	const [min, max] = range(state, op.type);
	const current = draftTotal(state, op.type);
	const wanted = wantedTotals(state, op);
	const reachable = wanted?.filter((v) => v >= min && v <= max);
	const totals =
		wanted === undefined
			? Array.from({ length: max - min + 1 }, (_, i) => min + i)
			: reachable && reachable.length > 0 && (op.kind === 'set' || op.kind === 'delta')
				? reachable
				: wanted.map((v) => clamp(state, op.type, v));
	return [...new Set(totals.length > 0 ? totals : [current])].sort((a, b) => a - b);
}

/**
 * The totals a change asks for, before the seats left limit them; undefined for "any number".
 * "Most" is more than half the players, leaving at least one other
 * (https://wiki.bloodontheclocktower.com/Legion: "roughly seven Legion and three good players").
 */
export function wantedTotals(state: DraftState, op: CountOp): number[] | undefined {
	if (op.kind === 'any') return undefined;
	if (op.kind === 'set' && op.values === 'most') {
		const players = state.picks.length + seatsLeft(state);
		const low = Math.floor(players / 2) + 1;
		return Array.from({ length: Math.max(0, players - low) }, (_, i) => low + i);
	}
	if (op.kind === 'set') return [...(op.values as readonly number[])];
	const current = draftTotal(state, op.type);
	return op.values.map((v) => current + v);
}

/** Whether the seats left let a change give a total it asks for. */
export function fits(state: DraftState, op: CountOp): boolean {
	const wanted = wantedTotals(state, op);
	if (wanted === undefined) return true;
	const [min, max] = range(state, op.type);
	return wanted.some((v) => v >= min && v <= max);
}

/** A character's changes with the fixed counts first (Legion's no Minions before its Demons). */
export function fixedFirst(ops: readonly CountOp[]): CountOp[] {
	const fixed = (op: CountOp) => op.kind === 'set' && op.values !== 'most';
	return [...ops.filter(fixed), ...ops.filter((op) => !fixed(op))];
}

/**
 * Whether drafting `id` now lets each of its setup changes give a total it asks for, as the
 * draft would apply them in turn (a Summoner's "No Demon" can't once a Demon is drafted).
 */
export function canApply(state: DraftState, id: CharacterId): boolean {
	const ops = state.modifiers?.[id];
	if (!ops?.length || state.orHidden?.[id]) return true;
	const type = state.types[id];
	let s: DraftState = {
		...state,
		picks: [...state.picks, id],
		slots: { ...state.slots, [type]: state.slots[type] - 1 }
	};
	for (const op of ops) {
		if (!fits(s, op)) return false;
		const options = totalsFor(s, op);
		if (op.kind !== 'any') s = setTotal(s, op.type, options.at(-1) ?? draftTotal(s, op.type));
	}
	return true;
}

/**
 * Sets `type`'s total for `change`, then what follows from it: copies of a character that is
 * most players fill its type's seats (Legion), the seats kept for a line are counted (the Lord of
 * Typhon's), and a reserved hidden character's seat (the Marionette's) is dropped when its type
 * has none, or given back when there is no one for it to sit beside.
 */
export function applyTotal(
	state: DraftState,
	change: PendingChange | undefined,
	type: SeatedType,
	total: number
): DraftState {
	const line = change?.line ? draftTotal(state, type) : 0;
	let next = setTotal(state, type, total);
	if (!change) return next;
	if (change.line) next = { ...next, line: Math.max(0, line - draftTotal(next, type)) };
	const { op, characterId } = change;
	if (
		op.kind === 'set' &&
		op.values === 'most' &&
		op.type === next.types[characterId] &&
		next.repeats?.includes(characterId)
	)
		next = { ...next, copies: { ...next.copies, [op.type]: characterId } };
	return unreserve(next, change);
}

function unreserve(state: DraftState, { characterId, op }: PendingChange): DraftState {
	const reserve = state.config.reserve;
	if (!state.reserved || !reserve) return state;
	const kept = 1 + (state.reservedExtra ?? 0);
	const drop = (s: DraftState) => {
		const out = { ...s };
		delete out.reserved;
		delete out.reservedExtra;
		return out;
	};
	// None of its type (Legion, the Atheist), unless the character turns players into it (Kazali).
	if (
		op.type === reserve.type &&
		draftTotal(state, reserve.type) === 0 &&
		state.turns?.[characterId]?.type !== reserve.type
	)
		return drop(state);
	// No one of the type it sits beside (the Summoner, Lil' Monsta): its seats go back to its type.
	if (op.type === reserve.nextTo && draftTotal(state, reserve.nextTo) === 0) {
		const back = Math.min(kept, Math.max(0, state.slots.townsfolk));
		return drop({
			...state,
			slots: {
				...state.slots,
				townsfolk: state.slots.townsfolk - back,
				[reserve.type]: state.slots[reserve.type] + back
			}
		});
	}
	return state;
}
