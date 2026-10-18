import { describe, expect, it } from 'vitest';
import { APP_NAME } from '#lib/core/app-name.ts';
import { exportFileName } from './export-file.ts';

describe('account data file name', () => {
	const at = new Date(2026, 9, 18, 8, 5);
	const app = APP_NAME.toLowerCase();

	it('names the app, the username and the local date and time', () => {
		expect(exportFileName({ id: 'amber-lantern-quiet-harbor-fox', username: 'Trevor_G' }, at)).toBe(
			`${app}-trevor-g-2026-10-18-0805.json`
		);
	});

	it('uses the account id when there is no username', () => {
		expect(exportFileName({ id: 'amber-lantern-quiet-harbor-fox', username: null }, at)).toBe(
			`${app}-amber-lantern-quiet-harbor-fox-2026-10-18-0805.json`
		);
	});
});
