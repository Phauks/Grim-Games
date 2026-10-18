/**
 * Who is signed in on this device. Signing in is optional: everything else in the app works
 * signed out and offline, so a failed check only leaves the state `offline`.
 */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { AccountApiError, accountApi } from './account-api.ts';
import type { AccountUser, EmailDelivery, SessionInfo } from './account-protocol.ts';

export type AccountStatus = 'checking' | 'signed-out' | 'signed-in' | 'offline';

let status = $state<AccountStatus>('checking');
let user = $state.raw<AccountUser | undefined>(undefined);
let delivery = $state<EmailDelivery | undefined>(undefined);
let admin = $state(false);
let checking: Promise<void> | undefined;
/** Bumped by every sign-in or sign-out, so an older session check can't undo it. */
let generation = 0;
// Not reactive state: a plain registry of callbacks.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const listeners = new Set<(user: AccountUser | undefined) => void>();

function apply(info: SessionInfo): void {
	const before = user?.id;
	user = info.user ?? undefined;
	delivery = info.delivery;
	admin = user !== undefined && info.admin === true;
	status = user ? 'signed-in' : 'signed-out';
	if (before !== user?.id) for (const listener of listeners) listener(user);
}

export const account = {
	get status(): AccountStatus {
		return status;
	},
	get user(): AccountUser | undefined {
		return user;
	},
	/** Whether the signed-in account is an admin (it can open the reports inbox). */
	get admin(): boolean {
		return admin;
	},
	/** How sign-in codes are delivered here; undefined until the first check. */
	get delivery(): EmailDelivery | undefined {
		return delivery;
	},
	/** Asks the server who is signed in. Safe to call repeatedly. */
	refresh(): Promise<void> {
		const started = generation;
		checking ??= accountApi
			.session()
			.then((info) => {
				if (started === generation) apply(info);
			})
			.catch((e) => {
				if (!(e instanceof AccountApiError) || e.status !== 0) {
					reportError(e, { area: 'account', notify: false });
				}
				status = user ? 'signed-in' : 'offline';
			})
			.finally(() => (checking = undefined));
		return checking;
	},
	/** After a successful code or link. */
	signedIn(info: SessionInfo): void {
		generation++;
		apply(info);
	},
	async signOut(): Promise<void> {
		await accountApi.signOut();
		generation++;
		apply({ user: null, delivery: delivery ?? 'unavailable' });
	},
	/** After the user's email or username changed: the same account, new details. */
	updated(next: AccountUser): void {
		if (user?.id === next.id) user = next;
	},
	/** After the account was deleted. */
	forget(): void {
		generation++;
		apply({ user: null, delivery: delivery ?? 'unavailable' });
	},
	/** Runs `listener` whenever the signed-in user changes. Returns an unsubscribe function. */
	onChange(listener: (user: AccountUser | undefined) => void): () => void {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}
};
