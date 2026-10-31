/**
 * The bag: which tiles go in for the characters the Storyteller selected, and a random
 * selection that matches the setup counts. It only suggests; the Storyteller can change
 * any stand-in, add any character and build the bag whatever the warnings say.
 *
 * - Characters marked `selection/bag-disabled` are never put in the bag
 *   (https://wiki.bloodontheclocktower.com/Setup). Those that secretly replace a good
 *   character (`reveal/replace-character`: the Drunk, the Marionette) need one more good
 *   character in the bag instead, chosen like any other; who is secretly the Drunk or the
 *   Marionette is decided once the tokens come back, with the "Is The …" reminder (Trevor,
 *   2026-10-16; https://wiki.bloodontheclocktower.com/Drunk,
 *   https://wiki.bloodontheclocktower.com/Marionette). Any other (Lil' Monsta) is not dealt
 *   at all (https://wiki.bloodontheclocktower.com/Lil%27_Monsta).
 * - The Lunatic's tile shows a Demon and puts the Lunatic in the grimoire
 *   (https://wiki.bloodontheclocktower.com/Lunatic).
 * - Fabled and Loric are rule characters and never go in the bag.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Character, CharacterId, CharacterType } from '#lib/core/data/types.ts';
import type { Bag, Game, Reminder, SeatId, TileId } from '#lib/core/model/types.ts';
import { SEATED_TYPES, type SeatedType } from './distribution.ts';
import { analyseSetup, type SetupAnalysis, type SetupWarning } from './setup.ts';
import { jinxSetupWarnings, type ScriptJinx } from './jinxes.ts';
import {
	canDuplicate,
	isBagDisabled,
	isNotDealt,
	isReplacedAfterDraw,
	replacementReminder,
	type AnyDuplicates
} from './bag-characters.ts';

export { canDuplicate, isReplacedAfterDraw, replacementReminder };
export type { AnyDuplicates };

/** Copies of each selected character (a missing id or 0 is not selected). */
export type BagSelection = Readonly<Record<CharacterId, number>>;

/** A tile to put in the bag; the same shape as the engine's `TileSpec`. */
export interface PlannedTile {
	shows: CharacterId;
	grimoire: CharacterId;
	reminders?: Reminder[];
}

/** What a stand-in tile shows: (Lunatic) a Demon. */
export type StandInKind = 'demon';

export interface StandIn {
	/** The selected character that is not put in the bag as itself. */
	characterId: CharacterId;
	kind: StandInKind;
	/** What its tile shows; undefined when nothing on the script fits. */
	shows?: CharacterId;
	/** True when `shows` is the Storyteller's choice rather than the suggestion. */
	chosen: boolean;
	/** Characters that fit, in script order (the Storyteller may pick another). */
	options: CharacterId[];
}

export type BagIssueCode = 'no-stand-in' | 'not-dealt' | 'rule-character' | 'unknown-character';

export interface BagIssue {
	code: BagIssueCode;
	message: string;
	characters: CharacterId[];
}

export interface BagPlan {
	tiles: PlannedTile[];
	standIns: StandIn[];
	/**
	 * "Is The …" reminders for characters in play with no token in the bag (Drunk,
	 * Marionette), placed on a player after the draw (`BuildBag.unseated`).
	 */
	unseated: Reminder[];
	/** True when a Traveller is in the bag (`BuildBag.includeTravellers`). */
	includeTravellers: boolean;
	issues: BagIssue[];
}

export interface BagPlanInput {
	selection: BagSelection;
	/** The script's characters, in script order. */
	scriptCharacters: readonly Character[];
	/** Looks up any character id (official or the script's homebrew). */
	lookup: (id: CharacterId) => Character | undefined;
	/** The Storyteller's stand-in choices, by the selected character's id. */
	standIns?: Readonly<Record<CharacterId, CharacterId>>;
	/** A number in [0, 1); used only to suggest stand-ins. Defaults to the first option. */
	random?: () => number;
}

