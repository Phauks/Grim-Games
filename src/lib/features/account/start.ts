/** Called once when the app shell mounts: checks who is signed in on this device. */
import { account } from './account.svelte.ts';
// Registers the listener that loads the profile's scripts after signing in.
import './profile-scripts.svelte.ts';

export function startAccount(): Promise<void> {
	return account.refresh();
}
