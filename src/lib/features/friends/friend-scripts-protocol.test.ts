import { describe, expect, it } from 'vitest';
import {
	isLastingHash,
	MAX_SCRIPT_HASH,
	MAX_SCRIPT_NAME,
	parseProfilePath,
	profileApi,
	readFriendScript
} from './friend-scripts-protocol.ts';

describe('lasting share hashes', () => {
	it('keeps editions, BotC Scripts scripts and whole scripts', () => {
		expect(isLastingHash('#e=tb')).toBe(true);
		expect(isLastingHash('#bs=1234')).toBe(true);
		expect(isLastingHash('#bs=1234/1.0.2')).toBe(true);
		expect(isLastingHash('#s=1.eJyLjgUAARUAuQ')).toBe(true);
	});

	it('refuses a share code, whose copy expires, and anything else', () => {
		expect(isLastingHash('#c=482913')).toBe(false);
		expect(isLastingHash('e=tb')).toBe(false);
		expect(isLastingHash('#s=1.abc&o=1')).toBe(false);
		expect(isLastingHash('#e=tb<script>')).toBe(false);
		expect(isLastingHash(42)).toBe(false);
		expect(isLastingHash(`#s=${'a'.repeat(MAX_SCRIPT_HASH)}`)).toBe(false);
	});
});

describe('readFriendScript', () => {
	it('trims the name and cuts a long one short', () => {
		expect(readFriendScript({ name: '  Catfishing ', hash: '#e=tb' })).toEqual({
			name: 'Catfishing',
			hash: '#e=tb'
		});
		expect(readFriendScript({ name: 'x'.repeat(300), hash: '#e=tb' })?.name).toHaveLength(
			MAX_SCRIPT_NAME
		);
	});

	it('refuses a missing name or a bad hash', () => {
		expect(readFriendScript({ name: '  ', hash: '#e=tb' })).toBeUndefined();
		expect(readFriendScript({ name: 'A', hash: '#c=482913' })).toBeUndefined();
		expect(readFriendScript(null)).toBeUndefined();
	});
});

describe('profile paths', () => {
	it('reads back the username the app asked for', () => {
		expect(parseProfilePath(profileApi('ann.b_c-1'))).toBe('ann.b_c-1');
		expect(parseProfilePath('/api/profiles/ann/')).toBe('ann');
	});

	it('ignores other paths', () => {
		expect(parseProfilePath('/api/profiles')).toBeUndefined();
		expect(parseProfilePath('/api/profiles/ann/scripts')).toBeUndefined();
		expect(parseProfilePath('/api/profiles/%E0%A4%A')).toBeUndefined();
	});
});
