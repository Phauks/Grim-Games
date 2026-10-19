/** Called once when the app shell mounts: checks who is signed in on this device. */
import { account } from './account.svelte.ts';
// Registers the listener that loads the profile's scripts after signing in.
import './profile-scripts.svelte.ts';
// The Library's folders and collections follow the account on every page, and the first
// sign-in sheet offers them.
import '#lib/features/library/library-labels.svelte.ts';
import '#lib/features/library/library-collections.svelte.ts';

export function startAccount(): Promise<void> {
	return account.refresh();
}
