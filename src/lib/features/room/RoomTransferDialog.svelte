<script lang="ts">
	import { account } from '#lib/features/account/account.svelte.ts';
	import FriendRows from '#lib/features/friends/FriendRows.svelte';
	import type { FriendAccount } from '#lib/features/friends/friends-protocol.ts';
	import { friends } from '#lib/features/friends/friends.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import ShareCode from '#lib/ui/share/ShareCode.svelte';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { roomHost } from './host.svelte.ts';
	import { roomTransfer } from './room-transfer.svelte.ts';
	import VoteTimeLeft from './VoteTimeLeft.svelte';

	/**
	 * Room transfer, the Storyteller's side (Trevor, 2026-10-28), from the board's ⋯ > Session
	 * (Trevor, 2026-10-30: "room transfer should be above end game"): the room code and the
	 * transfer code another device types on Join game (⋯ > Room transfer) to become this room's
	 * Storyteller, for two minutes (Trevor, 2026-11-01). Both are here, as the other device needs both (2026-10-30).
	 * Closing it ends the transfer, so the code stops working (Trevor, 2026-10-31: no Stop
	 * transfer button, "Awaiting confirmation" at the bottom instead).
	 * Signed in, the friends with a phone in the room are listed too, each with Hand over (plan
	 * F14): their phone opens Room transfer with no code to type, and takes over from there.
	 */
	interface Props {
		open: boolean;
	}

	let { open = $bindable() }: Props = $props();

	const host = roomHost();
	const transfer = roomTransfer();

	/** Friends with a phone in the room now, by account; refreshed as phones come and go. */
	let present = $state<readonly string[]>([]);
	/** Changes only when a phone comes or goes, not on every update from the room. */
	const phones = $derived(host.present?.join(' '));
	$effect(() => {
		const code = host.code;
		void phones;
		if (!open || !code || account.status !== 'signed-in') return;
		let current = true;
		void friends.load();
		friends
			.invite({ code, title: '' })
			.then((answer) => {
				if (current) present = answer.present ?? [];
			})
			.catch(() => {
				// The list stays as it was; Hand over says if the room can't be reached.
			});
		return () => {
			current = false;
		};
	});
	const here = $derived(friends.data?.friends.filter((f) => present.includes(f.id)) ?? []);

	function handOver(friend: FriendAccount): void {
		if (!transfer.offer(friend.id)) toast(t('room.transfer.failed'));
	}

	// Closed (✕, Escape or outside): the transfer ends with it.
	let wasOpen = false;
	$effect(() => {
		if (wasOpen && !open && transfer.code) transfer.stop();
		wasOpen = open;
	});
</script>

{#snippet friendLabel(friend: FriendAccount)}{friend.username ?? t('friends.noUsername')}{/snippet}

{#snippet handOverAction(friend: FriendAccount)}
	{@const offered = host.transfer?.offered === friend.id}
	<Button
		variant={offered ? 'quiet' : 'accent'}
		disabled={offered || !host.transfer}
		onclick={() => handOver(friend)}
		>{offered ? t('room.transfer.offered') : t('room.transfer.handOver')}</Button
	>
{/snippet}

<Dialog bind:open title={t('room.transfer.title')}>
	<div class="transfer" data-testid="room-transfer">
		<ShareCode
			label={t('room.transfer.roomCode')}
			value={host.code && formatRoomCode(host.code)}
			testid="transfer-room-code"
		/>
		<ShareCode
			label={t('room.transfer.code')}
			value={transfer.code}
			testid="transfer-code"
			hideable
		/>
		<!-- Always in its place, so the switches below never move. -->
		<div class="time">
			<VoteTimeLeft
				endsAt={host.transfer?.endsAt}
				text={(time) => t('room.transfer.expires', { time })}
				endedText={t('room.transfer.expired')}
				testid="transfer-time"
			/>
		</div>
		<SettingToggle
			label={t('room.transfer.bringGame')}
			checked={transfer.bringGame}
			onChange={(on) => transfer.setBringGame(on)}
		/>
		<SettingToggle
			label={t('room.transfer.joinAsPlayer')}
			checked={transfer.joinAsPlayer}
			onChange={(on) => (transfer.joinAsPlayer = on)}
		/>
		{#if account.status === 'signed-in'}
			<section class="friends" aria-labelledby="transfer-friends">
				<h3 id="transfer-friends">{t('room.transfer.friends')}</h3>
				<FriendRows
					items={here}
					key={(friend) => friend.id}
					testid="transfer-friends"
					icon={(friend) => friend.icon}
					label={friendLabel}
					actions={handOverAction}
				/>
			</section>
		{/if}
		<p class="awaiting" data-testid="transfer-awaiting">{t('room.transfer.awaiting')}</p>
	</div>
</Dialog>

<style>
	.transfer {
		display: grid;
		gap: var(--space-2);
	}
	.time {
		min-height: 1.5em;
	}
	.friends h3 {
		margin: 0;
		font-size: 1rem;
	}
	.awaiting {
		margin: 0;
		color: var(--on-surface-muted);
		text-align: end;
	}
</style>
