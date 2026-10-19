/**
 * The first time someone signs in on a device, the device's own data is offered to the
 * account (sync plan step 2, approved by Trevor 2026-10-18): one sheet lists what this device
 * has, a switch per kind, and Confirm adds those kinds to the account. Nothing is deleted from
 * either side, and the device never asks the same account again, whichever was chosen.
 *
 * Each kind registers how to count and add its device items; profile scripts are the first.
 */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';
import { account } from './account.svelte.ts';
import type { DocKind } from './account-protocol.ts';
import { accountSync } from './sync/sync.svelte.ts';

interface DeviceKind {
	/** This device's items the account doesn't have yet. */
	count(): Promise<number>;
	/** Adds them to the account. */
	upload(): Promise<void>;
	/**
	 * Offered but not chosen (or the sheet closed): what to do instead, for a kind that can't
	 * both keep the device's own copy and follow the account (Library labels, collections).
	 */
	skip?(): Promise<void>;
}

export interface Offer {
	userId: string;
	items: { kind: DocKind; count: number }[];
}

/** Accounts this device has asked; the older key is from when only scripts were added. */
const ANSWERED_KEY = 'grim-games:first-sign-in';
const OLD_KEY = 'grim-games:profile-scripts-imported';

// Not reactive state: a plain registry.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const kinds = new Map<DocKind, DeviceKind>();
let offer = $state<Offer | undefined>(undefined);

function answered(userId: string): boolean {
	return [ANSWERED_KEY, OLD_KEY].some((key) =>
		(readStoredText(key) ?? '').split(',').includes(userId)
	);
}

function markAnswered(userId: string): void {
	const ids = (readStoredText(ANSWERED_KEY) ?? '').split(',').filter(Boolean);
	// Without storage the sheet comes back next sign-in, which loses nothing.
	writeStoredText(ANSWERED_KEY, [...ids, userId].slice(-5).join(','));
}

async function check(userId: string): Promise<void> {
	if (answered(userId)) return;
	// The account's items first, so ones it already has aren't counted or added again.
	await accountSync.syncNow();
	if (account.user?.id !== userId || !accountSync.pulled) return;
	const items: Offer['items'] = [];
	for (const [kind, device] of kinds) {
		if (!accountSync.enabled(kind)) continue;
		const count = await device.count();
		if (count > 0) items.push({ kind, count });
	}
	if (account.user?.id !== userId) return;
	if (items.length === 0) markAnswered(userId);
	else offer = { userId, items };
}

account.onChange((user) => {
	offer = undefined;
	if (user) void check(user.id).catch((e) => reportError(e, { area: 'account', notify: false }));
});

export const firstSignIn = {
	register(kind: DocKind, device: DeviceKind): void {
		kinds.set(kind, device);
	},
	/** The sheet's question, while there is one. */
	get offer(): Offer | undefined {
		return offer;
	},
	/** Adds the chosen kinds; the sheet then never comes back for this account. */
	async accept(chosen: readonly DocKind[]): Promise<void> {
		const asked = offer;
		if (!asked) return;
		await accountSync.syncNow();
		if (!accountSync.pulled) throw new Error(t('account.offline'));
		for (const kind of chosen) await kinds.get(kind)?.upload();
		for (const { kind } of asked.items) if (!chosen.includes(kind)) await kinds.get(kind)?.skip?.();
		markAnswered(asked.userId);
		offer = undefined;
	},
	/** Leaves this device's items on the device only. */
	decline(): void {
		const asked = offer;
		if (!asked) return;
		markAnswered(asked.userId);
		offer = undefined;
		void (async () => {
			for (const { kind } of asked.items) await kinds.get(kind)?.skip?.();
		})().catch((e) => reportError(e, { area: 'account', notify: false }));
	},
	/** Whether this device has answered the sheet for `userId` (or had nothing to offer). */
	answered(userId: string): boolean {
		return answered(userId);
	}
};
