/**
 * Account storage: SQLite-backed Durable Objects (07-accounts-and-multi-device.md §2.1).
 *
 * - `AccountEmail`, one per email address (`idFromName(email)`): the pending sign-in code
 *   and which user the address belongs to. Kept apart from the user so Discord or Google
 *   sign-in can point at the same user later.
 * - `AccountUser`, one per user (`userStub(id)`): the profile, signed-in sessions and the
 *   profile's documents (saved scripts now, saved games later).
 * - `AccountName`, one per username (`idFromName(usernameKey(name))`): which user holds it.
 *
 * The user's random id is the account: everything is stored under it, and the email and
 * username are only pointers to it, so both can change without moving anything.
 *
 * Secrets (codes, link tokens, session tokens) are stored only as SHA-256 hashes.
 *
 * Each object's class is in `objects/`; this file finds them and re-exports them.
 */
import { normaliseEmail } from '../../src/lib/features/account/account-protocol.ts';
import { isLegacyAccountId } from '../../src/lib/features/account/account-id.ts';
import { remote, type DataBinding } from '../shared-data.ts';
import type { AccountEmail } from './objects/email.ts';
import type { AccountName } from './objects/name.ts';
import type { AccountUser } from './objects/user.ts';

/**
 * Where accounts live. With `DATA` bound, they are the shared data Worker's
 * (`worker/shared-data.ts`), reached the same way from production and from every preview.
 * Without it, this Worker's own objects hold them, as before; they stay bound either way, so
 * their data is never deleted.
 */
export interface AccountEnv {
	ACCOUNT_USERS: DurableObjectNamespace<AccountUser>;
	ACCOUNT_EMAILS: DurableObjectNamespace<AccountEmail>;
	ACCOUNT_NAMES: DurableObjectNamespace<AccountName>;
	DATA?: DataBinding;
}

/** The three kinds of account object, by the key each is found by. */
interface AccountObjects {
	user(userId: string): DurableObjectStub<AccountUser>;
	/** Not `email`: that name is a Worker's handler for incoming mail. */
	address(key: string): DurableObjectStub<AccountEmail>;
	username(key: string): DurableObjectStub<AccountName>;
}

/** This Worker's own account objects, which the shared data Worker also uses. */
export const localAccounts = (env: AccountEnv): AccountObjects => ({
	/**
	 * New accounts are named by their word-chain id; accounts made before those keep the hex
	 * id of a `newUniqueId()` object, which stays valid.
	 */
	user(userId) {
		const users = env.ACCOUNT_USERS;
		return users.get(
			isLegacyAccountId(userId) ? users.idFromString(userId) : users.idFromName(userId)
		);
	},
	address: (key) => env.ACCOUNT_EMAILS.get(env.ACCOUNT_EMAILS.idFromName(key)),
	username: (key) => env.ACCOUNT_NAMES.get(env.ACCOUNT_NAMES.idFromName(key))
});

function accounts(env: AccountEnv): AccountObjects {
	const binding = env.DATA;
	if (!binding) return localAccounts(env);
	return {
		user: (userId) => remote(binding, 'user', userId),
		address: (key) => remote(binding, 'address', key),
		username: (key) => remote(binding, 'username', key)
	};
}

/** The Durable Object of an account. */
export function userStub(env: AccountEnv, userId: string): DurableObjectStub<AccountUser> {
	return accounts(env).user(userId);
}

/** The record of one email address: its sign-in codes and which account it belongs to. */
export function emailStub(env: AccountEnv, email: string): DurableObjectStub<AccountEmail> {
	return accounts(env).address(normaliseEmail(email) ?? email);
}

/** Who holds a username (`usernameKey`). */
export function nameStub(env: AccountEnv, key: string): DurableObjectStub<AccountName> {
	return accounts(env).username(key);
}

export { hashPassword, type PasswordHash } from './objects/shared.ts';
export {
	AccountEmail,
	type ChangeResult,
	type ChangeStartResult,
	type StartResult,
	type VerifyResult
} from './objects/email.ts';
export { AccountName } from './objects/name.ts';
export { AccountUser, type Authenticated, type PutResult } from './objects/user.ts';
