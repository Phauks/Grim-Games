/**
 * Setup modifiers: characters whose [bracketed] ability text changes which characters are
 * dealt. Brackets only matter during setup, not when a character changes mid-game
 * (https://wiki.bloodontheclocktower.com/Abilities, https://wiki.bloodontheclocktower.com/Setup).
 *
 * Each character's change is the `setupModifier` key of its rules block (our overlay files for
 * official characters, or a custom character's own `rules`; `data/setup-modifier-rules.ts`).
 * Characters without one fall back to reading the bracket text, flagged as auto-detected.
 * The reminder text is our own words.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CountOp, SetupModifierRules } from '#lib/core/data/setup-modifier-rules.ts';
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import { SEATED_TYPES, type SeatedType } from './distribution.ts';

export type { CountOp };

export interface SetupModifier {
	id: CharacterId;
	/** Short summary in our words: "+2 Outsiders". Shown as "Baron: +2 Outsiders". */
	summary: string;
	ops: readonly CountOp[];
	/**
	 * Another character that must be in play because of this one ("+the Damsel"). If it is
	 * not already in play it replaces a Townsfolk, so the setup analysis allows one more of
	 * its type.
	 */
	requires?: CharacterId;
	/**
	 * Extra copies of this same character that may go in the bag ("+0 to +2 Legionary" is
	 * `[0, 1, 2]`). Read from homebrew text only; official characters with copies (Village
	 * Idiot, Legion) say so in TPI's `special` data instead.
	 */
	copies?: readonly number[];
	/** Extra Storyteller notes for setup (bag contents, seating), in our words. */
	notes: readonly string[];
	/** Wiki page this entry encodes; none for homebrew characters. */
	wiki?: string;
	/** `table` for a rules block's entry; `ability-text` when read from the [bracketed] text. */
	source: 'table' | 'ability-text';
}

const delta = (type: SeatedType, ...values: number[]): CountOp => ({ kind: 'delta', type, values });
const set = (type: SeatedType, ...values: number[]): CountOp => ({ kind: 'set', type, values });
const any = (type: SeatedType): CountOp => ({ kind: 'any', type });

/** The setup modifier for a character, from the table or else its [bracketed] text. */
export function setupModifierFor(
	character: Character,
	findByName?: (name: string) => CharacterId | undefined
): SetupModifier | undefined {
	const own = character.rules?.setupModifier;
	const official = rulesOf(character.id)?.setupModifier;
	// A homebrew character that reuses an official id but changes the text is read from text.
	const entry =
		own ??
		(official && (character.edition !== undefined || !bracketText(character.ability))
			? official
			: undefined);
	if (!entry) return modifierFromText(character, findByName);
	// A character carrying the script's own rules (the Bootlegger, script-rules.ts): a bracket
	// there, such as Binary Supernovae's "[+1 Demon]", changes setup as a homebrew one's does.
	if (entry.readsBrackets && bracketText(character.ability)) {
		const fromText = modifierFromText(character, findByName);
		if (fromText) return { ...fromText, notes: [...(entry.notes ?? []), ...fromText.notes] };
	}
	return fromRules(character, entry);
}

function fromRules(character: Character, entry: SetupModifierRules): SetupModifier {
	const wiki = wikiUrl(character);
	return {
		id: character.id,
		summary: entry.summary,
		ops: entry.ops,
		...(entry.requires ? { requires: entry.requires } : {}),
		notes: entry.notes ?? [],
		...(wiki ? { wiki } : {}),
		source: 'table'
	};
}

