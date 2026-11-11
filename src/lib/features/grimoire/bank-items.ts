/**
 * The reminder bank's tokens, left to right (ReminderBank): the setup suggestions still to
 * place, every other reminder still off the board, the generic ∞, the # number token and the
 * game's own ∞ tokens with "+ New token", then the reminders of characters whose players are all dead.
 */
import type { Character, CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
import {
	GENERIC_REMINDER_ID,
	NUMBER_TOKEN_LOOK,
	numberSymbol,
	scriptCharacterIds,
	type CharacterLookup,
	type Game,
	type GenericLook,
	type GenericToken,
	type ReminderId,
	type SeatId
} from '#lib/core/model/index.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { matchesReminderSearch } from '#lib/features/characters/character-search.ts';
import {
	borrowedAbilities,
	reminderHolders
} from '#lib/core/rules/abilities/borrowed-abilities.ts';
import { deadCharacters } from '#lib/core/rules/abilities/dead-characters.ts';
import { bankOwners, bankReminders, byLabel, isGeneric, type StepReminders } from './reminders.ts';
import { pendingSetup, type TrayItem } from './setup-tray.ts';
import type { StepFocus } from './step-focus.svelte.ts';

/**
 * The bank's stretches, left to right (Trevor, 2026-10-19): Setup (what the Storyteller
 * sees first), Reminders, the generic ∞ in a cell of its own, then the reminders of
 * characters whose players are all dead and whose ability ended with them.
 */
export type BankGroup = 'setup' | 'guesses' | 'reminders' | 'generic' | 'dead';
export const BANK_CAPTIONS: Partial<Record<BankGroup, string>> = {
	setup: 'Setup',
	reminders: 'Reminders',
	// Over the generic reminder's cell (Trevor, 2026-10-19).
	generic: '∞',
	dead: 'Dead players'
};

/** One token in the bank: a setup suggestion, or a reminder still off the board. */
export interface BankItem {
	key: string;
	characterId: CharacterId;
	label: ReminderLabel;
	/** Shown once with ×count when "Stack duplicate reminders" is on. */
	count: number;
	setup?: TrayItem;
	/** Whose copy it is, when its character is on more than one seat (`bankOwners`). */
	ownerSeatId?: SeatId;
	/** Used by the walked-through step tonight. */
	now?: boolean;
	/** Its stretch of the bank, each set off by a line. */
	group: BankGroup;
	/** A copy beyond what the game gives, dashed as on the board (Trevor, 2026-10-22). */
	extra?: boolean;
	/** One of the bank's reusable ∞ tokens (plan B9): its copies start with its look. */
	token?: GenericToken;
	/** The "+ New token" cell at the end of the ∞ tokens (plan B9). */
	makesToken?: boolean;
	/** The # token beside the ∞ (plan M35): its copies show a number, starting at 1. */
	number?: boolean;
	/**
	 * A counting run stacked as this one token (plan M53): its labels still in the bank, in
	 * order, `label` the one on top. Held, its pill picks which goes down.
	 */
	run?: ReminderLabel[];
}

/** How a bank token is drawn: an ∞ token's symbol, or the # token's #. */
export function bankFace(item: Pick<BankItem, 'token' | 'number'>): GenericLook {
	if (item.number) return { symbol: '#' };
	const { symbol, symbolColour, symbolFill } = item.token ?? {};
	return { symbol, symbolColour, symbolFill };
}

/**
 * The look a copy of a bank token starts with when no ∞ token gives it one (`tokenId`): the
 * # token's, showing 1 (plan M35) or the number picked in its pill while held (plan M48).
 */
export const bankLook = (
	item: Pick<BankItem, 'number'>,
	number?: number
): GenericLook | undefined =>
	item.number
		? number === undefined
			? NUMBER_TOKEN_LOOK
			: { symbol: numberSymbol(number) }
		: undefined;

/**
 * The generic stretch's tokens every grim has, never used up: the plain ∞, as many as needed
 * (Trevor, 2026-10-18), and the # token, only for numbers (plan M35, Trevor 2026-11-03). The
 * Storyteller's bank and a player's tray (player/PlayerReminderBin) both draw this one list
 * (Trevor, 2026-11-06: no more chasing feature parity), so a token added here reaches both.
 */
export const FIXED_GENERIC_ITEMS: readonly Readonly<BankItem>[] = [
	{ key: 'generic', characterId: GENERIC_REMINDER_ID, label: '', count: 1, group: 'generic' },
	{
		key: 'number',
		characterId: GENERIC_REMINDER_ID,
		label: 'Number' as ReminderLabel,
		count: 1,
		group: 'generic',
		number: true
	}
];

/**
 * The bank's generic stretch: the ∞ and # every grim has, then the grim's own reusable ∞
 * tokens and "+ New token" (plan B9, Trevor 2026-10-23: "Tokens only"). The Storyteller's
 * bank (the game's tokens) and a player's tray (the phone's own) alike.
 */
export function genericStretch(tokens: readonly GenericToken[]): BankItem[] {
	return [
		...FIXED_GENERIC_ITEMS.map((item) => ({ ...item })),
		...tokens.map((token): BankItem => ({
			key: `token:${token.tokenId}`,
			characterId: GENERIC_REMINDER_ID,
			label: (token.note ?? '') as ReminderLabel,
			count: 1,
			group: 'generic',
			token
		})),
		{
			key: 'new-token',
			characterId: GENERIC_REMINDER_ID,
			label: '',
			count: 1,
			group: 'generic',
			makesToken: true
		}
	];
}

/** What a copy of a bank token says: none for an ∞ or # token, whose words are its look. */
export const bankLabel = (item: Pick<BankItem, 'label' | 'token' | 'number'>): ReminderLabel =>
	item.token || item.number ? ('' as ReminderLabel) : item.label;

/**
 * A player's tray (player/PlayerReminderBin), built as the bank is (Trevor, 2026-11-06: "the
 * same components for parity"): the script's reminders, the characters they guessed first
 * (`guesses`), every counting run stacked as one token as in the bank, then the generic
 * stretch with the phone's own ∞ tokens. A player can't know who is in play, so it is the
 * whole script, and nothing is ever used up.
 */
export function playerBankItems(
	characters: readonly Character[],
	guessed: readonly CharacterId[],
	tokens: readonly GenericToken[],
	query = ''
): BankItem[] {
	const lookup: CharacterLookup = new Map(characters.map((c) => [c.id, c]));
	const reminders = characters.flatMap((character) => {
		const labels = [...new Set([...character.reminders, ...character.remindersGlobal])];
		const group: BankGroup = guessed.includes(character.id) ? 'guesses' : 'reminders';
		return labels.sort(byLabel).map((label): BankItem => ({
			// eslint-disable-next-line grim/names-as-badges -- an identity key, never shown
			key: `bank:${character.id}:${label}`,
			characterId: character.id,
			label,
			count: 1,
			group
		}));
	});
	const stacked = bundledCounters(reminders, lookup);
	return searchBank(
		[
			...stacked.filter((i) => i.group === 'guesses'),
			...stacked.filter((i) => i.group === 'reminders'),
			...genericStretch(tokens)
		],
		lookup,
		query
	);
}

/**
 * The tokens a search in the pulled-up tray leaves (both trays' search field): the reminders
 * whose character or words match, never the generic stretch.
 */
export function searchBank(items: BankItem[], characters: CharacterLookup, query: string) {
	if (!query.trim()) return items;
	return items.filter((item) => {
		const character = characters.get(item.characterId);
		if (!character || isGeneric(item)) return false;
		return matchesReminderSearch({ character, labels: [item.label, ...(item.run ?? [])] }, query);
	});
}

export interface BankOptions {
	/** The character whose night step is being walked through. */
	focus: StepReminders | undefined;
	/** How `focus` is shown (step-focus.svelte.ts). */
	focusMode: StepFocus['mode'];
	/** "Stack duplicate reminders": one token with ×count. */
	stack: boolean;
	/** Duplicate copies on the board and in the bank (Grimoire). */
	copies: ReadonlySet<ReminderId>;
	bankCopies: ReadonlyMap<string, number>;
}

/**
 * Each run of counting reminders (`counter` in a character's rules: the Leviathan's Day 1 to
 * Day 5) stacked as one token, its next one still off the board on top, with the rest of the run
 * under it as its count (plan M53, Trevor 2026-11-04: "bundle incrementing reminder tokens
 * together in the bank"; 2026-11-06: stacked on each other in the bin too).
 */
export function bundledCounters(items: BankItem[], characters: CharacterLookup): BankItem[] {
	const run = (item: BankItem) => {
		const tokens = rulesOf(item.characterId, characters)?.counter?.tokens;
		return tokens?.includes(item.label) ? tokens : undefined;
	};
	// The run's earliest token still in the bank, and how many of the run are left, by character.
	const next = new Map<CharacterId, number>();
	const left = new Map<CharacterId, number>();
	const labels = new Map<CharacterId, Set<ReminderLabel>>();
	for (const item of items) {
		const tokens = run(item);
		if (!tokens) continue;
		const i = tokens.indexOf(item.label);
		next.set(item.characterId, Math.min(i, next.get(item.characterId) ?? i));
		left.set(item.characterId, (left.get(item.characterId) ?? 0) + item.count);
		labels.set(item.characterId, (labels.get(item.characterId) ?? new Set()).add(item.label));
	}
	const kept = new Set<CharacterId>();
	return items.flatMap((item) => {
		const tokens = run(item);
		if (!tokens) return [item];
		if (tokens.indexOf(item.label) !== next.get(item.characterId)) return [];
		if (kept.has(item.characterId)) return [];
		kept.add(item.characterId);
		const inBank = labels.get(item.characterId) ?? new Set();
		return [
			{
				...item,
				count: left.get(item.characterId) ?? item.count,
				run: tokens.filter((label) => inBank.has(label))
			}
		];
	});
}

export function bankItems(
	game: Game,
	characters: CharacterLookup,
	{ focus, focusMode, stack, copies, bankCopies }: BankOptions
): BankItem[] {
	// Script order, then reminder name (Trevor, 2026-10-16), like every reminder list; a
	// setup token too important to miss (the Drunk's) first (Trevor, 2026-10-27).
	const scriptOrder = scriptCharacterIds(game.script);
	const at = (id: CharacterId) => {
		const i = scriptOrder.indexOf(id);
		return i < 0 ? scriptOrder.length : i;
	};
	const setupItems = pendingSetup(game, characters).sort(
		(a, b) =>
			Number(b.suggestion.first === true) - Number(a.suggestion.first === true) ||
			at(a.suggestion.characterId) - at(b.suggestion.characterId) ||
			byLabel(a.suggestion.label, b.suggestion.label)
	);
	const nowFor = (characterId: CharacterId, label: string) =>
		focus?.characterId === characterId && focus.labels.includes(label);
	const setup: BankItem[] = [];
	for (const item of setupItems) {
		const { characterId, label } = item.suggestion;
		const same = stack
			? setup.find((i) => i.characterId === characterId && i.label === label)
			: undefined;
		if (same) same.count += 1;
		else
			setup.push({
				key: item.key,
				characterId,
				label,
				count: 1,
				setup: item,
				now: nowFor(characterId, label),
				group: 'setup'
			});
	}
	// The setup reminders too (Trevor, 2026-10-17: the first night opens on Setup).
	if (focusMode === 'front') setup.sort((a, b) => Number(!!b.now) - Number(!!a.now));
	// The setup reminders still to place come first, captioned "Setup" (Trevor, 2026-10-18:
	// no Setup/All switch), then a solid line and every other copy still off the board.
	const pending: Record<string, number> = {};
	for (const item of setupItems) {
		// eslint-disable-next-line grim/names-as-badges -- an identity key, never shown
		const k = `${item.suggestion.characterId}:${item.suggestion.label}`;
		pending[k] = (pending[k] ?? 0) + 1;
	}
	// A character whose players are dead stays with the living while a living player (or the
	// Storyteller) has its ability (M50).
	const borrowed = borrowedAbilities(game, characters);
	const holders = reminderHolders(game, characters);
	const dead = new Set(
		[...deadCharacters(game, characters)].filter((id) => borrowed.get(id) !== true)
	);
	const listed = bankReminders(
		game,
		characters,
		focus,
		focusMode === 'front',
		copies,
		bankCopies
	).flatMap(({ characterId, label, left, extra, now }) => {
		const key = `${characterId}:${label}`;
		const n = left - (pending[key] ?? 0);
		if (n <= 0) return [];
		const group: BankGroup = dead.has(characterId) ? 'dead' : 'reminders';
		// Each seat's own copies, when the character is on more than one (Trevor, 2026-10-19).
		const owners = bankOwners(game, characters, { characterId, label }, n, copies, holders);
		const list: BankItem[] = owners.flatMap(({ ownerSeatId, count }) => {
			const k = ownerSeatId === undefined ? key : `${key}:${ownerSeatId}`;
			// Prefixed: a setup suggestion's key has the same shape (setup-tray.ts).
			if (stack) return [{ key: `bank:${k}`, characterId, label, ownerSeatId, count, now, group }];
			return Array.from({ length: count }, (_, i) => ({
				key: `bank:${k}:${i}`,
				characterId,
				label,
				ownerSeatId,
				count: 1,
				now,
				group
			}));
		});
		// The extras are the last copies placed, so the last in the bank.
		let extras = Math.min(extra, n);
		for (let j = list.length - 1; j >= 0 && extras > 0; j--) {
			list[j].extra = true;
			extras -= list[j].count;
		}
		return list;
	});
	const rest = bundledCounters(listed, characters);
	const all = [
		...setup,
		...rest.filter((i) => i.group === 'reminders'),
		...genericStretch(game.genericTokens),
		...rest.filter((i) => i.group === 'dead')
	];
	// "Only this character": the step's reminders, while a step is walked through, then the
	// ∞ tokens, which any step can use (Trevor, 2026-10-23).
	return focus && focusMode === 'only' ? all.filter((i) => i.now || i.group === 'generic') : all;
}

/**
 * A bank token's look, for every `BoardReminder` that draws it (the bank, the token in hand,
 * its dialog), as `placedLook` is for a placed one: its words and, for a generic ∞ token, its
 * symbol or the art it copies (Trevor, 2026-11-03: a held copy of the Vortox's Dead lost its art).
 */
export function bankView(item: BankItem, characters: ReadonlyMap<CharacterId, Character>) {
	const like = item.token?.like;
	return {
		label: item.label,
		character: characters.get(item.characterId),
		infinite: isGeneric(item),
		...bankFace(item),
		art: like ? characters.get(like.characterId) : undefined
	};
}
