import { describe, expect, it } from 'vitest';
import type { SavedScript } from '#lib/features/scripts/saved-scripts.ts';
import {
	canBeOnline,
	differs,
	findMatch,
	fromSavedScript,
	migrateProfileScript,
	onlineSourceLabel,
	removedElsewhere,
	type ProfileScript,
	type ProfileScriptEntry
} from './profile-scripts.ts';

const json = [{ id: '_meta', name: 'Test' }, 'washerwoman', 'imp'];

function saved(overrides: Partial<SavedScript> = {}): SavedScript {
	return {
		schemaVersion: 1,
		scriptId: 'device-1',
		name: 'Test',
		json,
		source: { kind: 'paste' },
		addedAt: 1,
		lastUsedAt: 1,
		revision: 1,
		...overrides
	};
}

function entry(id: string, script: ProfileScript): ProfileScriptEntry {
	return { id, rev: 1, updatedAt: 1, script };
}

describe('profile scripts', () => {
	it('only BotC Scripts and links can follow an online version', () => {
		expect(canBeOnline({ kind: 'botcscripts', scriptId: 1, version: '1.0.0' })).toBe(true);
		expect(canBeOnline({ kind: 'link', url: 'https://example.com/a.json' })).toBe(true);
		expect(canBeOnline({ kind: 'paste' })).toBe(false);
		expect(canBeOnline({ kind: 'file', fileName: 'a.json' })).toBe(false);
		expect(canBeOnline({ kind: 'share' })).toBe(false);
	});

	it('saves added scripts as online when they have an online source, else as local copies', () => {
		expect(fromSavedScript(saved(), 5)).toMatchObject({ online: false, addedAt: 5, json });
		const botc = fromSavedScript(
			saved({ source: { kind: 'botcscripts', scriptId: 7, version: '2.0' } }),
			5
		);
		expect(botc?.online).toBe(true);
	});

	it('does not save official editions, which are built into the app', () => {
		expect(
			fromSavedScript(saved({ edition: 'tb', json: ['tb'], source: { kind: 'edition' } }), 1)
		).toBeUndefined();
	});

	it('reads stored records and refuses ones it cannot read', () => {
		const script = fromSavedScript(saved(), 1)!;
		expect(migrateProfileScript(JSON.parse(JSON.stringify(script)))).toEqual(script);
		expect(migrateProfileScript({ ...script, schemaVersion: 2 })).toBeUndefined();
		expect(migrateProfileScript({ ...script, json: 'x' })).toBeUndefined();
		// A local source can never be marked online.
		expect(migrateProfileScript({ ...script, online: true })?.online).toBe(false);
	});

	it('matches a newer version of the same BotC Scripts entry or link', () => {
		const old = fromSavedScript(
			saved({ source: { kind: 'botcscripts', scriptId: 7, version: '1.0' } }),
			1
		)!;
		const newer = fromSavedScript(
			saved({
				json: [...json, 'chef'],
				source: { kind: 'botcscripts', scriptId: 7, version: '2.0' }
			}),
			2
		)!;
		expect(findMatch([entry('a', old)], newer)?.id).toBe('a');
		expect(differs(old, newer)).toBe(true);
	});

	it('does not update an unlinked local copy from its old source', () => {
		const old = {
			...fromSavedScript(
				saved({ source: { kind: 'botcscripts', scriptId: 7, version: '1.0' } }),
				1
			)!,
			online: false
		};
		const newer = fromSavedScript(
			saved({
				json: [...json, 'chef'],
				source: { kind: 'botcscripts', scriptId: 7, version: '2.0' }
			}),
			2
		)!;
		expect(findMatch([entry('a', old)], newer)).toBeUndefined();
	});

	it('matches the same script added again from anywhere', () => {
		const pasted = fromSavedScript(saved(), 1)!;
		const fromFile = fromSavedScript(saved({ source: { kind: 'file', fileName: 'a.json' } }), 2)!;
		expect(findMatch([entry('a', pasted)], fromFile)?.id).toBe('a');
	});

	it('labels online sources', () => {
		expect(onlineSourceLabel({ kind: 'botcscripts', scriptId: 7, version: '2.0' })).toBe(
			'BotC Scripts #7, version 2.0'
		);
		expect(onlineSourceLabel({ kind: 'link', url: 'https://www.pastebin.com/raw/x' })).toBe(
			'pastebin.com'
		);
		expect(onlineSourceLabel({ kind: 'paste' })).toBe('None');
	});
});

describe('removedElsewhere', () => {
	it('finds scripts taken out of the profile since this device last looked', () => {
		const seen = { a: 'json:one', b: 'json:two' };
		expect(removedElsewhere(seen, [{ id: 'a', key: 'json:one' }])).toEqual({
			gone: ['json:two'],
			next: { a: 'json:one' }
		});
	});
	it('remembers new and changed scripts without calling them gone', () => {
		const seen = { a: 'json:one' };
		expect(
			removedElsewhere(seen, [
				{ id: 'a', key: 'json:one-edited' },
				{ id: 'c', key: 'json:three' }
			])
		).toEqual({ gone: [], next: { a: 'json:one-edited', c: 'json:three' } });
	});
	it('keeps a script whose content is still in the profile under another id', () => {
		const seen = { a: 'json:one', b: 'json:one' };
		expect(removedElsewhere(seen, [{ id: 'b', key: 'json:one' }]).gone).toEqual([]);
	});
});
