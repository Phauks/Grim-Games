<script lang="ts">
	import { account } from '#lib/features/account/account.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { friends } from './friends.svelte.ts';
	import type { SeatFriendState, SeatFriendTarget } from './friends-protocol.ts';

	/**
	 * Add friend for the player in a live room's seat, or its Storyteller (plan F2), in their
	 * profile. Asks the
	 * server each time the profile opens; it only offers Add when both are signed in and the
	 * player can be found (Trevor, 2026-10-29). Always the same button, so nothing moves while
	 * it loads: disabled until it can send.
	 */
	let { open, target }: { open: boolean; target: SeatFriendTarget } = $props();

	let seat = $state<SeatFriendState>();
	let busy = $state(false);
	const signedIn = $derived(account.status === 'signed-in');

	$effect(() => {
		if (!open || !signedIn) return;
		const asked = { ...target };
		seat = undefined;
		let current = true;
		friends
			.seat(asked)
			.then((answer) => {
				if (current) seat = answer.state;
			})
			.catch(() => {
				if (current) seat = 'unavailable';
			});
		return () => {
			current = false;
		};
	});

	async function add(): Promise<void> {
		if (busy) return;
		busy = true;
		try {
			const answer = await friends.seat({ ...target, send: true });
			seat = answer.state;
			if (answer.refused) toast(t(`friends.refused.${answer.refused}`));
		} catch (e) {
			toast(t('friends.failed'), e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}

	const label = $derived(
		seat === 'requested'
			? t('friends.seat.requested')
			: seat === 'friends'
				? t('friends.seat.friends')
				: seat === 'self'
					? t('friends.seat.you')
					: t('friends.add')
	);
</script>

<Button
	variant="quiet"
	icon="add"
	data-testid="seat-friend"
	data-state={signedIn ? (seat ?? 'loading') : 'signed-out'}
	disabled={!signedIn || seat !== 'add' || busy}
	onclick={() => void add()}>{label}</Button
>