/** Whether the character's tile shows something else, and what kind. */
export function standInKind(character: Character): StandInKind | undefined {
	const believes = rulesOf(character.id, new Map([[character.id, character]]))?.believesType;
	return believes === 'demon' ? 'demon' : undefined;
}

export function isRuleCharacter(type: CharacterType): boolean {
	return type === 'fabled' || type === 'loric';
}

/** The selected ids, each repeated by its copies, in script order then any others. */
export function selectedIds(selection: BagSelection, scriptOrder: readonly CharacterId[]) {
	const ids = Object.keys(selection).filter((id) => (selection[id] ?? 0) > 0);
	const rank = (id: CharacterId) => {
		const i = scriptOrder.indexOf(id);
		return i === -1 ? scriptOrder.length : i;
	};
	ids.sort((a, b) => rank(a) - rank(b));
	return ids.flatMap((id) => Array<CharacterId>(Math.floor(selection[id])).fill(id));
}

function pick<T>(items: readonly T[], random: (() => number) | undefined): T | undefined {
	if (items.length === 0) return undefined;
	if (!random) return items[0];
	return items[Math.floor(random() * items.length)];
}

export function planBag(input: BagPlanInput): BagPlan {
	const { selection, scriptCharacters, lookup } = input;
	const scriptOrder = scriptCharacters.map((c) => c.id);
	const ids = selectedIds(selection, scriptOrder);
	const selected = new Set(ids);
	const tiles: PlannedTile[] = [];
	const standIns: StandIn[] = [];
	const unseated: Reminder[] = [];
	const issues: BagIssue[] = [];
	let includeTravellers = false;

	for (const id of ids) {
		const character = lookup(id);
		if (!character) {
			issues.push({
				code: 'unknown-character',
				message: `${id} is not a known character.`,
				characters: [id]
			});
			continue;
		}
		if (isRuleCharacter(character.type)) {
			issues.push({
				code: 'rule-character',
				message: `${character.name} is a rule character, not dealt to a player: add it to the grimoire instead.`,
				characters: [id]
			});
			continue;
		}
		if (isNotDealt(character)) {
			issues.push({
				code: 'not-dealt',
				message: `${character.name} is not put in the bag.`,
				characters: [id]
			});
			continue;
		}
		if (isReplacedAfterDraw(character)) {
			unseated.push(replacementReminder(character)!);
			continue;
		}
		if (character.type === 'traveller') includeTravellers = true;
		const kind = standInKind(character);
		if (!kind) {
			tiles.push({ shows: id, grimoire: id });
			continue;
		}
		// A Lunatic is shown a Demon, usually the one in play.
		const options = scriptCharacters
			.filter((c) => c.type === 'demon' && !isBagDisabled(c) && c.id !== id)
			.map((c) => c.id);
		const chosen = input.standIns?.[id];
		const shows =
			chosen !== undefined && lookup(chosen)
				? chosen
				: (options.find((o) => selected.has(o)) ?? pick(options, input.random));
		standIns.push({
			characterId: id,
			kind,
			...(shows !== undefined ? { shows } : {}),
			chosen: shows !== undefined && shows === chosen,
			options
		});
		if (shows === undefined) {
			issues.push({
				code: 'no-stand-in',
				message: `Nothing on the script can be shown to the ${character.name}.`,
				characters: [id]
			});
			continue;
		}
		tiles.push({ shows, grimoire: id });
	}
	return { tiles, standIns, unseated, includeTravellers, issues };
}

export interface SelectionAnalysisInput {
	/**
	 * The players: those beyond 15 are Travellers, and each Traveller selected beyond them is
	 * one more player, so the other counts stay as they are.
	 */
	players: number;
	selection: BagSelection;
	/**
	 * A rule lets up to this many Travellers into the bag (Stowed Away). Its selected Travellers
	 * are counted among the players instead, so the other counts are for that many fewer.
	 */
	travellersInBag?: number;
	/** Fabled and Loric in play, which can change setup (the Sentinel). */
	ruleCharacters?: readonly CharacterId[];
	scriptOrder: readonly CharacterId[];
	lookup: (id: CharacterId) => Character | undefined;
	findByName?: (name: string) => CharacterId | undefined;
	/** A game rule lets characters have more than one copy (Duplicate Characters). */
	duplicatesAllowed?: AnyDuplicates;
}

