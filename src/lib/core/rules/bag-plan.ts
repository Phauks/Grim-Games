/**
 * The bag: which tiles go in for the characters the Storyteller selected, and a random
 * selection that matches the setup counts. It only suggests; the Storyteller can change
 * any stand-in, add any character and build the bag whatever the warnings say.
 *
 * - Characters marked `selection/bag-disabled` are never put in the bag
 *   (https://wiki.bloodontheclocktower.com/Setup). Those that secretly replace a good
 *   character (`reveal/replace-character`: the Drunk, the Marionette) get a stand-in tile
 *   that shows a good character and puts that character's token in the grimoire with the
 *   "Is The …" reminder (https://wiki.bloodontheclocktower.com/Drunk,
 *   https://wiki.bloodontheclocktower.com/Marionette). Any other (Lil' Monsta) is not dealt
 *   at all (https://wiki.bloodontheclocktower.com/Lil%27_Monsta).
 * - The Lunatic's tile shows a Demon and puts the Lunatic in the grimoire
 *   (https://wiki.bloodontheclocktower.com/Lunatic).
 * - Fabled and Loric are rule characters and never go in the bag.
 */
import type { Character, CharacterId, CharacterType } from '#lib/core/data/types.ts';
import type { Bag, Game, Reminder, SeatId, TileId } from '#lib/core/model/types.ts';
import { SEATED_TYPES, type SeatedType } from './distribution.ts';
import { analyseSetup, type SetupAnalysis } from './setup.ts';
import { canDuplicate, isBagDisabled, isNotDealt, replacementReminder } from './bag-characters.ts';

export { canDuplicate, isBagDisabled, isNotDealt, replacementReminder };

/** Copies of each selected character (a missing id or 0 is not selected). */
export type BagSelection = Readonly<Record<CharacterId, number>>;

/** A tile to put in the bag; the same shape as the engine's `TileSpec`. */
export interface PlannedTile {
	shows: CharacterId;
	grimoire: CharacterId;
	reminders?: Reminder[];
}

/** What a stand-in tile shows: a good character, or (Lunatic) a Demon. */
export type StandInKind = 'good' | 'demon';

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

export type BagIssueCode =
	'no-stand-in' | 'stand-in-selected' | 'not-dealt' | 'rule-character' | 'unknown-character';

export interface BagIssue {
	code: BagIssueCode;
	message: string;
	characters: CharacterId[];
}

export interface BagPlan {
	tiles: PlannedTile[];
	standIns: StandIn[];
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
	/**
	 * False: never pick a good stand-in the Storyteller hasn't chosen (Trevor, 2026-10-16:
	 * which Townsfolk the Drunk is shown is the Storyteller's call, not an automatic one).
	 * A Lunatic is still shown the Demon in play. Defaults to true.
	 */
	suggest?: boolean;
}

/** Whether the character's tile shows something else, and what kind. */
export function standInKind(character: Character): StandInKind | undefined {
	if (character.id === 'lunatic' && character.edition !== undefined) return 'demon';
	if (isBagDisabled(character) && replacementReminder(character)) return 'good';
	return undefined;
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
	const issues: BagIssue[] = [];
	// Stand-ins already used, so two Drunks are not both shown the same Townsfolk.
	const used = new Set<CharacterId>();
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
		if (character.type === 'traveller') includeTravellers = true;
		const kind = standInKind(character);
		if (!kind) {
			tiles.push({ shows: id, grimoire: id });
			continue;
		}
		// A Drunk is shown a Townsfolk; a Marionette a good character; both should be
		// characters not in play. A Lunatic is shown a Demon, usually the one in play.
		const options = scriptCharacters
			.filter((c) =>
				kind === 'demon'
					? c.type === 'demon'
					: character.id === 'drunk' || character.type === 'outsider'
						? c.type === 'townsfolk'
						: c.type === 'townsfolk' || c.type === 'outsider'
			)
			.filter((c) => !isBagDisabled(c) && c.id !== id)
			.map((c) => c.id);
		const chosen = input.standIns?.[id];
		let shows: CharacterId | undefined;
		const suggest = input.suggest !== false;
		if (chosen !== undefined && lookup(chosen)) shows = chosen;
		else if (kind === 'demon') {
			shows =
				options.find((o) => selected.has(o)) ?? (suggest ? pick(options, input.random) : undefined);
		} else if (suggest) {
			shows = pick(
				options.filter((o) => !selected.has(o) && !used.has(o)),
				input.random
			);
		}
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
				message:
					options.length > 0
						? `Choose what the ${character.name} is shown.`
						: `Nothing on the script can be shown to the ${character.name}.`,
				characters: [id]
			});
			continue;
		}
		used.add(shows);
		if (kind === 'good' && selected.has(shows)) {
			issues.push({
				code: 'stand-in-selected',
				message: `The ${character.name} is shown the ${lookup(shows)?.name ?? shows}, which is also in the bag.`,
				characters: [id, shows]
			});
		}
		const reminder = replacementReminder(character);
		tiles.push(
			kind === 'demon'
				? { shows, grimoire: id }
				: { shows, grimoire: shows, ...(reminder ? { reminders: [reminder] } : {}) }
		);
	}
	return { tiles, standIns, includeTravellers, issues };
}

export interface SelectionAnalysisInput {
	/** Everyone playing, Travellers included. */
	players: number;
	selection: BagSelection;
	/** Fabled and Loric in play, which can change setup (the Sentinel). */
	ruleCharacters?: readonly CharacterId[];
	scriptOrder: readonly CharacterId[];
	lookup: (id: CharacterId) => Character | undefined;
	findByName?: (name: string) => CharacterId | undefined;
}

/**
 * `analyseSetup` for a selection: Travellers are the selected Travellers (at least everyone
 * beyond 15).
 */
export function analyseSelection(input: SelectionAnalysisInput): SetupAnalysis {
	const characters = [
		...selectedIds(input.selection, input.scriptOrder),
		...(input.ruleCharacters ?? [])
	]
		.map((id) => input.lookup(id))
		.filter((c): c is Character => c !== undefined);
	const travellers = characters.filter((c) => c.type === 'traveller').length;
	return analyseSetup({
		players: input.players,
		travellers: Math.max(travellers, input.players - 15),
		inPlay: characters,
		findByName: input.findByName,
		findById: input.lookup
	});
}

export interface RandomSelectionInput extends Omit<SelectionAnalysisInput, 'selection'> {
	/** The script's characters, in script order. */
	scriptCharacters: readonly Character[];
	/** Kept as they are; the rest is filled around them. */
	selection: BagSelection;
	random: () => number;
}

/**
 * Fills the selection up to the setup counts with random characters from the script,
 * keeping what is already selected: the Demon first, then Minions, then (with their setup
 * changes known) Outsiders and Townsfolk, then Travellers for players beyond the dealt
 * count. Where a modifier allows several counts, one is picked at random.
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
			target = analysis.dealt - others;
		} else {
			const fits = analysis.expected[type].filter((n) => n >= have);
			target = fits.length ? fits[Math.floor(input.random() * fits.length)] : have;
		}
		take(type, target - have);
	}
	const analysis = analyseSelection({ ...input, selection });
	const travellers = input.scriptCharacters.filter(
		(c) => c.type === 'traveller' && selection[c.id] > 0
	).length;
	take('traveller', Math.max(0, input.players - analysis.dealt - travellers));
	return selection;
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
