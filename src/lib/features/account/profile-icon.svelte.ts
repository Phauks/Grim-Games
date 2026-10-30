/**
 * The account's icon follows the Profile's character token (Trevor, 2026-10-30: Account's own
 * icon row went, "since we now have a profile area"). The menu's Account link and Friends
 * still show the account's icon, so a pick in the Profile is sent to the account. A device
 * whose Profile has no token leaves the account's icon alone until the player picks one, so
 * signing in on a new device never clears it.
 */
import { untrack } from 'svelte';
import { avatarCharacter } from '#lib/core/avatars/index.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { playerSettings } from '#lib/features/player/player-settings.svelte.ts';
import { accountApi } from './account-api.ts';
import { account } from './account.svelte.ts';

if (typeof window !== 'undefined') {
	$effect.root(() => {
		let previous = untrack(() => avatarCharacter(playerSettings.current.avatar));
		$effect(() => {
			const chosen = avatarCharacter(playerSettings.current.avatar);
			const user = account.user;
			const changed = chosen !== previous;
			previous = chosen;
			if (!user || (chosen ?? null) === (user.icon ?? null)) return;
			if (!chosen && !changed) return;
			untrack(() => {
				void accountApi
					.setIcon(chosen ?? null)
					.then((next) => account.updated(next))
					.catch((e) => reportError(e, { area: 'account', notify: false }));
			});
		});
	});
}
