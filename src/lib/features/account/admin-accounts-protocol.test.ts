import { describe, expect, it } from 'vitest';
import { adminAccountPath, parseAdminAccountPath } from './admin-accounts-protocol.ts';

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
