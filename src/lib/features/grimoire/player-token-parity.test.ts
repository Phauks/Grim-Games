import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editionScript, toScript, type Script } from '#lib/core/data/index.ts';
import { createGame, type EngineContext } from '#lib/core/engine/index.ts';
import { characterLookup, type GenericLook } from '#lib/core/model/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { parsePlayerReminders, parsePlayerTokens } from '#lib/features/player/player-reminders.ts';
import { bankItems, playerBankItems } from './bank-items.ts';

// A player's reminder tray (player/PlayerReminderBin) and the Storyteller's bank
// (grimoire/ReminderBank) are built from the same pieces (Trevor, 2026-11-06: "Player view
// doesn't have number tokens? I'm gonna be annoyed if once again I am chasing feature
// parity"; then "I want them to use the same components for parity"). The player's tray had
// a token list of its own, so the bank's # token never reached it. These fail when a token
// feature reaches one side only: each is shared, or Storyteller-only for a stated reason.

const source = (path: string) => readFileSync(`src/lib/${path}`, 'utf8');
const bankItemsSource = source('features/grimoire/bank-items.ts');
const bank = source('features/grimoire/ReminderBank.svelte');
const pill = source('features/grimoire/ReminderHandPill.svelte');
const tray = source('features/player/PlayerReminderBin.svelte');
const model = source('core/model/types.ts');

/** The fields of an interface, as written in its source. */
function fieldsOf(text: string, name: string): string[] {
	const body = new RegExp(`export interface ${name} \\{([^]*?)\\n\\}`).exec(text)?.[1] ?? '';
	return [...body.matchAll(/^\t(\w+)\??:/gm)].map((m) => m[1]);
}

/**
 * The bank token fields (`BankItem`) only a Storyteller's game can give, and why. Every other
 * field must turn up in a player's tray too. Only shrinks.
 */
const STORYTELLER_ONLY: Record<string, string> = {
	setup: "setup suggestions come from the Storyteller's game",
	ownerSeatId: 'a player cannot know which seat has the character',
	now: "the walked-through night step is the Storyteller's",
	extra: "a copy beyond what the game gives; a player's tokens never run out"
};

/**
 * Token features the Storyteller has and a player doesn't yet (all closed, Trevor 2026-11-06).
 * Only shrinks: a new one is never added here, it is built on both sides.
 */
const PLAYER_TOKEN_GAPS_TODO: string[] = [];

const data = committedGameData();
const levScript: Script = {
	entries: ['leviathan', 'monk', 'washerwoman', 'imp'].map((id) => ({
		kind: 'official' as const,
		id
	}))
};
const lev = characterLookup(data, levScript);
const cast = [...lev.values()].filter((c) =>
	levScript.entries.some((e) => 'id' in e && e.id === c.id)
);

describe("a player's reminder tray and the Storyteller's bank", () => {
	it('builds both trays with the same item builders', () => {
		// The generic stretch (∞, #, the grim's own ∞ tokens, "+ New token") and the stacked
		// counting runs come from one place for both.
		expect(bankItemsSource).toMatch(/\.\.\.genericStretch\(game\.genericTokens/);
		expect(bankItemsSource).toMatch(/function playerBankItems[^]*genericStretch\(tokens\)/);
		expect(bankItemsSource).toMatch(/function playerBankItems[^]*bundledCounters\(/);
		expect(tray).toContain('playerBankItems(');
		const script = toScript(editionScript('tb', data)!);
		const characters = characterLookup(data, script);
		const ctx: EngineContext = { characters, newId: () => 'id', now: () => 0, random: () => 0 };
		const created = createGame({ type: 'CreateGame', script, playerCount: 5 }, ctx);
		if (!created.ok) throw new Error('no game');
		const board = bankItems(created.session.game, characters, {
			focus: undefined,
			focusMode: 'front',
			stack: false,
			copies: new Set(),
			bankCopies: new Map()
		});
		const phone = playerBankItems([...characters.values()], [], []);
		const generic = (items: typeof board) =>
			items.filter((i) => i.group === 'generic').map((i) => i.key);
		expect(generic(phone)).toEqual(generic(board));
	});

	it('draws, holds and edits tokens with the same components', () => {
		for (const side of [bank, tray]) {
			expect(side).toContain('<ReminderTray');
			expect(side).toContain('<BankToken');
			// Pulled up, the same search narrows both (searchBank).
			expect(side).toContain('<SearchField');
			// Never a token of its own: BankToken draws "+ New token" and a stack's count.
			expect(side).not.toMatch(/<(NewTokenButton|ReminderCount)\b/);
		}
		for (const side of [pill, tray]) {
			expect(side).toContain('<ReminderInHand');
			expect(side).toContain('<HeldTokenPick');
			expect(side).not.toMatch(/<(NumberSelect|Select)\b/);
		}
		expect(tray).toContain('<GenericLookDialog');
	});

	it("gives a player's tray every bank token feature but the Storyteller's own", () => {
		const fields = fieldsOf(bankItemsSource, 'BankItem');
		expect(fields.length).toBeGreaterThan(5);
		const phone = playerBankItems(cast, ['monk'], [{ tokenId: 't', note: 'Chose' }]);
		const seen = new Set(phone.flatMap((i) => Object.keys(i)));
		for (const field of fields) {
			if (field in STORYTELLER_ONLY) expect(seen.has(field), field).toBe(false);
			else expect(seen.has(field), `${field} never reaches a player's tray`).toBe(true);
		}
	});

	it("keeps every generic look field on a player's tokens", () => {
		const block = /export type GenericLook = Pick<[^,]+,([^>]+)>/.exec(model)?.[1] ?? '';
		const fields = [...block.matchAll(/'(\w+)'/g)].map((m) => m[1]);
		expect(fields.length).toBeGreaterThan(3);
		// One of each, as the board can set it; a new field fails here until it has a value.
		const look: Required<GenericLook> = {
			note: 'Chose',
			symbol: '#2',
			symbolColour: 'red',
			symbolFill: true,
			like: { characterId: 'monk', label: 'Safe' } as GenericLook['like'] & object,
			countsUp: 'dusk'
		};
		expect(Object.keys(look).sort()).toEqual([...fields].sort());
		const placed = parsePlayerReminders({
			s1: [{ characterId: 'generic', label: '', id: 'g', ...look }]
		});
		expect(placed.s1[0]).toMatchObject(look);
		expect(parsePlayerTokens([{ tokenId: 't', ...look }])[0]).toMatchObject(look);
	});

	it('only shrinks its list of gaps', () => {
		expect(PLAYER_TOKEN_GAPS_TODO).toEqual([]);
	});
});
