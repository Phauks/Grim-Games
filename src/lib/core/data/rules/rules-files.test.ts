import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { parseCharacterRules } from '../character-rules.ts';
import { parseCharacter } from '../parse.ts';
import { Issues } from '../validate.ts';
import { actsWhenDead } from '#lib/core/rules/dead-characters.ts';
import { onDeathTrigger } from '#lib/core/rules/night-alerts.ts';
import { reminderPrompt } from '#lib/core/rules/reminder-prompts.ts';
import { OFFICIAL_RULES, rulesOf } from './index.ts';

const dir = new URL('./', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const data = committedGameData();

describe('official rules files (data/rules/<id>.json)', () => {
	it('lists every file in the index', () => {
		expect([...OFFICIAL_RULES.keys()].sort()).toEqual(files.map((f) => f.slice(0, -5)).sort());
	});

	it.each(files)('%s is an official character and only names its own reminders', (file) => {
		const id = file.slice(0, -5);
		const character = data.byId.get(id);
		expect(character, id).toBeDefined();
		const issues = new Issues();
		const raw: unknown = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
		parseCharacterRules(raw, file, issues, character!.reminders);
		expect(issues.list).toEqual([]);
	});
});

describe('parseCharacterRules', () => {
	const parse = (raw: unknown, reminders = ['Dead']) => {
		const issues = new Issues();
		return { rules: parseCharacterRules(raw, 'rules', issues, reminders), issues: issues.list };
	};

	it('reads a reminder prompt', () => {
		expect(parse({ reminderPrompts: { Dead: 'markDead' } })).toEqual({
			rules: { reminderPrompts: { Dead: 'markDead' } },
			issues: []
		});
	});

	it('reports unknown rules, unknown prompts and reminders the character lacks', () => {
		expect(parse({ kills: true }).issues).toEqual(['rules.kills: unknown rule']);
		expect(parse({ onDeath: { by: 'night' } }).issues).toEqual([
			'rules.onDeath.by: unknown value "night"'
		]);
		expect(parse({ protects: { who: 'marked', from: 'demon' } }).issues).toEqual([
			'rules.protects.token: missing'
		]);
		expect(parse({ protects: { who: 'self', token: 'Dead', from: 'any' } }).issues).toEqual([
			'rules.protects.token: only a marked player has a token'
		]);
		expect(parse({ protects: { who: 'marked', token: 'Safe', from: 'any' } }).issues).toEqual([
			'rules.protects.token: not one of this character’s reminders'
		]);
		expect(parse({ redirectsKill: { from: 'other' } }).issues).toEqual([
			'rules.redirectsKill.from: unknown value "other"'
		]);
		expect(parse({ survivesFirstDeath: { spentToken: 'No Ability' } }).issues).toEqual([
			'rules.survivesFirstDeath.spentToken: not one of this character’s reminders'
		]);
		expect(parse({ survivesFirstDeath: {} }).issues).toEqual([
			'rules.survivesFirstDeath.spentToken: missing'
		]);
		expect(parse({ actsWhenDead: 'yes' }).issues).toEqual([
			'rules.actsWhenDead: expected boolean, got string'
		]);
		expect(parse({ reminderPrompts: { Dead: 'explode' } }).issues).toEqual([
			'rules.reminderPrompts.Dead: unknown prompt "explode"'
		]);
		expect(parse({ reminderPrompts: { Alive: 'revive' } }).issues).toEqual([
			'rules.reminderPrompts.Alive: not one of this character’s reminders'
		]);
	});
});

describe('custom characters', () => {
	// A homebrew Demon whose kill reminder has its own words: its rules block makes placing
	// it ask to mark the player dead, as the Imp's "Dead" does
	// (https://wiki.bloodontheclocktower.com/Imp).
	const raw = {
		id: 'hollowking',
		name: 'Hollow King',
		team: 'demon',
		ability: 'Each night*, choose a player: they die.',
		reminders: ['Hollowed'],
		rules: { reminderPrompts: { Hollowed: 'markDead' } }
	};

	it('carry a rules block in their script entry, read by the same parser', () => {
		const issues = new Issues();
		const character = parseCharacter(raw, '[0]', issues, { strict: false, scriptFields: true });
		expect(issues.list).toEqual([]);
		expect(character?.rules).toEqual({ reminderPrompts: { Hollowed: 'markDead' } });
		const characters = new Map([[character!.id, character!]]);
		expect(rulesOf('hollowking', characters)).toBe(character!.rules);
		expect(reminderPrompt('Hollowed', 'hollowking', characters)).toBe('markDead');
		expect(reminderPrompt('Hollowed')).toBeUndefined();
	});

	it('report a bad rules block like any other bad field', () => {
		const issues = new Issues();
		const bad = { ...raw, rules: { reminderPrompts: { Missing: 'markDead' } } };
		expect(parseCharacter(bad, '[0]', issues, { strict: false, scriptFields: true })).toBe(
			undefined
		);
		expect(issues.list).toEqual([
			'[0].rules.reminderPrompts.Missing: not one of this character’s reminders'
		]);
	});

	it('keep the official block when they reuse an official id without rules', () => {
		expect(rulesOf('imp', new Map([['imp', {}]]))).toEqual({
			reminderPrompts: { Dead: 'markDead' }
		});
	});

	// A homebrew Outsider that acts on its death, as the Klutz does
	// (https://wiki.bloodontheclocktower.com/Klutz): its reminders stay in the bank's living
	// section once it dies.
	it('can act when dead', () => {
		const issues = new Issues();
		const lantern = parseCharacter(
			{
				id: 'lanternbearer',
				name: 'Lantern Bearer',
				team: 'outsider',
				ability: 'When you die, choose a player.',
				rules: { actsWhenDead: true }
			},
			'[0]',
			issues,
			{ strict: false, scriptFields: true }
		);
		expect(issues.list).toEqual([]);
		const characters = new Map([[lantern!.id, lantern!]]);
		expect(actsWhenDead('lanternbearer', characters)).toBe(true);
		expect(actsWhenDead('lanternbearer')).toBe(false);
	});

	// A homebrew Townsfolk woken by a Demon kill, as the Sage is
	// (https://wiki.bloodontheclocktower.com/Sage).
	it('can be set off by their death', () => {
		const issues = new Issues();
		const watcher = parseCharacter(
			{
				id: 'lastwatch',
				name: 'Last Watch',
				team: 'townsfolk',
				ability: 'If the Demon kills you, you learn a player.',
				rules: { onDeath: { by: 'demon' } }
			},
			'[0]',
			issues,
			{ strict: false, scriptFields: true }
		);
		expect(issues.list).toEqual([]);
		expect(onDeathTrigger('lastwatch', new Map([[watcher!.id, watcher!]]))).toEqual({
			by: 'demon'
		});
		expect(onDeathTrigger('lastwatch')).toBeUndefined();
	});
});
