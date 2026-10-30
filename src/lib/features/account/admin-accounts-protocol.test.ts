import { describe, expect, it } from 'vitest';
import {
	adminAccountMatches,
	adminAccountPath,
	parseAdminAccountPath,
	sortAdminAccounts,
	type AdminAccount
} from './admin-accounts-protocol.ts';

describe('admin account paths (plan S27)', () => {
	const id = 'amber-brook-cedar-dawn-ember';
	const legacy = 'a'.repeat(64);

	it('reads back the paths it makes', () => {
		expect(parseAdminAccountPath(adminAccountPath(id))).toEqual({ id });
		expect(parseAdminAccountPath(adminAccountPath(legacy, 'sign-out'))).toEqual({
			id: legacy,
			action: 'sign-out'
		});
		expect(parseAdminAccountPath(adminAccountPath(id, 'remove-username'))).toEqual({
			id,
			action: 'remove-username'
		});
	});

	it('takes only account ids and known actions', () => {
		expect(parseAdminAccountPath('/api/admin/accounts/find')).toBeUndefined();
		expect(parseAdminAccountPath(`/api/admin/accounts/${id}/export`)).toBeUndefined();
		expect(parseAdminAccountPath('/api/admin/accounts/not-an-id')).toBeUndefined();
		expect(parseAdminAccountPath(`/api/account/${id}`)).toBeUndefined();
	});
});

describe('the admins’ list of accounts (plan S27)', () => {
	const account = (email: string, username: string | null, id: string): AdminAccount => ({
		id,
		email,
		username,
		hasPassword: false,
		createdAt: 0,
		devices: 0,
		admin: false
	});
	const ann = account('ann@example.com', 'Annie', 'amber-brook-cedar-dawn-ember');
	const bob = account('bob@example.com', null, 'b'.repeat(64));

	it('lists every account by email', () => {
		expect(sortAdminAccounts([bob, ann])).toEqual([ann, bob]);
	});

	it('filters by any part of the email, username or id, in any case', () => {
		expect(adminAccountMatches(ann, '')).toBe(true);
		expect(adminAccountMatches(ann, ' ANN@ ')).toBe(true);
		expect(adminAccountMatches(ann, 'nnie')).toBe(true);
		expect(adminAccountMatches(ann, 'cedar')).toBe(true);
		expect(adminAccountMatches(bob, 'annie')).toBe(false);
	});
});
