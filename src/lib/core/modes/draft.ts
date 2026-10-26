/**
 * A draft (assignment kind `draft`, Sushi Buffet): seat by seat, the player is offered a few
 * characters from the pool and keeps one. Refusing an offer brings the next, smaller one
 * (3 → 2 → 1); the last offer can't be refused. Characters not kept are discarded, or go
 * back in the pool when `recycleUnchosen` is set. Only types with an open slot are offered,
 * so every pick fits the setup counts. Rules: https://grimbits.com/draft-buffet/.
 *
 * The slots start as the setup counts for the player count. With `modifiers` on (the mode's
 * setup modifiers `as-chosen`), a drafted character's setup modifier (its `setupModifier`
 * rule) changes the slots still open, as Grimbits' tool does (Trevor, 2026-10-26: "modifiers
 * are made dynamically for outsider count"): a fixed change (the Baron's +2 Outsiders) applies
 * at once, and a choice (the Godfather's −1 or +1, the Xaan's any number) is asked of the
 * Storyteller before the next offer. Once a count has been set by an "any number" change, a
 * later fixed change is asked too (apply or keep). Without `modifiers` the counts never change
 * (Trevor, 2026-10-19: "There is no automatic changes of the count of players").
 *
 * With `modifiers` on, a character that needs another in play (its `setupModifier` `requires`:
 * the Choirboy needs the King, the Huntsman the Damsel) gets it, as Grimbits' tool does: the
 * next seat to draft is offered only that character and can't refuse it, told which character
 * in play put it there. A Townsfolk seat makes room for it when its type has none open (the
 * Damsel, https://wiki.bloodontheclocktower.com/Huntsman). It is not forced when it is already
 * drafted, or when no seat can take it.
 *
 * Jinxed pairs (`jinxes`, the Storyteller's choice on New game, as in Grimbits' tool): with
 * `block` (the default), a character jinxed with one already drafted is not offered, unless
 * nothing else can fill the open seats; with `reduce`, it is half as likely to be offered;
 * with `allow`, jinxes don't matter. A jinxed pair in play puts the Djinn in play
 * (https://wiki.bloodontheclocktower.com/Djinn), and some pairs can't both be in play at all
 * (https://wiki.bloodontheclocktower.com/Heretic#Related_Jinxes).
 *
 * The state is plain data so it can be saved on the device and resumed.
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import { SEATED_TYPES, type SeatedType, type TypeCounts } from '#lib/core/rules/distribution.ts';
import { setupModifierFor, type CountOp } from '#lib/core/rules/setup-modifiers.ts';

export interface DraftConfig {
	offers: number[];
	recycleUnchosen: boolean;
	oneTypePerOffer: boolean;
	/** Drafted characters' setup modifiers change the open slots (mode part `as-chosen`). */
	modifiers?: boolean;
	/** How a character jinxed with one already drafted is offered; left out, as `allow`. */
	jinxes?: JinxedPairs;
}

export const JINXED_PAIRS = ['block', 'reduce', 'allow'] as const;
export type JinxedPairs = (typeof JINXED_PAIRS)[number];

/**
 * A count the Storyteller chooses because of a drafted character: how many of `type` the game
 * has in all, one of `options` (lowest first). `current` is the count now, kept by "Skip".
 */
export interface DraftAsk {
	characterId: CharacterId;
	type: SeatedType;
	options: number[];
	current: number;
}

/** A drafted character's setup change not applied yet. */
export interface PendingChange {
	characterId: CharacterId;
	op: CountOp;
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
	/** Each pool character's setup changes, when `config.modifiers` is on. */
	modifiers?: Record<CharacterId, readonly CountOp[]>;
	/** Setup changes still to apply, in order; the first may wait on `ask`. */
	pending?: PendingChange[];
	/** The count the Storyteller has to choose now; no offer is made until they do. */
	ask?: DraftAsk;
	/** An "any number" change has set the Outsider count. */
	countSet?: boolean;
	/** The character each pool character needs in play (the Choirboy's King). */
	requires?: Record<CharacterId, CharacterId>;
	/** Characters still to deal because another needs them, in order. */
	forced?: ForcedPick[];
	/** The character in play that put the current offer's only character there. */
	forcedBy?: CharacterId;
	/** Each pool character's jinxed partners in the pool, unless `config.jinxes` is `allow`. */
	jinxed?: Record<CharacterId, CharacterId[]>;
}

