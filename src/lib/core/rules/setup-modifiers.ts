/**
 * Setup modifiers: characters whose [bracketed] ability text changes which characters are
 * dealt. Brackets only matter during setup, not when a character changes mid-game
 * (https://wiki.bloodontheclocktower.com/Abilities, https://wiki.bloodontheclocktower.com/Setup).
 *
 * Official characters use the explicit table below, each entry citing its wiki page.
 * Homebrew characters (and any official character missing from the table) fall back to
 * reading the bracket text, flagged as auto-detected. The reminder text is our own words.
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { SeatedType } from './distribution.ts';

/**
 * One change to the count of a character type:
 * - `delta`: add one of these values ("+0 or +1" is `[0, 1]`);
 * - `set`: the count becomes one of these values ("[No Demon]" is `[0]`);
 * - `any`: the Storyteller picks freely ("-? to +? Outsiders").
 */
export type CountOp =
	| { kind: 'delta'; type: SeatedType; values: readonly number[] }
	| { kind: 'set'; type: SeatedType; values: readonly number[] | 'most' }
	| { kind: 'any'; type: SeatedType };

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
	/** Extra Storyteller notes for setup (bag contents, seating), in our words. */
	notes: readonly string[];
	/** Wiki page this entry encodes; none for homebrew characters. */
	wiki?: string;
	/** `table` for curated entries; `ability-text` when read from the [bracketed] text. */
	source: 'table' | 'ability-text';
}

const WIKI = 'https://wiki.bloodontheclocktower.com/';

const delta = (type: SeatedType, ...values: number[]): CountOp => ({ kind: 'delta', type, values });
const set = (type: SeatedType, ...values: number[]): CountOp => ({ kind: 'set', type, values });
const any = (type: SeatedType): CountOp => ({ kind: 'any', type });

type Entry = Omit<SetupModifier, 'id' | 'source' | 'notes'> & { notes?: readonly string[] };

/**
 * Curated setup modifiers, keyed by TPI id. Every official character with `setup: true` in
 * `roles.json` has an entry (tested), plus characters that change the bag without the flag
 * (Lunatic, Riot).
 */
