/**
 * Setup check: given the player count and the characters chosen, what counts the setup
 * sheet and the [bracketed] setup modifiers expect, and what looks off. It only advises;
 * nothing here blocks the Storyteller (04-architecture.md §4: assist, never rule).
 *
 * https://wiki.bloodontheclocktower.com/Setup
 */
import { isNotDealt } from './bag-characters.ts';
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import { SEATED_TYPES, splitPlayers, type SeatedType, type TypeCounts } from './distribution.ts';
import { setupModifierFor, type CountOp, type SetupModifier } from './setup-modifiers.ts';

export interface SetupInput {
	/** Everyone playing, Travellers included. */
	players: number;
	/** Players who are Travellers. Defaults to everyone beyond 15. */
	travellers?: number;
	/**
	 * Characters chosen for this game: dealt characters, plus any Travellers, Fabled and
	 * Loric in play (those take no part in the counts but can carry setup modifiers).
	 * A character listed twice is two copies (Village Idiot, Legion).
	 */
	inPlay: readonly Character[];
	/** Looks up a character by name, so homebrew "+the King" text can be resolved. */
	findByName?: (name: string) => CharacterId | undefined;
	/** Looks up a character by id, for requirements such as Huntsman → Damsel. */
	findById?: (id: CharacterId) => Character | undefined;
}

export interface AppliedModifier extends SetupModifier {
	name: string;
	/** "Baron: +2 Outsiders". */
	explanation: string;
}

export type SetupWarningCode =
	| 'player-count'
	| 'count-mismatch'
	| 'total-mismatch'
	| 'missing-required'
	| 'duplicate'
	| 'unread-setup-text';

export interface SetupWarning {
	code: SetupWarningCode;
	message: string;
	characters?: CharacterId[];
}

export interface SetupAnalysis {
	players: number;
	/** Players dealt a character from the bag. */
	dealt: number;
	travellers: number;
	/** The setup sheet's counts for `dealt` players. */
	base: TypeCounts;
	/** Every count the modifiers allow, per type, ascending. One value when fixed. */
	expected: Record<SeatedType, number[]>;
	/** Counts of the chosen dealt characters, by type. */
	chosen: TypeCounts;
	/**
	 * Chosen characters no player is dealt (Lil' Monsta). Their setup change still applies,
	 * but they are not counted in `chosen`.
	 */
	notDealt: CharacterId[];
	modifiers: AppliedModifier[];
	warnings: SetupWarning[];
	/** Setup notes from the modifiers (bag contents, seating), "Baron: …". */
	notes: string[];
}

const TYPE_LABEL: Record<SeatedType, [string, string]> = {
	townsfolk: ['Townsfolk', 'Townsfolk'],
	outsider: ['Outsider', 'Outsiders'],
	minion: ['Minion', 'Minions'],
	demon: ['Demon', 'Demons']
};

function plural(type: SeatedType, n: number): string {
	return `${n} ${TYPE_LABEL[type][n === 1 ? 0 : 1]}`;
}

function listValues(values: readonly number[]): string {
	if (values.length === 0) return 'none possible';
	if (values.length > 2 && values.every((v, i) => i === 0 || v === values[i - 1] + 1)) {
		return `${values[0]}–${values[values.length - 1]}`;
	}
	return values.length === 1
		? String(values[0])
		: `${values.slice(0, -1).join(', ')} or ${values.at(-1)}`;
}

function isDealt(type: Character['type']): type is SeatedType {
	return (SEATED_TYPES as readonly string[]).includes(type);
}

/** Minkowski sum of a set of counts and a set of deltas. */
function addAll(a: ReadonlySet<number>, b: readonly number[]): Set<number> {
	const out = new Set<number>();
	for (const x of a) for (const y of b) out.add(x + y);
	return out;
}