/** The [bracketed] parts of an ability, joined. */
export function bracketText(ability: string): string | undefined {
	const parts = [...ability.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
	return parts.length > 0 ? parts.join('. ') : undefined;
}

const TYPE_WORDS: Record<string, SeatedType> = {
	townsfolk: 'townsfolk',
	outsider: 'outsider',
	outsiders: 'outsider',
	minion: 'minion',
	minions: 'minion',
	demon: 'demon',
	demons: 'demon'
};

/**
 * Reads count changes from bracket text such as "+2 Outsiders", "-1 or +1 Outsider",
 * "+0 to +2 Townsfolk", "-? to +? Outsiders", "No Demon", "+the Damsel". Anything it cannot
 * read becomes a note asking the Storyteller to check, so it never guesses silently.
 */
export function modifierFromText(
	character: Character,
	findByName?: (name: string) => CharacterId | undefined
): SetupModifier | undefined {
	const text = bracketText(character.ability);
	if (!text) return undefined;
	const ops: CountOp[] = [];
	const notes: string[] = [];
	let requires: CharacterId | undefined;
	let copies: readonly number[] | undefined;
	const clean = text.replace(/[−–]/g, '-');

	for (const clause of clean
		.split(/[.;,]/)
		.map((c) => c.trim())
		.filter(Boolean)) {
		let m: RegExpExecArray | null;
		if ((m = /^([+-]\s*\d+)\s*(or|to)\s*([+-]?\s*\d+)\s+(\w+)$/i.exec(clause))) {
			const type = TYPE_WORDS[m[4].toLowerCase()];
			const aRaw = m[1].replace(/\s/g, '');
			const bRaw = m[3].replace(/\s/g, '');
			const a = Number(aRaw) || 0;
			// An unsigned second number takes the first one's sign ("-0 or 1" means −0 or −1).
			const b = /^[+-]/.test(bRaw) || !aRaw.startsWith('-') ? Number(bRaw) : -Number(bRaw);
			if (type) {
				const values =
					m[2].toLowerCase() === 'or'
						? [a, b]
						: Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i);
				ops.push(delta(type, ...values));
				continue;
			}
		}
		if ((m = /^([+-]\s*\d+)\s+(\w+)$/i.exec(clause))) {
			const type = TYPE_WORDS[m[2].toLowerCase()];
			if (type) {
				ops.push(delta(type, Number(m[1].replace(/\s/g, ''))));
				continue;
			}
		}
		if (
			(m = /^[+-]\s*\?\s*to\s*[+-]\s*\?\s+(\w+)$/i.exec(clause)) ||
			(m = /^x\s+(\w+)$/i.exec(clause))
		) {
			const type = TYPE_WORDS[m[1].toLowerCase()];
			if (type) {
				ops.push(any(type));
				continue;
			}
		}
		if ((m = /^no\s+(\w+)$/i.exec(clause))) {
			const word = m[1].toLowerCase();
			const type = TYPE_WORDS[word];
			if (type) {
				ops.push(set(type, 0));
				continue;
			}
		}
		// "+the King", "+ Spartacus", "+1 Hannibal", "+0 to +2 Legionary": another character
		// that must be in play, or more copies of this one.
		if ((m = /^\+\s*(?:(\d+)(?:\s*(or|to)\s*\+?\s*(\d+))?\s+)?(?:the\s+)?(.+)$/i.exec(clause))) {
			const a = Number(m[1] ?? 1);
			const b = m[3] === undefined ? a : Number(m[3]);
			const values =
				m[2]?.toLowerCase() === 'to'
					? Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i)
					: [...new Set([a, b])];
			const rest = selfReference(character.name, m[4]);
			if (rest !== undefined) {
				copies = values;
				if (
					(SEATED_TYPES as readonly string[]).includes(character.type) &&
					character.type !== 'townsfolk'
				) {
					ops.push(delta(character.type as SeatedType, ...values));
				}
				if (rest) notes.push(`Check the setup text by hand: “${clause}”.`);
				continue;
			}
			const id = findByName?.(m[4]);
			if (id && id !== character.id && values.length === 1 && values[0] === 1) {
				requires = id;
				continue;
			}
		}
		notes.push(`Check the setup text by hand: “${clause}”.`);
	}
	return {
		id: character.id,
		summary: text,
		ops,
		...(requires ? { requires } : {}),
		...(copies ? { copies } : {}),
		notes,
		...(wikiUrl(character) ? { wiki: wikiUrl(character) } : {}),
		source: 'ability-text'
	};
}

/**
 * Whether `text` names the character itself ("Legionary", "Legionaries"), maybe followed by
 * more words ("Mercenary of opposing alignment"). Returns those extra words ('' for none),
 * or undefined when the text names something else.
 */
function selfReference(name: string, text: string): string | undefined {
	const own = name.trim().toLowerCase();
	const forms = [own, `${own}s`, own.replace(/y$/, 'ies')];
	const t = text.trim().toLowerCase();
	for (const form of forms) {
		if (t === form) return '';
		if (t.startsWith(`${form} `)) return t.slice(form.length + 1);
	}
	return undefined;
}