const TABLE: Readonly<Record<CharacterId, Entry>> = {
	baron: { summary: '+2 Outsiders', ops: [delta('outsider', 2)], wiki: `${WIKI}Baron` },
	godfather: {
		summary: '−1 or +1 Outsider',
		ops: [delta('outsider', -1, 1)],
		wiki: `${WIKI}Godfather`
	},
	fanggu: { summary: '+1 Outsider', ops: [delta('outsider', 1)], wiki: `${WIKI}Fang_Gu` },
	vigormortis: {
		summary: '−1 Outsider',
		ops: [delta('outsider', -1)],
		notes: ['With no Outsiders to remove, nothing changes.'],
		wiki: `${WIKI}Vigormortis`
	},
	balloonist: {
		summary: '+0 or +1 Outsider',
		ops: [delta('outsider', 0, 1)],
		wiki: `${WIKI}Balloonist`
	},
	hermit: {
		summary: '−0 or −1 Outsider',
		ops: [delta('outsider', 0, -1)],
		notes: ['The Hermit counts as one of the Outsiders and may be the one removed.'],
		wiki: `${WIKI}Hermit`
	},
	huntsman: {
		summary: '+the Damsel',
		ops: [],
		requires: 'damsel',
		notes: ['If the Damsel is not already in play, swap a Townsfolk for the Damsel.'],
		wiki: `${WIKI}Huntsman`
	},
	choirboy: {
		summary: '+the King',
		ops: [],
		requires: 'king',
		notes: ['If the King is not already in play, swap a Townsfolk for the King.'],
		wiki: `${WIKI}Choirboy`
	},
	villageidiot: {
		summary: '+0 to +2 Village Idiots',
		ops: [],
		notes: [
			'Up to 2 more Village Idiots replace Townsfolk.',
			'If there are extras, choose one Village Idiot to be drunk.'
		],
		wiki: `${WIKI}Village_Idiot`
	},
	bountyhunter: {
		summary: '1 Townsfolk is evil',
		ops: [],
		notes: ['Turn one Townsfolk evil during setup.'],
		wiki: `${WIKI}Bounty_Hunter`
	},
	atheist: {
		summary: 'No evil characters',
		ops: [set('minion', 0), set('demon', 0), any('outsider')],
		notes: ['Take out every Minion and Demon; fill with any mix of Townsfolk and Outsiders.'],
		wiki: `${WIKI}Atheist`
	},
	xaan: {
		summary: 'X Outsiders',
		ops: [any('outsider')],
		notes: ['Choose any number of Outsiders; that number is X, the night the Xaan acts.'],
		wiki: `${WIKI}Xaan`
	},
	marionette: {
		summary: 'Neighbours the Demon',
		ops: [],
		notes: [
			'Put a Townsfolk in the bag instead of the Marionette.',
			'Seat the Marionette next to the Demon.'
		],
		wiki: `${WIKI}Marionette`
	},
	summoner: {
		summary: 'No Demon',
		ops: [set('demon', 0)],
		notes: ['Put a Townsfolk in the bag instead of the Demon.'],
		wiki: `${WIKI}Summoner`
	},
	lilmonsta: {
		summary: '+1 Minion',
		ops: [set('demon', 0), delta('minion', 1)],
		notes: ['Lil’ Monsta is not dealt: an extra Minion goes in the bag instead.'],
		wiki: `${WIKI}Lil%27_Monsta`
	},
	kazali: {
		summary: 'Chooses the Minions; −? to +? Outsiders',
		ops: [set('minion', 0), any('outsider')],
		notes: [
			'Deal no Minions: good characters take their place.',
			'On the first night the Kazali turns players into the usual number of Minions.'
		],
		wiki: `${WIKI}Kazali`
	},
	legion: {
		summary: 'Most players are Legion',
		ops: [{ kind: 'set', type: 'demon', values: 'most' }, set('minion', 0), any('outsider')],
		notes: ['More than half the players are Legion; the rest are good.'],
		wiki: `${WIKI}Legion`
	},
	lordoftyphon: {
		summary: '+1 Minion; −? to +? Outsiders',
		ops: [delta('minion', 1), any('outsider')],
		notes: ['Seat all evil players in a row with the Lord of Typhon inside it, not at an end.'],
		wiki: `${WIKI}Lord_of_Typhon`
	},
	riot: {
		summary: 'No setup change',
		ops: [],
		notes: [
			'Deal Minions as usual: they become Riot on day 3. Older printings had a setup bracket.'
		],
		wiki: `${WIKI}Riot`
	},
	drunk: {
		summary: 'Shown a Townsfolk',
		ops: [],
		notes: ['Put a Townsfolk in the bag instead of the Drunk.'],
		wiki: `${WIKI}Drunk`
	},
	lunatic: {
		summary: 'Shown a Demon',
		ops: [],
		notes: ['The Lunatic is shown a Demon token, not the Lunatic.'],
		wiki: `${WIKI}Lunatic`
	},
	sentinel: {
		summary: '±1 Outsider',
		ops: [delta('outsider', -1, 0, 1)],
		wiki: `${WIKI}Sentinel`
	},
	deusexfiasco: {
		summary: 'No setup change',
		ops: [],
		notes: ['Plan the mistake you will make and admit to.'],
		wiki: `${WIKI}Deus_ex_Fiasco`
	},
	bootlegger: {
		summary: 'Homebrew rules',
		ops: [],
		notes: ['Explain the homebrew characters and rules before the game.'],
		wiki: `${WIKI}Bootlegger`
	},
	gardener: {
		summary: 'Storyteller assigns characters',
		ops: [],
		notes: ['No bag: the Storyteller chooses each player’s character.'],
		wiki: `${WIKI}Gardener`
	},
	pope: {
		summary: 'Duplicate good characters',
		ops: [],
		notes: ['Good characters may appear more than once, and may be bluffs too.'],
		wiki: `${WIKI}Pope`
	},
	tor: {
		summary: 'Characters are hidden',
		ops: [],
		notes: ['Players do not see their character or alignment until they die.'],
		wiki: `${WIKI}Tor`
	}
};

/** Ids with a curated entry. */
export const CURATED_SETUP_IDS: readonly CharacterId[] = Object.keys(TABLE);

/** The setup modifier for a character, from the table or else its [bracketed] text. */
export function setupModifierFor(
	character: Character,
	findByName?: (name: string) => CharacterId | undefined
): SetupModifier | undefined {
	const entry = TABLE[character.id];
	// A homebrew character that reuses an official id but changes the text is read from text.
	if (entry && (character.edition !== undefined || !bracketText(character.ability))) {
		return { id: character.id, source: 'table', notes: [], ...entry };
	}
	return modifierFromText(character, findByName);
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
		if ((m = /^\+\s*the\s+(.+)$/i.exec(clause))) {
			const id = findByName?.(m[1]);
			if (id) {
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
		notes,
		...(wikiUrl(character) ? { wiki: wikiUrl(character) } : {}),
		source: 'ability-text'
	};
}
