/**
 * Night order: the steps the Storyteller runs on the first night or on other nights, for
 * the characters in play.
 *
 * - Order comes from TPI's `nightsheet.json` (the official night sheet; ability text still
 *   wins over the sheet: https://wiki.bloodontheclocktower.com/Abilities).
 * - Dusk starts every night and Dawn ends it; a few characters act after Dawn because their
 *   step is an announcement (Leviathan, Vizier).
 *   https://wiki.bloodontheclocktower.com/Glossary ("Dusk", "Dawn")
 * - Minion info and Demon info happen on the first night only, and only with 7 or more
 *   players (Glossary, "Minion Info", "Demon Info"; Teensyville below 7), unless the
 *   Toymaker is in play (https://wiki.bloodontheclocktower.com/Toymaker).
 * - A script's `_meta.firstNight` / `_meta.otherNight` replaces the order (TPI
 *   `script-schema.json`); characters it leaves out keep their standard place.
 * - Homebrew characters with a numeric `firstNight` / `otherNight` are slotted between
 *   official characters using the provisional numeric snapshot
 *   (`night-order-provisional.json`, 05-spike-results.md S8). Replace that file and this
 *   keeps working.
 */
import type { NumericNightOrder } from '#lib/core/data/night-order-numeric.ts';
import {
	NIGHT_MARKERS,
	type Character,
	type CharacterId,
	type NightMarker,
	type NightSheet
} from '#lib/core/data/types.ts';
import type { AbilityState } from './ability.ts';
import type { GainedAbility } from './gained-abilities.ts';
import type { NightStepInfo } from './night-info.ts';
import { hasEvilTeamInfo } from './teensyville.ts';

export type Night = 'first' | 'other';

export interface NightOrderInput {
	night: Night;
	sheet: NightSheet;
	/** Characters in play (dealt, Travellers, Fabled, Loric), official or homebrew. */
	inPlay: readonly Character[];
	/** Players who are not Travellers; decides the 7+ player rule. */
	players: number;
	/** The script's own order for this night (`_meta.firstNight` or `_meta.otherNight`). */
	customOrder?: readonly string[];
	/** Numeric positions of official characters, to slot in homebrew numbers. */
	numeric?: NumericNightOrder;
	/** The Storyteller's changes to this night's steps (see `NightStepOverride`). */
	overrides?: readonly NightStepOverride[];
}

/**
 * A Storyteller override of the night order, stored with the game. `night` limits it to
 * the first night or to other nights; without it, it applies to both. `after` is the id of
 * the step to follow (`null`: first, before everything else).
 * - `hide`: leave a step out (it is listed in `omitted`);
 * - `edit`: replace a step's text;
 * - `move`: put a step after another;
 * - `add`: a step of the Storyteller's own, with their own unique `id`.
 */
export type NightStepOverride =
	| { kind: 'hide'; id: string; night?: Night }
	| { kind: 'edit'; id: string; text: string; night?: Night }
	| { kind: 'move'; id: string; after: string | null; night?: Night }
	| {
			kind: 'add';
			id: string;
			text: string;
			/** Short heading for a step with no character. */
			title?: string;
			characterId?: CharacterId;
			after: string | null;
			night?: Night;
	  };

/** Why a step is where it is. */
export type Placement = 'night-sheet' | 'custom-order' | 'numeric' | 'unplaced' | 'marker';

export interface NightStep {
	id: CharacterId | NightMarker | string;
	/** `custom` for a step the Storyteller added. */
	kind: 'marker' | 'character' | 'custom';
	/** For character steps, and custom steps about a character. */
	character?: Character;
	/** For custom steps: the Storyteller's heading. */
	title?: string;
	/** Set when a Storyteller override changed or added this step. */
	overridden?: 'edited' | 'moved' | 'added';
	/** What to do: the character's night reminder, or our text for a marker step. */
	reminder?: string;
	/** True for steps after Dawn (public announcements such as the Leviathan's). */
	afterDawn: boolean;
	placement: Placement;
	/** Short notes in our words: why it is here, and rules to remember for this step. */
	notes: string[];
	/**
	 * Answers or info pickers worked out from the game (`withNightInfo` in night-info.ts).
	 * `nightOrder` never sets it: it has no game state.
	 */
	info?: NightStepInfo;
	/**
	 * The waking players whose ability does not work (drunk, poisoned, no ability), set by
	 * `withNightInfo`; for a Minion the Preacher chose, it says not to wake them for it.
	 */
	impaired?: AbilityState[];
	/** Set on a step added for a gained ability (the Pixie's), by `withGainedSteps`. */
	gained?: GainedAbility;
}

