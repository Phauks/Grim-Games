import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { parseCharacterRules } from '../character-rules.ts';
import { parseCharacter } from '../parse.ts';
import { Issues } from '../validate.ts';
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
});
