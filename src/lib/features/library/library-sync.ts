/**
 * Which accounts this device's Library has already joined (account sync, agreed with the
 * Accounts thread 2026-10-18). The first time someone signs in here, what the device has is
 * merged into their account once; after that the account's copy is the one shown.
 */
import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';

export function linkedTo(storageKey: string, userId: string): boolean {
	return (readStoredText(storageKey) ?? '').split(',').includes(userId);
}

export function markLinked(storageKey: string, userId: string): void {
	const ids = (readStoredText(storageKey) ?? '').split(',').filter(Boolean);
	if (ids.includes(userId)) return;
	// No storage: the merge runs again next time, which only re-adds what is already there.
	writeStoredText(storageKey, [...ids, userId].slice(-5).join(','));
}
