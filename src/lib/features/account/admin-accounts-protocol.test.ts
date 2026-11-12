import { describe, expect, it } from 'vitest';
import {
	adminAccountPath,
	firstAdminAccountDirection,
	orderAdminAccounts,
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

	it('orders by any column, ties by email, so the list never shuffles', () => {
		const cy = { ...account('cy@example.com', 'Cy', 'c'.repeat(64)), admin: true };
		const used = { ...ann, devices: 2, lastSeenAt: 20, createdAt: 5 };
		const idle = { ...bob, createdAt: 9 };
		expect(orderAdminAccounts([idle, used, cy], 'lastUsed', 'descending')).toEqual([
			used,
			idle,
			cy
		]);
		expect(orderAdminAccounts([idle, used, cy], 'since', 'descending')).toEqual([idle, used, cy]);
		expect(orderAdminAccounts([used, idle, cy], 'type', 'descending')).toEqual([cy, used, idle]);
		expect(orderAdminAccounts([cy, used, idle], 'devices', 'ascending')).toEqual([idle, cy, used]);
		// No username sorts first, as "None" leads a table's filter list.
		expect(orderAdminAccounts([used, cy, idle], 'username', 'ascending')).toEqual([idle, used, cy]);
		expect(orderAdminAccounts([cy, idle, used], 'email', 'descending')).toEqual([cy, idle, used]);
	});

	it('starts dates and counts at the newest and busiest, text at A', () => {
		expect(firstAdminAccountDirection('lastUsed')).toBe('descending');
		expect(firstAdminAccountDirection('devices')).toBe('descending');
		expect(firstAdminAccountDirection('email')).toBe('ascending');
		expect(firstAdminAccountDirection('username')).toBe('ascending');
	});
});
