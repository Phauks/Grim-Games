<script lang="ts">
	import { account } from '#lib/features/account/account.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { friends } from './friends.svelte.ts';
	import type { FriendTarget, SeatFriendState } from './friends-protocol.ts';

	/**
	 * Add friend for the player in a live room's seat, or its Storyteller (plan F2), in their
	 * profile, and for someone on Recent players (F3). Asks the server each time the profile
	 * opens, unless the state is already `known`; it only offers Add when both are signed in
	 * and the player can be found (Trevor, 2026-10-29). Always the same button, so nothing
	 * moves while it loads: disabled until it can send.
	 */
	interface Props {
		open: boolean;
		target: FriendTarget;
		/** What the list already says (Recent players), so no lookup is needed. */
		known?: SeatFriendState;
		/**
		 * Only the Friends icon, its state in its name and tooltip: in a profile's header beside
		 * Close (Trevor, 2026-11-01: "friend as icon").
		 */
		iconOnly?: boolean;
	}

	let { open, target, known, iconOnly = false }: Props = $props();

	let seat = $state<SeatFriendState>();
	let busy = $state(false);
	const signedIn = $derived(account.status === 'signed-in');

	$effect(() => {
		if (!open || !signedIn) return;
		if (known) {
			seat = known;
			return;
		}
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

{#if iconOnly}
	<IconButton
		icon="friends"
		{label}
		data-testid="seat-friend"
		data-state={signedIn ? (seat ?? 'loading') : 'signed-out'}
		disabled={!signedIn || seat !== 'add' || busy}
		onclick={() => void add()}
	/>
{:else}
	<Button
		variant="quiet"
		icon="add"
		data-testid="seat-friend"
		data-state={signedIn ? (seat ?? 'loading') : 'signed-out'}
		disabled={!signedIn || seat !== 'add' || busy}
		onclick={() => void add()}>{label}</Button
	>
{/if}