export interface OmittedStep {
	id: CharacterId | NightMarker | string;
	reason: string;
}

export interface NightOrder {
	night: Night;
	steps: NightStep[];
	/** Steps that would be on the sheet but are left out tonight, with the reason. */
	omitted: OmittedStep[];
}

/** Our own text for the night markers. */
export const MARKER_TEXT: Record<NightMarker, { name: string; first: string; other: string }> = {
	dusk: {
		name: 'Dusk',
		first: 'Everyone closes their eyes. Night begins.',
		other: 'Everyone closes their eyes. Night begins.'
	},
	minioninfo: {
		name: 'Minion info',
		first: 'Wake the Minions together: show them the Demon, and let them see each other.',
		other: ''
	},
	demoninfo: {
		name: 'Demon info',
		first: 'Wake the Demon: show them their Minions, then 3 good characters not in play as bluffs.',
		other: ''
	},
	dawn: {
		name: 'Dawn',
		first: 'Night ends. Wake everyone for the first day.',
		other: 'Night ends. Wake everyone and announce who died.'
	}
};

const MARKER_IDS: readonly string[] = NIGHT_MARKERS;
export function isNightMarker(id: string): id is NightMarker {
	return MARKER_IDS.includes(id);
}

function reminderFor(character: Character, night: Night): string | undefined {
	return night === 'first' ? character.firstNightReminder : character.otherNightReminder;
}

function numberFor(character: Character, night: Night): number | undefined {
	return night === 'first' ? character.firstNight : character.otherNight;
}

/**
 * A position for every step on TPI's sheet: the snapshot's number where it has one,
 * otherwise spaced evenly between its numbered neighbours, so TPI's order is always kept.
 * Dusk is always first.
 */
export function sheetPositions(
	list: readonly string[],
	numbers: ReadonlyMap<CharacterId, number> | undefined
): Map<string, number> {
	const known = list.map((id) => (id === 'dusk' ? -Infinity : numbers?.get(id)));
	// Without numbers, use the list index; homebrew numbers then cannot be slotted.
	if (!numbers) return new Map(list.map((id, i) => [id, id === 'dusk' ? -Infinity : i]));
	const out = new Map<string, number>();
	for (let i = 0; i < list.length; i++) {
		if (known[i] !== undefined) {
			out.set(list[i], known[i]!);
			continue;
		}
		let lo = i - 1;
		while (lo >= 0 && known[lo] === undefined) lo--;
		let hi = i + 1;
		while (hi < list.length && known[hi] === undefined) hi++;
		const low = lo >= 0 && Number.isFinite(known[lo]!) ? known[lo]! : undefined;
		const high = hi < list.length ? known[hi] : undefined;
		let pos: number;
		if (low !== undefined && high !== undefined) pos = low + ((high - low) * (i - lo)) / (hi - lo);
		else if (high !== undefined) pos = high - (hi - i) / (hi - lo);
		else if (low !== undefined) pos = low + (i - lo);
		else pos = i;
		out.set(list[i], pos);
	}
	return out;
}

interface Candidate {
	id: string;
	character?: Character;
	pos: number;
	/** Tie-break: sheet entries before homebrew numbers before unplaced, then Dawn. */
	rank: number;
	seq: number;
	placement: Placement;
	notes: string[];
}

