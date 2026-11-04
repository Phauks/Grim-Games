/**
 * The reminder bank's tokens, left to right (ReminderBank): the setup suggestions still to
 * place, every other reminder still off the board, the generic ∞, the # number token and the
 * game's own ∞ tokens with "+ New token", then the reminders of characters whose players are all dead.
 */
import type { Character, CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
import {
	GENERIC_REMINDER_ID,
	NUMBER_TOKEN_LOOK,
	scriptCharacterIds,
	type CharacterLookup,
	type Game,
	type GenericLook,
	type GenericToken,
	type ReminderId,
	type SeatId
} from '#lib/core/model/index.ts';
import { borrowedAbilities, deadCharacters } from '#lib/core/rules/index.ts';
import { bankOwners, bankReminders, byLabel, isGeneric, type StepReminders } from './reminders.ts';
import { pendingSetup, type TrayItem } from './setup-tray.ts';
import type { StepFocus } from './step-focus.svelte.ts';

/**
 * The bank's stretches, left to right (Trevor, 2026-10-19): Setup (what the Storyteller
 * sees first), Reminders, the generic ∞ in a cell of its own, then the reminders of
 * characters whose players are all dead and whose ability ended with them.
 */
export type BankGroup = 'setup' | 'reminders' | 'generic' | 'dead';
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
}

/** How a bank token is drawn: an ∞ token's symbol, or the # token's #. */
export function bankFace(item: Pick<BankItem, 'token' | 'number'>): GenericLook {
	if (item.number) return { symbol: '#' };
	const { symbol, symbolColour, symbolFill } = item.token ?? {};
	return { symbol, symbolColour, symbolFill };
}

/**
 * The look a copy of a bank token starts with when no ∞ token gives it one (`tokenId`): the
 * # token's, showing 1 (plan M35).
 */
export const bankLook = (item: Pick<BankItem, 'number'>): GenericLook | undefined =>
	item.number ? NUMBER_TOKEN_LOOK : undefined;

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
	const dead = new Set(
		[...deadCharacters(game, characters)].filter((id) => borrowed.get(id) !== true)
	);
	const rest = bankReminders(
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
		const owners = bankOwners(game, characters, { characterId, label }, n, copies);
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
	// The generic ∞ reminder, as many as needed (Trevor, 2026-10-18), after the reminders.
	const generic: BankItem = {
		key: 'generic',
		characterId: GENERIC_REMINDER_ID,
		label: '',
		count: 1,
		group: 'generic'
	};
	// The # token, only for numbers (plan M35, Trevor 2026-11-03), never used up either.
	const number: BankItem = {
		key: 'number',
		characterId: GENERIC_REMINDER_ID,
		label: 'Number' as ReminderLabel,
		count: 1,
		group: 'generic',
		number: true
	};
	// The game's own ∞ tokens, then "+ New token" (plan B9, Trevor 2026-10-23: "Tokens only").
	const tokens: BankItem[] = (game.genericTokens ?? []).map((token) => ({
		key: `token:${token.tokenId}`,
		characterId: GENERIC_REMINDER_ID,
		label: (token.note ?? '') as ReminderLabel,
		count: 1,
		group: 'generic',
		token
	}));
	const makes: BankItem = {
		key: 'new-token',
		characterId: GENERIC_REMINDER_ID,
		label: '',
		count: 1,
		group: 'generic',
		makesToken: true
	};
	const all = [
		...setup,
		...rest.filter((i) => i.group === 'reminders'),
		generic,
		number,
		...tokens,
		makes,
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