/**
 * `analyseSetup` for a selection: Travellers are the selected Travellers (at least everyone
 * beyond 15). A Traveller joins as an extra player and is not counted in the setup counts
 * (https://wiki.bloodontheclocktower.com/Travellers), so selecting one adds a player rather
 * than lowering the other counts (Trevor, 2026-10-24), unless a rule puts it in the bag.
 */
export function analyseSelection(input: SelectionAnalysisInput): SetupAnalysis {
	const characters = [
		...selectedIds(input.selection, input.scriptOrder),
		...(input.ruleCharacters ?? [])
	]
		.map((id) => input.lookup(id))
		.filter((c): c is Character => c !== undefined);
	const selected = characters.filter((c) => c.type === 'traveller').length;
	const travellers = Math.max(selected, input.players - 15);
	const players = input.travellersInBag
		? input.players
		: input.players + travellers - Math.max(0, input.players - 15);
	return analyseSetup({
		players,
		travellers,
		inPlay: characters,
		findByName: input.findByName,
		findById: input.lookup,
		duplicatesAllowed: input.duplicatesAllowed
	});
}

/**
 * How many Travellers a game may have: everyone beyond 15 joins as one
 * (https://wiki.bloodontheclocktower.com/Setup), and a rule may let up to `inBag` more into
 * the bag (Stowed Away), counted among the players.
 */
export function travellerRange(players: number, inBag = 0): { min: number; max: number } {
	const min = Math.max(0, players - 15);
	return { min, max: Math.max(min, inBag) };
}

/**
 * Every Traveller not among the recommended ones (the script's and its edition's), for
 * players beyond 15: they join as Travellers (https://wiki.bloodontheclocktower.com/Setup)
 * and the wiki never limits them to the script
 * (https://wiki.bloodontheclocktower.com/Travellers).
 */
export function moreTravellers(
	recommended: readonly Character[],
	all: readonly Character[]
): Character[] {
	const listed = new Set(recommended.filter((c) => c.type === 'traveller').map((c) => c.id));
	return all.filter((c) => c.type === 'traveller' && !listed.has(c.id));
}

/**
 * True when the recommended Travellers can't seat the `needed` players beyond 15, so the
 * Characters page lists every other Traveller too (Trevor, 2026-10-31).
 */
export function listMoreTravellers(recommended: readonly Character[], needed: number): boolean {
	return needed > 0 && recommended.filter((c) => c.type === 'traveller').length < needed;
}

export interface RandomSelectionInput extends Omit<SelectionAnalysisInput, 'selection'> {
	/** The script's characters, in script order. */
	scriptCharacters: readonly Character[];
	/** Kept as they are; the rest is filled around them. */
	selection: BagSelection;
	random: () => number;
	/**
	 * A rule lets up to this many Travellers into the bag (Stowed Away): first 0 to this many
	 * are picked at random, counting any already selected, and the rest is filled for that
	 * many fewer players.
	 */
	/**
	 * Travellers to fall back on for players beyond the dealt count once the script's own run
	 * out, in the order to try them (the edition's, then every other one). The wiki sends
	 * everyone past 15 in as Travellers and never limits them to the script
	 * (https://wiki.bloodontheclocktower.com/Setup, https://wiki.bloodontheclocktower.com/Travellers).
	 * Each group is used up, picked at random, before the next.
	 */
	fallbackTravellers?: readonly (readonly Character[])[];
}

/**
 * Fills the selection up to the setup counts with random characters from the script,
 * keeping what is already selected: the Demon first, then Minions, then (with their setup
 * changes known) Outsiders and Townsfolk, then Travellers for players beyond the dealt
 * count. Where a modifier allows several counts, one is picked at random. A rule that puts
 * Travellers in the bag has them picked first.
 */