/** The standard order (no custom `_meta` order) for the given steps. */
function standardOrder(
	input: NightOrderInput,
	wanted: readonly Character[],
	markers: NightMarker[]
) {
	const { night, sheet, numeric } = input;
	const list = night === 'first' ? sheet.firstNight : sheet.otherNight;
	const numbers = numeric
		? night === 'first'
			? numeric.firstNight
			: numeric.otherNight
		: undefined;
	const positions = sheetPositions(list, numbers);
	const dawnPos = positions.get('dawn') ?? Infinity;
	const candidates: Candidate[] = [];
	let seq = 0;
	for (const marker of markers) {
		candidates.push({
			id: marker,
			pos: positions.get(marker) ?? (marker === 'dusk' ? -Infinity : dawnPos),
			rank: marker === 'dawn' ? 3 : 0,
			seq: seq++,
			placement: 'marker',
			notes: []
		});
	}
	for (const character of wanted) {
		const ownNumber = numberFor(character, night);
		const official = character.edition !== undefined || ownNumber === undefined;
		const sheetPos = positions.get(character.id);
		if (sheetPos !== undefined && official) {
			candidates.push({
				id: character.id,
				character,
				pos: sheetPos,
				rank: 0,
				seq: seq++,
				placement: 'night-sheet',
				notes: []
			});
		} else if (ownNumber !== undefined && numbers) {
			// Only announcements go after Dawn, so a homebrew number past Dawn stays before it.
			const pastDawn = ownNumber > dawnPos;
			candidates.push({
				id: character.id,
				character,
				pos: pastDawn ? dawnPos : ownNumber,
				rank: 1,
				seq: seq++,
				placement: 'numeric',
				notes: [
					pastDawn
						? `Night number ${ownNumber} is later than every official step; placed just before Dawn.`
						: `Placed by its night number ${ownNumber}, matched against provisional numbers for official characters; check the order.`
				]
			});
		} else if (sheetPos !== undefined) {
			candidates.push({
				id: character.id,
				character,
				pos: sheetPos,
				rank: 0,
				seq: seq++,
				placement: 'night-sheet',
				notes: []
			});
		} else {
			candidates.push({
				id: character.id,
				character,
				pos: dawnPos,
				rank: 2,
				seq: seq++,
				placement: 'unplaced',
				notes: [
					ownNumber !== undefined
						? `Has night number ${ownNumber}, but no numbers for official characters are loaded; placed just before Dawn.`
						: 'Has no place on the night sheet; placed just before Dawn.'
				]
			});
		}
	}
	candidates.sort((a, b) => a.pos - b.pos || a.rank - b.rank || a.seq - b.seq);
	return candidates;
}

/** Characters that act tonight: those with night text, or a night number, for this night. */
function actsTonight(character: Character, night: Night): boolean {
	return reminderFor(character, night) !== undefined || numberFor(character, night) !== undefined;
}

export function nightOrder(input: NightOrderInput): NightOrder {
	const { night } = input;
	const omitted: OmittedStep[] = [];
	const inPlayIds = new Set(input.inPlay.map((c) => c.id));
	const unique = input.inPlay.filter((c, i, all) => all.findIndex((d) => d.id === c.id) === i);
	const custom = input.customOrder?.length ? input.customOrder : undefined;
	const customIds = new Set(custom);

	const markers: NightMarker[] = ['dusk'];
	if (night === 'first') {
		if (hasEvilTeamInfo(input.players, inPlayIds)) markers.push('minioninfo', 'demoninfo');
		else {
			const reason = `Fewer than 7 players (${input.players}): no Minion or Demon info.`;
			omitted.push({ id: 'minioninfo', reason }, { id: 'demoninfo', reason });
		}
	}
	markers.push('dawn');

	// Characters listed in a custom order are kept even without night text: the author put them there.
	const wanted = unique.filter((c) => actsTonight(c, night) || customIds.has(c.id));
	let ordered = standardOrder(input, wanted, markers);

	if (custom) {
		const present = new Set(ordered.map((c) => c.id));
		const byId = new Map(ordered.map((c) => [c.id, c]));
		const result: Candidate[] = [];
		for (const id of custom) {
			const candidate = byId.get(id);
			if (candidate && !result.includes(candidate)) {
				result.push({
					...candidate,
					placement: candidate.placement === 'marker' ? 'marker' : 'custom-order',
					notes: []
				});
			}
		}
		// Insert everything the custom order left out after its standard predecessor.
		ordered.forEach((candidate, i) => {
			if (customIds.has(candidate.id) || !present.has(candidate.id)) return;
			let at = 0;
			for (let j = i - 1; j >= 0; j--) {
				const k = result.findIndex((r) => r.id === ordered[j].id);
				if (k >= 0) {
					at = k + 1;
					break;
				}
			}
			const notes =
				candidate.placement === 'marker'
					? candidate.notes
					: [
							'Not in the script’s own night order; placed by the standard order.',
							...candidate.notes
						];
			result.splice(at, 0, { ...candidate, notes });
		});
		// Dusk first, always.
		const dusk = result.findIndex((r) => r.id === 'dusk');
		if (dusk > 0) result.unshift(...result.splice(dusk, 1));
		ordered = result;
	}

	let steps = ordered.map((candidate): NightStep => {
		const afterDawn = false;
		if (!candidate.character) {
			const marker = candidate.id as NightMarker;
			return {
				id: marker,
				kind: 'marker',
				reminder: MARKER_TEXT[marker][night],
				afterDawn,
				placement: custom && customIds.has(marker) ? 'custom-order' : 'marker',
				notes: [...candidate.notes, ...markerNotes(marker, inPlayIds)]
			};
		}
		const character = candidate.character;
		const notes = [...candidate.notes];
		const reminder = reminderFor(character, night);
		if (reminder === undefined) notes.push('No night text for this character tonight.');
		return {
			id: character.id,
			kind: 'character',
			character,
			reminder,
			afterDawn,
			placement: candidate.placement,
			notes
		};
	});
	if (input.overrides?.length) {
		steps = applyNightOverrides(steps, input.overrides, night, omitted, (id) =>
			input.inPlay.find((c) => c.id === id)
		);
	}
	const dawnIndex = steps.findIndex((s) => s.id === 'dawn');
	steps.forEach((step, i) => {
		step.afterDawn = dawnIndex >= 0 && i > dawnIndex;
		if (step.afterDawn && step.kind === 'character') {
			step.notes.push('After Dawn: announce this to everyone.');
		}
	});
	return { night, steps, omitted };
}