/** A character dealt to the next seat because `by` needs it in play. */
export interface ForcedPick {
	id: CharacterId;
	by: CharacterId;
}

type Random = () => number;

const isSeated = (type: string): type is SeatedType =>
	(SEATED_TYPES as readonly string[]).includes(type);

export function startDraft(
	config: DraftConfig,
	counts: TypeCounts,
	pool: readonly Character[],
	random: Random,
	jinxes: readonly { characters: readonly [CharacterId, CharacterId] }[] = []
): DraftState {
	const seated = pool.filter((c) => isSeated(c.type));
	const modifiers = config.modifiers
		? Object.fromEntries(
				seated.flatMap((c) => {
					const ops = setupModifierFor(c)?.ops ?? [];
					return ops.length > 0 ? [[c.id, ops]] : [];
				})
			)
		: undefined;
	const ids = new Set(seated.map((c) => c.id));
	const requires = config.modifiers
		? Object.fromEntries(
				seated.flatMap((c) => {
					const needs = setupModifierFor(c)?.requires;
					return needs && ids.has(needs) ? [[c.id, needs]] : [];
				})
			)
		: {};
	const jinxed: Record<CharacterId, CharacterId[]> = {};
	if ((config.jinxes ?? 'allow') !== 'allow') {
		for (const {
			characters: [a, b]
		} of jinxes) {
			if (a === b || !ids.has(a) || !ids.has(b)) continue;
			(jinxed[a] ??= []).push(b);
			(jinxed[b] ??= []).push(a);
		}
	}
	const state: DraftState = {
		config,
		slots: { ...counts },
		pool: seated.map((c) => c.id),
		types: Object.fromEntries(seated.map((c) => [c.id, c.type as SeatedType])),
		discarded: [],
		picks: [],
		offer: [],
		offerIndex: 0,
		...(modifiers ? { modifiers } : {}),
		...(Object.keys(requires).length > 0 ? { requires } : {}),
		...(Object.keys(jinxed).length > 0 ? { jinxed } : {})
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
export function takeOffer(state: DraftState, id: CharacterId, random: Random): DraftState {
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
	delete next.forcedBy;
	next = forceRequired(next, id);
	const ops = next.modifiers?.[id] ?? [];
	if (ops.length > 0) {
		next = advance({
			...next,
			pending: [...(next.pending ?? []), ...ops.map((op) => ({ characterId: id, op }))]
		});
		if (next.ask) return { ...next, offer: [] };
	}
	return nextOffer(next, random);
}

/** The Storyteller chooses the count `ask` is about; a `total` not on offer is ignored. */
export function answerAsk(state: DraftState, total: number, random: Random): DraftState {
	const ask = state.ask;
	if (!ask || (total !== ask.current && !ask.options.includes(total))) return state;
	const [change, ...rest] = state.pending ?? [];
	let next: DraftState = { ...setTotal(state, ask.type, total), pending: rest };
	delete next.ask;
	if (change?.op.kind === 'any' && change.op.type === 'outsider') next.countSet = true;
	next = advance(next);
	if (next.ask) return { ...next, offer: [] };
	return nextOffer(next, random);
}

/**
 * The next seat's offer: the first character still to be forced, which can't be refused, or
 * else a fresh offer. A forced character whose type no longer has an open seat is dropped.
 */
function nextOffer(state: DraftState, random: Random): DraftState {
	let next = state;
	while (next.forced?.length) {
		const [first, ...rest] = next.forced;
		next = { ...next, forced: rest };
		if (next.slots[next.types[first.id]] <= 0) continue;
		return {
			...next,
			offer: [first.id],
			offerIndex: Math.max(0, next.config.offers.length - 1),
			forcedBy: first.by
		};
	}
	if (next.forced) {
		next = { ...next };
		delete next.forced;
	}
	return withOffer(next, next.config.offers[0] ?? 1, random);
}

/**
 * Queues the character `id` needs in play, unless it is drafted or queued already, taking it out
 * of the pool. Its type needs an open seat; a Townsfolk seat becomes one when none is open.
 */
function forceRequired(state: DraftState, id: CharacterId): DraftState {
	const needs = state.requires?.[id];
	if (!needs || state.picks.includes(needs) || state.forced?.some((f) => f.id === needs))
		return state;
	const type = state.types[needs];
	let slots = state.slots;
	if (slots[type] <= 0) {
		if (type === 'townsfolk' || slots.townsfolk <= 0) return state;
		slots = { ...slots, townsfolk: slots.townsfolk - 1, [type]: slots[type] + 1 };
	}
	return {
		...state,
		slots,
		pool: state.pool.filter((x) => x !== needs),
		discarded: state.discarded.filter((x) => x !== needs),
		forced: [...(state.forced ?? []), { id: needs, by: id }]
	};
}

/** How many of `type` have been drafted. */
const drafted = (state: DraftState, type: SeatedType) =>
	state.picks.filter((id) => state.types[id] === type).length;

/** How many of `type` the game has in all: drafted plus still open. */
export const draftTotal = (state: DraftState, type: SeatedType) =>
	drafted(state, type) + Math.max(0, state.slots[type]);

/** The type a change to `type` is balanced against: Townsfolk, or Outsiders for Townsfolk. */
const balance = (type: SeatedType): SeatedType => (type === 'townsfolk' ? 'outsider' : 'townsfolk');

/** The totals `type` can reach: never below what is drafted, never past the open balance seats. */
function range(state: DraftState, type: SeatedType): [number, number] {
	const total = draftTotal(state, type);
	return [drafted(state, type), total + Math.max(0, state.slots[balance(type)])];
}

const clamp = (state: DraftState, type: SeatedType, total: number) => {
	const [min, max] = range(state, type);
	return Math.min(max, Math.max(min, total));
};

/** The state with `type`'s total at `total` (clamped), the difference taken from its balance. */
function setTotal(state: DraftState, type: SeatedType, total: number): DraftState {
	const diff = clamp(state, type, total) - draftTotal(state, type);
	if (diff === 0) return state;
	const other = balance(type);
	return {
		...state,
		slots: { ...state.slots, [type]: state.slots[type] + diff, [other]: state.slots[other] - diff }
	};
}

/** The totals a change can give, lowest first. */
function totalsFor(state: DraftState, op: CountOp): number[] {
	const [min, max] = range(state, op.type);
	const current = draftTotal(state, op.type);
	const totals =
		op.kind === 'any' || (op.kind === 'set' && op.values === 'most')
			? Array.from({ length: max - min + 1 }, (_, i) => min + i)
			: op.kind === 'set'
				? (op.values as readonly number[]).map((v) => clamp(state, op.type, v))
				: op.values.map((v) => clamp(state, op.type, current + v));
	return [...new Set(totals)].sort((a, b) => a - b);
}

/**
 * Applies pending changes in order until one needs the Storyteller: a choice of counts, or,
 * once an "any number" change has set the Outsiders, a fixed Outsider change (apply or keep).
 */
function advance(state: DraftState): DraftState {
	let next = state;
	while (next.pending?.length) {
		const [change, ...rest] = next.pending;
		const { op } = change;
		const current = draftTotal(next, op.type);
		const options = totalsFor(next, op);
		const keep = op.kind === 'delta' && op.type === 'outsider' && next.countSet === true;
		if (options.length === 1 && (!keep || options[0] === current)) {
			next = { ...setTotal(next, op.type, options[0]), pending: rest };
			continue;
		}
		return { ...next, ask: { characterId: change.characterId, type: op.type, options, current } };
	}
	const done = { ...next };
	delete done.pending;
	return done;
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
	const picked = new Set(state.picks);
	const clashes = (id: CharacterId) => state.jinxed?.[id]?.some((x) => picked.has(x)) ?? false;
	if (state.config.jinxes === 'block') {
		// Blocked unless nothing else can fill the open seats, so the draft can always finish.
		const clear = candidates.filter((id) => !clashes(id));
		if (clear.length > 0) candidates = clear;
	}
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
	// Each candidate weighs 1; one jinxed with a drafted character weighs ½ with `reduce`.
	const weight = (id: CharacterId) => (state.config.jinxes === 'reduce' && clashes(id) ? 0.5 : 1);
	const offer: CharacterId[] = [];
	const left = [...candidates];
	while (offer.length < size && left.length > 0) {
		let roll = random() * left.reduce((n, id) => n + weight(id), 0);
		const i = left.findIndex((id) => (roll -= weight(id)) < 0);
		offer.push(left.splice(i < 0 ? left.length - 1 : i, 1)[0]);
	}
	return offer;
}
