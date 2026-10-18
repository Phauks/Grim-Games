import { describe, expect, it } from 'vitest';
import { nameFromListing, officialName, scriptJsonName, withScriptName } from './script-names.ts';

describe('script names from listings', () => {
	it('takes the listing’s name when the script names itself nothing', () => {
		const json = [{ id: 'librarian' }, { id: 'imp' }];
		expect(scriptJsonName(nameFromListing(json, 'Harold Holt’s Revenge'))).toBe(
			'Harold Holt’s Revenge'
		);
		// A _meta without a name keeps its other fields.
		const meta = [{ id: '_meta', author: 'Zets' }, 'imp'];
		expect(nameFromListing(meta, ' Quick  Maths ')).toEqual([
			{ id: '_meta', author: 'Zets', name: 'Quick Maths' },
			'imp'
		]);
	});

	it('takes the listing’s capitals for the same words, but never other words', () => {
		const json = [{ id: '_meta', name: 'one in one out' }, 'imp'];
		expect(scriptJsonName(nameFromListing(json, 'One In One Out'))).toBe('One In One Out');
		const versioned = [{ id: '_meta', name: 'Devout Theists v6' }, 'imp'];
		expect(nameFromListing(versioned, 'Devout Theists')).toEqual(versioned);
		expect(nameFromListing(json, undefined)).toEqual(json);
	});

	it('writes official names as TPI lists them', () => {
		const json = [{ id: '_meta', author: 'Baron von Klutz', name: 'One in one out' }, 'steward'];
		expect(officialName(json)).toEqual([
			{ id: '_meta', author: 'Baron von Klutz', name: 'One In One Out' },
			'steward'
		]);
		expect(officialName(['imp'])).toEqual(['imp']);
		expect(withScriptName(['imp'], 'A')).toEqual([{ id: '_meta', name: 'A' }, 'imp']);
	});
});
