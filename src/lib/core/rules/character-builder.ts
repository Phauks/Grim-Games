/**
 * The Character builder (Trevor, 2026-10-17): a homebrew character written by the user, kept
 * as the character object TPI's script format uses (`script-schema.json`), so the Script
 * builder, saved scripts and every other part of the app read it like any homebrew character
 * from a script.
 */
import {
	CHARACTER_ID_PATTERN,
	CHARACTER_TYPES,
	type Character,
	type CharacterName,
	type CharacterType,
	type GameData,
	type ReminderLabel
} from '#lib/core/data/index.ts';
import { bracketText } from './setup-modifiers.ts';
import type { HomebrewEntry } from './script-builder.ts';

/** What the builder's form holds; text fields are kept as typed until the entry is made. */
export interface CharacterFields {
	/** Empty: made from the name. */
	id: string;
	name: string;
	team: CharacterType;
	ability: string;
	flavor: string;
	/** Icon URL. */
	image: string;
	reminders: string[];
	remindersGlobal: string[];
	firstNightReminder: string;
	otherNightReminder: string;
	/** Position in the first night's order (TPI's numbers); absent when it does not act. */
	firstNight?: number;
	otherNight?: number;
	/** Absent: follows the ability, which changes setup when it has [bracketed] text. */
	setup?: boolean;
}

export function emptyCharacterFields(): CharacterFields {
	return {
		id: '',
		name: '',
		team: 'townsfolk',
		ability: '',
		flavor: '',
		image: '',
		reminders: [],
		remindersGlobal: [],
		firstNightReminder: '',
		otherNightReminder: ''
	};
}

/** A character id from a name: lower-case letters and digits, as the format requires. */
export function characterIdFor(name: string): string {
	return name
		.normalize('NFKD')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
}

/** The id the entry gets: the typed one, else one made from the name. */
export function fieldsId(fields: CharacterFields): string {
	return fields.id.trim() ? characterIdFor(fields.id) : characterIdFor(fields.name);
}

/** Whether the character changes setup: as set, else from [bracketed] ability text. */
export function changesSetup(fields: CharacterFields): boolean {
	return fields.setup ?? bracketText(fields.ability) !== undefined;
}

const words = (list: readonly string[]) => list.map((s) => s.trim()).filter(Boolean);
const position = (n: number | undefined) =>
	n !== undefined && Number.isFinite(n) && n > 0 ? n : undefined;

/** The character as a script's character object; empty fields are left out. */
export function characterEntry(fields: CharacterFields): HomebrewEntry {
	const entry: Record<string, unknown> = {
		id: fieldsId(fields),
		name: fields.name.trim(),
		team: fields.team,
		ability: fields.ability.trim()
	};
	const flavor = fields.flavor.trim();
	if (flavor) entry.flavor = flavor;
	const image = fields.image.trim();
	if (image) entry.image = image;
	if (changesSetup(fields)) entry.setup = true;
	const reminders = words(fields.reminders);
	if (reminders.length) entry.reminders = reminders;
	const remindersGlobal = words(fields.remindersGlobal);
	if (remindersGlobal.length) entry.remindersGlobal = remindersGlobal;
	const first = fields.firstNightReminder.trim();
	const firstAt = position(fields.firstNight);
	// Without a position it acts at an unplaced spot the Storyteller sees in the night order.
	if (firstAt) entry.firstNight = firstAt;
	if (first) entry.firstNightReminder = first;
	const other = fields.otherNightReminder.trim();
	const otherAt = position(fields.otherNight);
	// Without a position it acts at an unplaced spot the Storyteller sees in the night order.
	if (otherAt) entry.otherNight = otherAt;
	if (other) entry.otherNightReminder = other;
	return entry;
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const list = (value: unknown) =>
	Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
const num = (value: unknown) => (typeof value === 'number' && value > 0 ? value : undefined);

/** A character object (from a script, or saved here) back into the form, to edit it. */
export function fieldsFromEntry(entry: HomebrewEntry): CharacterFields {
	const team = CHARACTER_TYPES.find((t) => t === entry.team) ?? 'townsfolk';
	const image = Array.isArray(entry.image) ? text(entry.image[0]) : text(entry.image);
	const fields: CharacterFields = {
		id: text(entry.id),
		name: text(entry.name),
		team,
		ability: text(entry.ability),
		flavor: text(entry.flavor),
		image,
		reminders: list(entry.reminders),
		remindersGlobal: list(entry.remindersGlobal),
		firstNightReminder: text(entry.firstNightReminder),
		otherNightReminder: text(entry.otherNightReminder)
	};
	const firstNight = num(entry.firstNight);
	if (firstNight !== undefined) fields.firstNight = firstNight;
	const otherNight = num(entry.otherNight);
	if (otherNight !== undefined) fields.otherNight = otherNight;
	// Only kept when it differs from what the ability says, so editing the text still updates it.
	const setup = entry.setup === true;
	if (setup !== (bracketText(fields.ability) !== undefined)) fields.setup = setup;
	return fields;
}

export type CharacterProblem =
	| { kind: 'name-missing' }
	| { kind: 'ability-missing' }
	| { kind: 'id-invalid'; id: string }
	/** Not an error: a script's own version replaces the official character. */
	| { kind: 'id-official'; id: string };

/** What stops the character being saved, or is worth knowing first. */
export function characterProblems(fields: CharacterFields, data?: GameData): CharacterProblem[] {
	const problems: CharacterProblem[] = [];
	if (!fields.name.trim()) problems.push({ kind: 'name-missing' });
	if (!fields.ability.trim()) problems.push({ kind: 'ability-missing' });
	const id = fieldsId(fields);
	if (fields.name.trim() && !CHARACTER_ID_PATTERN.test(id)) {
		problems.push({ kind: 'id-invalid', id });
	} else if (id && data?.byId.has(id)) {
		problems.push({ kind: 'id-official', id });
	}
	return problems;
}

/** Problems that stop saving (an official id only warns). */
export function blocksSaving(problems: readonly CharacterProblem[]): boolean {
	return problems.some((p) => p.kind !== 'id-official');
}

/**
 * The character as the app shows it, for the builder's preview, even before it has a name
 * or an ability (a saved one is read back by the script loader instead).
 */
export function previewCharacter(fields: CharacterFields): Character {
	const entry = characterEntry(fields);
	const character: Character = {
		id: (entry.id as string) || 'custom',
		name: fields.name.trim() as CharacterName,
		type: fields.team,
		ability: fields.ability.trim(),
		setup: changesSetup(fields),
		reminders: words(fields.reminders) as ReminderLabel[],
		remindersGlobal: words(fields.remindersGlobal) as ReminderLabel[],
		special: []
	};
	if (typeof entry.flavor === 'string') character.flavor = entry.flavor;
	if (typeof entry.image === 'string') character.image = entry.image;
	if (typeof entry.firstNightReminder === 'string') {
		character.firstNightReminder = entry.firstNightReminder;
	}
	if (typeof entry.otherNightReminder === 'string') {
		character.otherNightReminder = entry.otherNightReminder;
	}
	if (typeof entry.firstNight === 'number') character.firstNight = entry.firstNight;
	if (typeof entry.otherNight === 'number') character.otherNight = entry.otherNight;
	return character;
}