export function randomSelection(input: RandomSelectionInput): Record<CharacterId, number> {
	const selection: Record<CharacterId, number> = { ...input.selection };
	const take = (type: CharacterType, n: number) => {
		const pool = input.scriptCharacters.filter((c) => c.type === type && !(selection[c.id] > 0));
		for (let i = 0; i < n && pool.length > 0; i++) {
			const [character] = pool.splice(Math.floor(input.random() * pool.length), 1);
			selection[character.id] = 1;
		}
	};
	const travellersSelected = () =>
		Object.keys(selection).filter(
			(id) => selection[id] > 0 && input.lookup(id)?.type === 'traveller'
		).length;
	if (input.travellersInBag) {
		const n = Math.floor(input.random() * (input.travellersInBag + 1));
		take('traveller', n - travellersSelected());
	}
	const order: SeatedType[] = ['demon', 'minion', 'outsider', 'townsfolk'];
	for (const type of order) {
		const analysis = analyseSelection({ ...input, selection });
		const have = analysis.chosen[type];
		let target: number;
		if (type === 'townsfolk') {
			const others = SEATED_TYPES.filter((t) => t !== 'townsfolk').reduce(
				(sum, t) => sum + analysis.chosen[t],
				0
			);
			target = analysis.tokens - others;
		} else {
			const fits = analysis.expected[type].filter((n) => n >= have);
			target = fits.length ? fits[Math.floor(input.random() * fits.length)] : have;
		}
		take(type, target - have);
	}
	const analysis = analyseSelection({ ...input, selection });
	const needed = () => Math.max(0, input.players - analysis.dealt - travellersSelected());
	take('traveller', needed());
	for (const group of input.fallbackTravellers ?? []) {
		const pool = group.filter((c) => c.type === 'traveller' && !(selection[c.id] > 0));
		for (let n = needed(); n > 0 && pool.length > 0; n--) {
			const [character] = pool.splice(Math.floor(input.random() * pool.length), 1);
			selection[character.id] = 1;
		}
	}
	return selection;
}

/** Setup warnings that make a selection wrong for its table (the page's build errors). */
const INVALID: ReadonlySet<SetupWarning['code']> = new Set([
	'count-mismatch',
	'total-mismatch',
	'missing-required',
	'duplicate'
]);

export interface SelectionCheckInput extends SelectionAnalysisInput {
	scriptCharacters: readonly Character[];
	/** The script's jinxes: one that forbids both characters makes the pair invalid. */
	jinxes?: readonly ScriptJinx[];
}

/**
 * Why a selection is wrong for the table, empty when it is valid: the counts (with every
 * setup change), required characters (the Huntsman's Damsel), copies, a Demon stand-in the
 * Lunatic can't have, Travellers for players beyond 15, and jinxed pairs that can't both be
 * in play. The same checks the Characters page asks to confirm before building the bag,
 * except the player count itself, which no selection can change.
 */
export function selectionProblems(input: SelectionCheckInput): string[] {
	const analysis = analyseSelection(input);
	const plan = planBag({
		selection: input.selection,
		scriptCharacters: input.scriptCharacters,
		lookup: input.lookup
	});
	const ids = selectedIds(input.selection, input.scriptOrder);
	const travellers = ids.filter((id) => input.lookup(id)?.type === 'traveller').length;
	return [
		...analysis.warnings.filter((w) => INVALID.has(w.code)).map((w) => w.message),
		...plan.issues
			.filter((i) => i.code === 'no-stand-in' || i.code === 'unknown-character')
			.map((i) => i.message),
		...(travellers < analysis.travellers
			? [`${analysis.travellers} Travellers needed; ${travellers} chosen.`]
			: []),
		...jinxSetupWarnings(input.jinxes ?? [], ids, (id) => input.lookup(id)?.name ?? id).map(
			(w) => w.message
		)
	];
}

export type RandomResult =
	{ ok: true; selection: Record<CharacterId, number> } | { ok: false; problems: string[] };

/** Random selections tried before saying none fits. */
const RANDOM_TRIES = 300;

