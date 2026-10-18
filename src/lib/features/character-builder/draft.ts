/**
 * The character on the Character builder, kept on this device so leaving the page loses
 * nothing. Versioned, because a newer build can read a draft an older one wrote (CLAUDE.md).
 */
import { CHARACTER_TYPES, type CharacterType } from '#lib/core/data/index.ts';
import { emptyCharacterFields, type CharacterFields } from '#lib/core/rules/character-builder.ts';

export const CHARACTER_DRAFT_VERSION = 1;

export interface CharacterDraft {
	version: typeof CHARACTER_DRAFT_VERSION;
	fields: CharacterFields;
	/** The saved character this draft edits; saving replaces it. */
	editing?: string;
}

export function emptyCharacterDraft(): CharacterDraft {
	return { version: CHARACTER_DRAFT_VERSION, fields: emptyCharacterFields() };
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const texts = (value: unknown) =>
	Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
const position = (value: unknown) =>
	typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

/** A stored draft, or an empty one when missing, damaged or from a newer build. */
export function parseCharacterDraft(raw: unknown): CharacterDraft {
	if (!isObject(raw) || raw.version !== CHARACTER_DRAFT_VERSION || !isObject(raw.fields)) {
		return emptyCharacterDraft();
	}
	const f = raw.fields;
	const team: CharacterType = CHARACTER_TYPES.find((t) => t === f.team) ?? 'townsfolk';
	const fields: CharacterFields = {
		id: text(f.id),
		name: text(f.name),
		team,
		ability: text(f.ability),
		flavor: text(f.flavor),
		image: text(f.image),
		reminders: texts(f.reminders),
		remindersGlobal: texts(f.remindersGlobal),
		firstNightReminder: text(f.firstNightReminder),
		otherNightReminder: text(f.otherNightReminder)
	};
	const firstNight = position(f.firstNight);
	if (firstNight !== undefined) fields.firstNight = firstNight;
	const otherNight = position(f.otherNight);
	if (otherNight !== undefined) fields.otherNight = otherNight;
	if (typeof f.setup === 'boolean') fields.setup = f.setup;
	return {
		version: CHARACTER_DRAFT_VERSION,
		fields,
		...(typeof raw.editing === 'string' ? { editing: raw.editing } : {})
	};
}

export function isEmptyCharacterDraft(draft: CharacterDraft): boolean {
	const f = draft.fields;
	return (
		!f.name.trim() &&
		!f.ability.trim() &&
		!f.flavor.trim() &&
		!f.image.trim() &&
		!f.id.trim() &&
		f.reminders.length === 0 &&
		f.remindersGlobal.length === 0 &&
		!f.firstNightReminder.trim() &&
		!f.otherNightReminder.trim()
	);
}
