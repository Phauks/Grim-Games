/**
 * The standard parts of an ability, for the Character builder (Trevor, 2026-10-18: "use [the
 * Standard Amy Order] as a basis so that creating ability has certain standard parts, rather
 * than being full custom (although still allow that)").
 *
 * An ability is still one piece of TPI-format text. This reads it as:
 * - its opening: the Sort Order phrase it starts with ("Each night*", "You start knowing"),
 *   from `SORT_ORDER_PHRASES`;
 * - the rest of the sentence, the user's own;
 * - its setup changes: the [bracketed] clauses, written as TPI writes them ("+2 Outsiders",
 *   "-1 or +1 Outsider", "No Demon", "+the King"), so `modifierFromText` reads them back
 *   for setup and the bag.
 * Changing a part rewrites only that part of the text; anything typed by hand stays.
 */
import { SORT_ORDER_PHRASES } from '#lib/core/data/sort-order.ts';
import type { CharacterId, CharacterName } from '#lib/core/data/types.ts';
import { SEATED_TYPES, type SeatedType } from './distribution.ts';

/** One clause of the setup bracket. */
export type SetupPart =
	/** "+2 Outsiders", "-1 or +1 Outsider", "+0 to +2 Townsfolk". `to` is the second number. */
	| { kind: 'count'; type: SeatedType; from: number; to?: number; join?: 'or' | 'to' }
	/** "-? to +? Outsiders": the Storyteller picks how many. */
	| { kind: 'any'; type: SeatedType }
	/** "No Demon". */
	| { kind: 'none'; type: SeatedType }
	/** "+0 to +2 Village Idiots": more copies of this same character. */
	| { kind: 'copies'; from: number; to: number }
	/** "+the King": another character that must be in play. */
	| { kind: 'character'; id: CharacterId; name: CharacterName }
	/** Any other clause, kept as typed ("1 Townsfolk is evil"). */
	| { kind: 'text'; text: string };

export type SetupPartKind = SetupPart['kind'];

const NAMES: Record<SeatedType, [one: string, many: string]> = {
	townsfolk: ['Townsfolk', 'Townsfolk'],
	outsider: ['Outsider', 'Outsiders'],
	minion: ['Minion', 'Minions'],
	demon: ['Demon', 'Demons']
};

const TYPE_WORDS: Record<string, SeatedType> = Object.fromEntries(
	SEATED_TYPES.flatMap((type) => NAMES[type].map((word) => [word.toLowerCase(), type]))
);

/** TPI writes curly quotes and true minus signs in places; compare them as plain ones. */
const plain = (text: string) => text.replace(/[“”]/g, '"').replace(/[−–]/g, '-');

/** "+2", "-1"; a zero takes the sign of the number it is paired with ("-0 or -1"). */
function signed(n: number, pair?: number): string {
	if (n < 0) return `-${-n}`;
	if (n === 0 && pair !== undefined && pair < 0) return '-0';
	return `+${n}`;
}

function plural(name: string): string {
	return /[^aeiou]y$/i.test(name) ? `${name.slice(0, -1)}ies` : `${name}s`;
}

/** One clause as TPI writes it. `self` is this character's name, for copies. */
export function setupPartText(part: SetupPart, self: string): string {
	switch (part.kind) {
		case 'count': {
			const values = part.to === undefined ? [part.from] : [part.from, part.to];
			const many = values.some((v) => Math.abs(v) > 1);
			const word = NAMES[part.type][many ? 1 : 0];
			if (part.to === undefined) return `${signed(part.from)} ${word}`;
			return `${signed(part.from, part.to)} ${part.join ?? 'or'} ${signed(part.to, part.from)} ${word}`;
		}
		case 'any':
			return `-? to +? ${NAMES[part.type][1]}`;
		case 'none':
			return `No ${NAMES[part.type][0]}`;
		case 'copies': {
			const name = self.trim() || '?';
			const word = part.to > 1 ? plural(name) : name;
			return part.from === part.to
				? `+${part.from} ${word}`
				: `+${part.from} to +${part.to} ${word}`;
		}
		case 'character':
			return `+the ${part.name}`;
		case 'text':
			return part.text.trim();
	}
}

const signedNumber = (raw: string) => Number(raw.replace(/\s/g, ''));