export function analyseSetup(input: SetupInput): SetupAnalysis {
	const split = splitPlayers(input.players, input.travellers);
	const { dealt } = split;
	const warnings: SetupWarning[] = split.warnings.map((message) => ({
		code: 'player-count',
		message
	}));
	const notes: string[] = [];

	// Modifiers: one per distinct character (a second Village Idiot does not add more).
	const modifiers: AppliedModifier[] = [];
	const seenIds = new Set<CharacterId>();
	const inPlayIds = new Set(input.inPlay.map((c) => c.id));
	for (const character of input.inPlay) {
		if (seenIds.has(character.id)) continue;
		seenIds.add(character.id);
		const modifier = setupModifierFor(character, input.findByName);
		if (!modifier) continue;
		const applied: AppliedModifier = {
			...modifier,
			name: character.name,
			explanation: `${character.name}: ${modifier.summary}`
		};
		modifiers.push(applied);
		for (const note of modifier.notes) notes.push(`${character.name}: ${note}`);
		if (modifier.source === 'ability-text' && modifier.ops.length === 0 && !modifier.requires) {
			warnings.push({
				code: 'unread-setup-text',
				message: `${character.name} has setup text this app could not read: “${modifier.summary}”. Adjust the counts by hand.`,
				characters: [character.id]
			});
		}
	}

	// Collect ops by type; deltas add up, sets replace, `any` frees the count.
	const deltas: Record<SeatedType, number[][]> = {
		townsfolk: [],
		outsider: [],
		minion: [],
		demon: []
	};
	const sets: Partial<Record<SeatedType, Set<number>>> = {};
	const free = new Set<SeatedType>();
	const applyOp = (op: CountOp) => {
		if (op.kind === 'delta') deltas[op.type].push([...op.values]);
		else if (op.kind === 'any') free.add(op.type);
		else {
			const values =
				op.values === 'most'
					? Array.from(
							{ length: Math.max(0, dealt - Math.floor(dealt / 2) - 1) },
							(_, i) => Math.floor(dealt / 2) + 1 + i
						)
					: op.values;
			const prev = sets[op.type];
			sets[op.type] = new Set(prev ? values.filter((v) => prev.has(v)) : values);
		}
	};
	for (const modifier of modifiers) {
		modifier.ops.forEach(applyOp);
		if (modifier.requires && !inPlayIds.has(modifier.requires)) {
			const required = input.findById?.(modifier.requires);
			const name = required?.name ?? modifier.requires;
			warnings.push({
				code: 'missing-required',
				message: `${modifier.name} needs the ${name} in play: swap a Townsfolk for the ${name}.`,
				characters: [modifier.id, modifier.requires]
			});
		}
		if (modifier.requires) {
			// The required character replaces a Townsfolk when it is not already in play.
			const type = input.findById?.(modifier.requires)?.type;
			if (type && type !== 'townsfolk' && isDealt(type))
				applyOp({ kind: 'delta', type, values: [0, 1] });
		}
	}

	const expected = {} as Record<SeatedType, number[]>;
	for (const type of ['outsider', 'minion', 'demon'] as const) {
		let values: Set<number>;
		if (free.has(type)) values = new Set(Array.from({ length: dealt + 1 }, (_, i) => i));
		else {
			values = sets[type] ?? new Set([split.counts[type]]);
			for (const d of deltas[type]) values = addAll(values, d);
		}
		expected[type] = [...values]
			.map((v) => Math.max(0, v))
			.filter((v, i, a) => a.indexOf(v) === i && v <= dealt);
		expected[type].sort((a, b) => a - b);
		if (expected[type].length === 0) expected[type] = [0];
	}
	// Townsfolk fill the remaining seats.
	const townsfolk = new Set<number>();
	for (const o of expected.outsider)
		for (const m of expected.minion)
			for (const d of expected.demon) {
				const t = dealt - o - m - d;
				if (t >= 0) townsfolk.add(t);
			}
	expected.townsfolk = [...townsfolk].sort((a, b) => a - b);
	if (expected.townsfolk.length === 0) expected.townsfolk = [0];

	// What was chosen.
	const chosen: TypeCounts = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
	const copies = new Map<CharacterId, number>();
	const notDealt: CharacterId[] = [];
	for (const character of input.inPlay) {
		if (!isDealt(character.type)) continue;
		// Chosen but never dealt to a player, with no stand-in token: nobody is the Lil' Monsta,
		// a Minion babysits it (https://wiki.bloodontheclocktower.com/Lil%27_Monsta).
		if (isNotDealt(character)) {
			if (!notDealt.includes(character.id)) notDealt.push(character.id);
			continue;
		}
		chosen[character.type]++;
		copies.set(character.id, (copies.get(character.id) ?? 0) + 1);
	}
	const total = SEATED_TYPES.reduce((sum, type) => sum + chosen[type], 0);
	const anyChosen = total > 0;

	if (anyChosen) {
		for (const type of SEATED_TYPES) {
			if (expected[type].includes(chosen[type])) continue;
			const because = modifiers
				.filter((m) => m.ops.some((op) => op.type === type))
				.map((m) => m.explanation);
			warnings.push({
				code: 'count-mismatch',
				message: `${plural(type, chosen[type])} chosen; expected ${listValues(expected[type])} for ${dealt} players${because.length ? ` (${because.join('; ')})` : ''}.`
			});
		}
		if (total !== dealt) {
			warnings.push({
				code: 'total-mismatch',
				message: `${total} characters chosen for ${dealt} players${split.travellers ? ` (plus ${split.travellers} Traveller${split.travellers === 1 ? '' : 's'})` : ''}.`
			});
		}
	}

	const duplicatesAllowed = (c: Character) =>
		c.special.some(
			(s) => s.type === 'selection' && (s.name === 'bag-duplicate' || s.name.endsWith('-duplicate'))
		) || input.inPlay.some((p) => p.special.some((s) => s.name === 'good-duplicate'));
	for (const [id, n] of copies) {
		if (n < 2) continue;
		const character = input.inPlay.find((c) => c.id === id)!;
		if (!duplicatesAllowed(character)) {
			warnings.push({
				code: 'duplicate',
				message: `${character.name} is chosen ${n} times.`,
				characters: [id]
			});
		}
	}

	return {
		players: split.dealt + split.travellers,
		dealt,
		travellers: split.travellers,
		base: split.counts,
		expected,
		chosen,
		notDealt,
		modifiers,
		warnings,
		notes
	};
}
