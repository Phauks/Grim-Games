/**
 * A draft (assignment kind `draft`, Sushi Buffet): seat by seat, the player is offered a few
 * characters from the pool and keeps one. Refusing an offer brings the next, smaller one
 * (3 → 2 → 1); the last offer can't be refused. Characters not kept are discarded, or go
 * back in the pool when `recycleUnchosen` is set. Only types with an open slot are offered,
 * so every pick fits the setup counts. Rules: https://grimbits.com/draft-buffet/.
 *
 * Setup modifiers apply as each is drafted (setupModifiers `as-chosen`): a single change
 * ("+2 Outsiders") moves slots between Townsfolk and that type at once; any other ("+1 or
 * −1", "[No Demon]") is listed in `decisions` for the Storyteller, who sets the slots with
 * `setSlots` (the Storyteller can override anything).
 *
 * The state is plain data so it can be saved on the device and resumed.
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import { SEATED_TYPES, type SeatedType, type TypeCounts } from '#lib/core/rules/distribution.ts';
import { setupModifierFor } from '#lib/core/rules/setup-modifiers.ts';

export interface DraftConfig {
	offers: number[];
	recycleUnchosen: boolean;
	oneTypePerOffer: boolean;
}

export interface DraftState {
	config: DraftConfig;
	/** Slots still open, by type. */
	slots: TypeCounts;
	/** Characters that can still be offered, in pool order. */
	pool: CharacterId[];
	types: Record<CharacterId, SeatedType>;
	discarded: CharacterId[];
	/** Kept characters in seat order. */
	picks: CharacterId[];
	/** The current offer; empty once the draft is done. */
	offer: CharacterId[];
	/** Which of `config.offers` the current offer is. */
	offerIndex: number;
	/** Drafted setup modifiers the Storyteller applies by hand. */
	decisions: CharacterId[];
}

type Random = () => number;

const isSeated = (type: string): type is SeatedType =>
	(SEATED_TYPES as readonly string[]).includes(type);

export function startDraft(
	config: DraftConfig,
	counts: TypeCounts,
	pool: readonly Character[],
	random: Random
): DraftState {
	const seated = pool.filter((c) => isSeated(c.type));
	const state: DraftState = {
		config,
		slots: { ...counts },
		pool: seated.map((c) => c.id),
		types: Object.fromEntries(seated.map((c) => [c.id, c.type as SeatedType])),
		discarded: [],
		picks: [],
		offer: [],
		offerIndex: 0,
		decisions: []
	};
	return withOffer(state, config.offers[0] ?? 1, random);
}

/** Seats still to draft. */
export function seatsLeft(state: DraftState): number {
	return SEATED_TYPES.reduce((n, type) => n + Math.max(0, state.slots[type]), 0);
}

export function canRefuse(state: DraftState): boolean {
	return state.offer.length > 0 && state.offerIndex < state.config.offers.length - 1;
}

/** The player refuses the offer and gets the next, smaller one. */
export function refuseOffer(state: DraftState, random: Random): DraftState {
	if (!canRefuse(state)) return state;
	const next = setAside(state, state.offer);
	const offerIndex = state.offerIndex + 1;
	const after = { ...next, offerIndex };
	return withOffer(after, state.config.offers[offerIndex], random);
}

/** The player keeps `id` from the offer; the next seat gets a fresh offer. */
export function takeOffer(
	state: DraftState,
	id: CharacterId,
	characters: ReadonlyMap<CharacterId, Character>,
	random: Random
): DraftState {
	if (!state.offer.includes(id)) return state;
	const type = state.types[id];
	let next = setAside(
		state,
		state.offer.filter((x) => x !== id)
	);
	next = {
		...next,
		pool: next.pool.filter((x) => x !== id),
		picks: [...state.picks, id],
		slots: { ...next.slots, [type]: next.slots[type] - 1 },
		offerIndex: 0
	};
	next = applyModifier(next, id, characters);
	return withOffer(next, state.config.offers[0] ?? 1, random);
}

/** The Storyteller sets the open slots; a fresh offer follows if the current one no longer fits. */
export function setSlots(state: DraftState, slots: TypeCounts, random: Random): DraftState {
	const next = { ...state, slots: { ...slots } };
	const fits = state.offer.every((id) => next.slots[state.types[id]] > 0);
	return fits && state.offer.length > 0
		? next
		: withOffer(next, state.config.offers[state.offerIndex] ?? 1, random);
}

function setAside(state: DraftState, ids: readonly CharacterId[]): DraftState {
	if (state.config.recycleUnchosen) return state;
	const gone = new Set(ids);
	return {
		...state,
		pool: state.pool.filter((x) => !gone.has(x)),
		discarded: [...state.discarded, ...ids]
	};
}

function applyModifier(
	state: DraftState,
	id: CharacterId,
	characters: ReadonlyMap<CharacterId, Character>
): DraftState {
	const character = characters.get(id);
	const modifier = character ? setupModifierFor(character) : undefined;
	if (!modifier || modifier.ops.length === 0) return state;
	const [op] = modifier.ops;
	const single =
		modifier.ops.length === 1 &&
		op.kind === 'delta' &&
		op.values.length === 1 &&
		op.type !== 'townsfolk' &&
		state.slots.townsfolk >= op.values[0] &&
		state.slots[op.type] + op.values[0] >= 0;
	if (single && op.kind === 'delta') {
		const n = op.values[0];
		return {
			...state,
			slots: {
				...state.slots,
				[op.type]: state.slots[op.type] + n,
				townsfolk: state.slots.townsfolk - n
			}
		};
	}
	return { ...state, decisions: [...state.decisions, id] };
}

/** Up to `size` characters from the pool whose type has an open slot. */
/**
 * The state with a fresh offer of up to `size`. When discards have used up every character
 * of a type that still has open slots, those discards go back in the pool first, so the
 * draft can always finish (our fallback; the source doesn't say, and recommends recycling
 * for small scripts).
 */
function withOffer(state: DraftState, size: number, random: Random): DraftState {
	const open = (s: DraftState) => s.pool.some((id) => s.slots[s.types[id]] > 0);
	let next = state;
	if (!open(next) && seatsLeft(next) > 0) {
		const back = next.discarded.filter((id) => next.slots[next.types[id]] > 0);
		next = {
			...next,
			pool: [...next.pool, ...back],
			discarded: next.discarded.filter((id) => !back.includes(id))
		};
	}
	return { ...next, offer: makeOffer(next, size, random) };
}

function makeOffer(state: DraftState, size: number, random: Random): CharacterId[] {
	let candidates = state.pool.filter((id) => state.slots[state.types[id]] > 0);
	if (state.config.oneTypePerOffer && candidates.length > 0) {
		// A type with open slots, weighted by how many are open.
		const open = SEATED_TYPES.filter(
			(t) => state.slots[t] > 0 && candidates.some((id) => state.types[id] === t)
		);
		const total = open.reduce((n, t) => n + state.slots[t], 0);
		let roll = random() * total;
		const type = open.find((t) => (roll -= state.slots[t]) < 0) ?? open[open.length - 1];
		candidates = candidates.filter((id) => state.types[id] === type);
	}
	const picked: CharacterId[] = [];
	const left = [...candidates];
	while (picked.length < size && left.length > 0) {
		picked.push(left.splice(Math.floor(random() * left.length), 1)[0]);
	}
	return picked;
}