/** Reads one bracket clause back into a part; anything else stays as text. */
export function readSetupPart(
	clause: string,
	self: string,
	findByName?: (name: string) => { id: CharacterId; name: CharacterName } | undefined
): SetupPart {
	const text = plain(clause).trim();
	let m: RegExpExecArray | null;
	if ((m = /^([+-]\s*\d+)\s+(or|to)\s+([+-]\s*\d+)\s+(\w+)$/i.exec(text))) {
		const type = TYPE_WORDS[m[4].toLowerCase()];
		if (type) {
			const join = m[2].toLowerCase() as 'or' | 'to';
			return { kind: 'count', type, from: signedNumber(m[1]), to: signedNumber(m[3]), join };
		}
	}
	if ((m = /^([+-]\s*\d+)\s+(\w+)$/i.exec(text))) {
		const type = TYPE_WORDS[m[2].toLowerCase()];
		if (type) return { kind: 'count', type, from: signedNumber(m[1]) };
	}
	if ((m = /^-\s*\?\s*to\s*\+\s*\?\s+(\w+)$/i.exec(text))) {
		const type = TYPE_WORDS[m[1].toLowerCase()];
		if (type) return { kind: 'any', type };
	}
	if ((m = /^no\s+(\w+)$/i.exec(text))) {
		const type = TYPE_WORDS[m[1].toLowerCase()];
		if (type) return { kind: 'none', type };
	}
	if ((m = /^\+\s*(\d+)(?:\s+to\s+\+\s*(\d+))?\s+(.+)$/i.exec(text)) && isSelf(self, m[3])) {
		const from = Number(m[1]);
		return { kind: 'copies', from, to: m[2] === undefined ? from : Number(m[2]) };
	}
	if ((m = /^\+\s*the\s+(.+)$/i.exec(text))) {
		const found = findByName?.(m[1]);
		if (found) return { kind: 'character', id: found.id, name: found.name };
	}
	return { kind: 'text', text: clause.trim() };
}

function isSelf(self: string, text: string): boolean {
	const own = self.trim().toLowerCase();
	const t = text.trim().toLowerCase();
	return !!own && (t === own || t === plural(own));
}

const BRACKET = /\s*\[([^\]]*)\]\s*$/;

export interface AbilityParts {
	/** The Sort Order phrase it opens with; '' when it opens with none of them. */
	opening: string;
	/** Everything after the opening, before the setup bracket. */
	rest: string;
	setup: SetupPart[];
}

/** The longest Sort Order phrase the text starts with, ending at a word boundary. */
export function openingPhrase(text: string): string {
	const t = plain(text);
	let best = '';
	for (const phrase of SORT_ORDER_PHRASES) {
		if (!t.startsWith(phrase) || /[A-Za-z0-9]/.test(t.charAt(phrase.length))) continue;
		if (phrase.length > best.length) best = phrase;
	}
	return best;
}

/** Splits an ability into its parts. The trailing [bracket] is the setup. */
export function readAbility(
	ability: string,
	self: string,
	findByName?: (name: string) => { id: CharacterId; name: CharacterName } | undefined
): AbilityParts {
	const match = BRACKET.exec(ability);
	const body = match ? ability.slice(0, match.index) : ability;
	const setup = match
		? match[1]
				.split(/\.\s+|\.$|;\s*/)
				.map((c) => c.trim())
				.filter(Boolean)
				.map((c) => readSetupPart(c, self, findByName))
		: [];
	const opening = openingPhrase(body);
	return { opening, rest: body.slice(opening.length), setup };
}

/** Puts the parts back together as one ability. */
export function writeAbility(parts: AbilityParts, self: string): string {
	const rest = parts.opening && /^[A-Za-z0-9]/.test(parts.rest) ? ` ${parts.rest}` : parts.rest;
	const body = `${parts.opening}${rest}`.trimEnd();
	const clauses = parts.setup.map((p) => setupPartText(p, self)).filter(Boolean);
	if (clauses.length === 0) return body;
	return `${body}${body ? ' ' : ''}[${clauses.join('. ')}]`;
}

/** The ability with a new opening phrase ('' removes it), the rest kept. */
export function withOpening(ability: string, opening: string, self: string): string {
	return writeAbility({ ...readAbility(ability, self), opening }, self);
}

/** The ability with new setup parts, the text kept. */
export function withSetup(ability: string, setup: SetupPart[], self: string): string {
	return writeAbility({ ...readAbility(ability, self), setup }, self);
}
