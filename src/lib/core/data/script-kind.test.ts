/**
 * Telling a script from one character and a character pack (backlog L23,
 * research/json-detection.md "Signals we can read").
 */
import { describe, expect, it } from 'vitest';
import { guessScriptKind } from './script-kind.ts';

const homebrew = (id: string) => ({ id, name: id, team: 'townsfolk', ability: 'Does a thing.' });

describe('guessScriptKind', () => {
	it('reads a single character object as one character', () => {
		expect(guessScriptKind(homebrew('baker'))).toEqual({
			kind: 'character',
			reason: 'single-character'
		});
	});

	it('reads a list of one homebrew character as one character', () => {
		expect(guessScriptKind([homebrew('baker')])).toEqual({
			kind: 'character',
			reason: 'one-homebrew'
		});
	});

	it('reads homebrew characters with no script details as a character pack', () => {
		expect(guessScriptKind([homebrew('baker'), homebrew('miller')])).toEqual({
			kind: 'collection',
			reason: 'only-homebrew'
		});
	});

	it('reads script details or official ids as a script', () => {
		const script = { kind: 'script', reason: 'script' };
		expect(guessScriptKind([{ id: '_meta', name: 'Pack?' }, homebrew('baker')])).toEqual(script);
		expect(guessScriptKind(['washerwoman', homebrew('baker'), homebrew('miller')])).toEqual(script);
		expect(guessScriptKind([{ id: 'imp' }, homebrew('baker')])).toEqual(script);
		expect(guessScriptKind([])).toEqual(script);
		expect(guessScriptKind('not json')).toEqual(script);
	});

	it('takes a source that only publishes scripts at its word', () => {
		expect(guessScriptKind([homebrew('baker'), homebrew('miller')], true)).toEqual({
			kind: 'script',
			reason: 'script'
		});
	});
});