/**
 * A random selection that is valid for the table (Trevor, 2026-10-19: "do not show an
 * invalid draw"): `randomSelection` is tried until `selectionProblems` finds nothing. When
 * no try fits (the kept characters or the script make it impossible), the problems of the
 * last try say why, and nothing is chosen.
 */
export function validRandomSelection(
	input: RandomSelectionInput & { jinxes?: readonly ScriptJinx[]; tries?: number }
): RandomResult {
	let problems: string[] = [];
	for (let i = 0; i < (input.tries ?? RANDOM_TRIES); i++) {
		const selection = randomSelection(input);
		problems = selectionProblems({ ...input, selection });
		if (problems.length === 0) return { ok: true, selection };
	}
	return { ok: false, problems };
}

/**
 * The seat the next draw goes to, for the parity draw (players draw in seating order): the
 * first seat with no character that is not already holding a tile. Undefined when every
 * seat has one.
 */
export function nextDrawSeat(game: Game): SeatId | undefined {
	const holding = new Set(
		Object.values(game.bag?.tiles ?? {})
			.filter((t) => t.drawnBySeat !== undefined && !t.confirmed)
			.map((t) => t.drawnBySeat)
	);
	return game.seating.find((id) => game.seats[id].characterId === undefined && !holding.has(id));
}

/**
 * Deal (Trevor, 2026-10-26: "auto select characters and send to players"): every tile still
 * in the bag goes to an empty seat at random, in place of each player drawing one. Seats
 * holding a drawn tile keep it. Returns the pairs to draw and confirm, and how many tiles
 * have no empty seat (the Storyteller adds seats first, as the draw does: warn, never lock).
 */
export function dealPairs(
	game: Game,
	random: () => number
): { pairs: { seatId: SeatId; tileId: TileId }[]; seatsShort: number } {
	const tiles = [...(game.bag?.order ?? [])];
	for (let i = tiles.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[tiles[i], tiles[j]] = [tiles[j], tiles[i]];
	}
	const holding = new Set(
		Object.values(game.bag?.tiles ?? {})
			.filter((t) => t.drawnBySeat !== undefined && !t.confirmed)
			.map((t) => t.drawnBySeat)
	);
	const seats = game.seating.filter(
		(id) => game.seats[id].characterId === undefined && !holding.has(id)
	);
	const pairs = seats.slice(0, tiles.length).map((seatId, i) => ({ seatId, tileId: tiles[i] }));
	return { pairs, seatsShort: Math.max(0, tiles.length - seats.length) };
}

/** A numbered place on the draw screen. */
export interface BagSlot {
	tileId: TileId;
	/** 1-based number shown on the tile. */
	number: number;
	state: 'in-bag' | 'held' | 'drawn';
	/** The seat that holds the tile or drew it. */
	seatId?: SeatId;
}

/**
 * Every tile as a numbered place that never moves during the draw, so nothing reflows and
 * a drawn tile leaves a gap. The places follow the tile ids, which are random, not the
 * order the characters were selected in, so a number says nothing about the character.
 */
export function bagSlots(bag: Bag): BagSlot[] {
	return Object.keys(bag.tiles)
		.sort()
		.map((tileId, i) => {
			const tile = bag.tiles[tileId];
			const state = tile.confirmed ? 'drawn' : tile.drawnBySeat !== undefined ? 'held' : 'in-bag';
			return {
				tileId,
				number: i + 1,
				state,
				...(tile.drawnBySeat !== undefined ? { seatId: tile.drawnBySeat } : {})
			};
		});
}

/**
 * Setup is done once a bag was built and every tile in it was drawn and confirmed. From
 * then on the bag and the character selection are closed (Trevor, 2026-10-16): later
 * changes to a seat go through the grimoire. A partly drawn bag stays open to resume.
 */
export function setupComplete(game: Game): boolean {
	const tiles = Object.values(game.bag?.tiles ?? {});
	return tiles.length > 0 && tiles.every((t) => t.confirmed);
}
