import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import { createGame, type EngineContext } from '#lib/core/engine/index.ts';
import { characterLookup } from '#lib/core/model/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { FIXED_GENERIC_ITEMS, bankItems } from './bank-items.ts';

// A player's reminder tray (player/PlayerReminderBin) and the Storyteller's bank
// (grimoire/ReminderBank) offer the same tokens, drawn the same way (Trevor, 2026-11-06:
// "Player view doesn't have number tokens? I'm gonna be annoyed if once again I am chasing
// feature parity"). The player's tray had a token list of its own, so the bank's # token
// never reached it. These fail when a token feature is added to one side only: each one is
// either shared, Storyteller-only for a stated reason, or a listed gap.

const source = (path: string) => readFileSync(`src/lib/${path}`, 'utf8');
const bank = source('features/grimoire/bank-items.ts');
const bankView = source('features/grimoire/ReminderBank.svelte');
const pill = source('features/grimoire/ReminderHandPill.svelte');
const tray = source('features/player/PlayerReminderBin.svelte');
const playerReminders = source('features/player/player-reminders.ts');
const model = source('core/model/types.ts');

/** The fields of an interface, as written in its source. */
function fieldsOf(text: string, name: string): string[] {
	const body = new RegExp(`export interface ${name} \\{([^]*?)\\n\\}`).exec(text)?.[1] ?? '';
	return [...body.matchAll(/^\t(\w+)\??:/gm)].map((m) => m[1]);
}

type Side =
	/** A player's tray has it too: `marker` is in its source. */
	| { both: RegExp }
	/** Only a Storyteller's game can know it. */
	| { storyteller: string }
	/** Not on the player's side yet: in PLAYER_TOKEN_GAPS_TODO. */
	| { gap: string };

/**
 * Every field of a bank token (`BankItem`). A new one fails the test until it is sorted here.
 */
const BANK_ITEM: Record<string, Side> = {
	key: { both: /\bkey\b/ },
	characterId: { both: /\bcharacterId\b/ },
	label: { both: /\blabel\b/ },
	group: { both: /\bgroups\b/ },
	number: { both: /FIXED_GENERIC_ITEMS/ },
	count: { storyteller: "a player's tokens never run out, so none has a count" },
	setup: { storyteller: "setup suggestions come from the Storyteller's game" },
	ownerSeatId: { storyteller: 'a player cannot know which seat has the character' },
	now: { storyteller: "the walked-through night step is the Storyteller's" },
	extra: { storyteller: "a copy beyond what the game gives; a player's tokens never run out" },
	token: { gap: "the game's own reusable ∞ tokens (plan B9)" },
	makesToken: { gap: '"+ New token" (plan B9)' },
	run: { gap: 'counting runs stacked as one token with its Token drop-down (PR 1310)' }
};

/** Every field of a generic token's look (`GenericLook`), kept by a player's tokens or not. */
const LOOK: Record<string, Side> = {
	note: { both: /r\.note\b/ },
	symbol: { both: /r\.symbol\b/ },
	symbolColour: { both: /r\.symbolColour\b/ },
	symbolFill: { both: /r\.symbolFill\b/ },
	like: { gap: 'a copy of a character reminder showing its art (needs "+ New token")' },
	countsUp: { gap: 'a # token that counts up each night or day (plan M53)' }
};

/**
 * Token features the Storyteller has and a player doesn't yet. Only shrinks: fix one, take
 * it off here and sort its field as `both`.
 */
const PLAYER_TOKEN_GAPS_TODO = ['token', 'makesToken', 'run', 'like', 'countsUp'];

describe("a player's reminder tray and the Storyteller's bank", () => {
	it("draws the bank's own generic tokens, never a list of its own", () => {
		const data = committedGameData();
		const script = toScript(editionScript('tb', data)!);
		const characters = characterLookup(data, script);
		const ctx: EngineContext = { characters, newId: () => 'id', now: () => 0, random: () => 0 };
		const created = createGame({ type: 'CreateGame', script, playerCount: 5 }, ctx);
		if (!created.ok) throw new Error('no game');
		const items = bankItems(created.session.game, characters, {
			focus: undefined,
			focusMode: 'front',
			stack: false,
			copies: new Set(),
			bankCopies: new Map()
		});
		const fixed = items.filter((i) => i.group === 'generic' && !i.token && !i.makesToken);
		expect(fixed.map((i) => i.key)).toEqual(FIXED_GENERIC_ITEMS.map((i) => i.key));
		// Both include the # token (plan M35).
		expect(FIXED_GENERIC_ITEMS.some((i) => i.number)).toBe(true);
		expect(bank).toContain('...FIXED_GENERIC_ITEMS');
		expect(tray).toContain('FIXED_GENERIC_ITEMS.map(');
		// Drawn as the bank draws them, with the look a copy starts with.
		expect(tray).toContain('bankView(item');
		expect(tray).toContain('bankLook(item)');
		expect(tray).not.toMatch(/: Token = \{/);
	});

	it("picks a held # token's number with the same control", () => {
		for (const side of [pill, tray]) {
			expect(side).toContain('<ReminderNumberPick');
			expect(side).not.toContain('<NumberSelect');
		}
	});

	it('holds, drags and edits tokens with the same pieces', () => {
		for (const side of [bankView, tray]) expect(side).toContain('<ReminderTray');
		for (const side of [pill, tray]) expect(side).toContain('<ReminderInHand');
		expect(tray).toContain('<GenericLookDialog');
	});

	it('sorts every bank token feature as shared, Storyteller-only or a listed gap', () => {
		const fields = fieldsOf(bank, 'BankItem');
		expect(fields.length).toBeGreaterThan(5);
		expect(Object.keys(BANK_ITEM).sort()).toEqual([...fields].sort());
		for (const [field, side] of Object.entries(BANK_ITEM)) {
			if ('both' in side) expect(tray, field).toMatch(side.both);
			if ('gap' in side) expect(PLAYER_TOKEN_GAPS_TODO, field).toContain(field);
		}
	});

	it("sorts every generic look field as kept by a player's tokens or a listed gap", () => {
		const block = /export type GenericLook = Pick<[^,]+,([^>]+)>/.exec(model)?.[1] ?? '';
		const fields = [...block.matchAll(/'(\w+)'/g)].map((m) => m[1]);
		expect(fields.length).toBeGreaterThan(3);
		expect(Object.keys(LOOK).sort()).toEqual([...fields].sort());
		for (const [field, side] of Object.entries(LOOK)) {
			if ('both' in side) expect(playerReminders, field).toMatch(side.both);
			if ('gap' in side) expect(PLAYER_TOKEN_GAPS_TODO, field).toContain(field);
		}
	});

	it('only shrinks its list of gaps', () => {
		const gaps = [...Object.entries(BANK_ITEM), ...Object.entries(LOOK)]
			.filter(([, side]) => 'gap' in side)
			.map(([field]) => field);
		expect([...PLAYER_TOKEN_GAPS_TODO].sort()).toEqual(gaps.sort());
		expect(PLAYER_TOKEN_GAPS_TODO.length).toBeLessThanOrEqual(5);
	});
});