/** Applies the Storyteller's overrides for this night. Unknown ids are ignored. */
export function applyNightOverrides(
	steps: readonly NightStep[],
	overrides: readonly NightStepOverride[],
	night: Night,
	omitted: OmittedStep[] = [],
	character: (id: CharacterId) => Character | undefined = () => undefined
): NightStep[] {
	const out = steps.map((s) => ({ ...s, notes: [...s.notes] }));
	const insertAfter = (step: NightStep, after: string | null) => {
		let at = after === null ? 0 : out.findIndex((s) => s.id === after) + 1;
		// Unknown anchor: just before Dawn, or at the end.
		if (after !== null && at === 0) {
			const dawn = out.findIndex((s) => s.id === 'dawn');
			at = dawn >= 0 ? dawn : out.length;
		}
		out.splice(at, 0, step);
	};
	for (const o of overrides) {
		if (o.night !== undefined && o.night !== night) continue;
		const index = out.findIndex((s) => s.id === o.id);
		switch (o.kind) {
			case 'hide':
				if (index >= 0) {
					out.splice(index, 1);
					omitted.push({ id: o.id, reason: 'Hidden by the Storyteller.' });
				}
				break;
			case 'edit':
				if (index >= 0) out[index] = { ...out[index], reminder: o.text, overridden: 'edited' };
				break;
			case 'move':
				if (index >= 0 && o.after !== o.id) {
					const [step] = out.splice(index, 1);
					insertAfter({ ...step, overridden: step.overridden ?? 'moved' }, o.after);
				}
				break;
			case 'add': {
				if (index >= 0) break;
				const c = o.characterId ? character(o.characterId) : undefined;
				insertAfter(
					{
						id: o.id,
						kind: 'custom',
						...(c ? { character: c } : {}),
						...(o.title ? { title: o.title } : {}),
						reminder: o.text,
						afterDawn: false,
						placement: 'custom-order',
						notes: [],
						overridden: 'added'
					},
					o.after
				);
				break;
			}
		}
	}
	return out;
}

/** Rules to remember at the evil info steps, from characters in play. */
function markerNotes(marker: NightMarker, inPlay: ReadonlySet<CharacterId>): string[] {
	const notes: string[] = [];
	if (marker === 'minioninfo' || marker === 'demoninfo') {
		// https://wiki.bloodontheclocktower.com/Poppy_Grower
		if (inPlay.has('poppygrower'))
			notes.push('Poppy Grower: while it lives, Minions and Demon do not learn each other.');
		// https://wiki.bloodontheclocktower.com/Magician
		if (inPlay.has('magician'))
			notes.push('Magician: also shown as a Minion to the Demon and as the Demon to Minions.');
		// https://wiki.bloodontheclocktower.com/Lunatic and Storyteller_Advice (separate wakes)
		if (inPlay.has('lunatic'))
			notes.push('Lunatic: wake Minions and Demon separately; the Lunatic gets Demon info too.');
		// https://wiki.bloodontheclocktower.com/Toymaker
		if (inPlay.has('toymaker')) notes.push('Toymaker: evil gets this info at any player count.');
	}
	if (marker === 'demoninfo') {
		// https://wiki.bloodontheclocktower.com/Summoner
		if (inPlay.has('summoner'))
			notes.push('Summoner: there is no Demon yet; the Summoner gets the bluffs.');
		// https://wiki.bloodontheclocktower.com/Snitch
		if (inPlay.has('snitch')) notes.push('Snitch: each Minion also gets 3 bluffs.');
	}
	return notes;
}
