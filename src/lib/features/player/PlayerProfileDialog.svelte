<script lang="ts">
	import type { AvatarId } from '#lib/core/avatars/index.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import { seatFrame, type FrameId } from '#lib/core/frames/index.ts';
	import SeatFriendButton from '#lib/features/friends/SeatFriendButton.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import SeatDisc from '#lib/ui/seating/SeatDisc.svelte';
	import { seatProfileRows } from './seat-profile.ts';

	/**
	 * A player's profile, opened from their avatar on a grim (Trevor, 2026-10-28): their avatar
	 * large in their laurel, then a row for each thing about the PLAYER, never their character.
	 * Game stats join the rows later. The board's Storyteller and the town's phones open the same.
	 * In a live room, `friend` names the seat, and a row offers Add friend (plan F2).
	 */
	interface Props {
		open?: boolean;
		name: PlayerName;
		avatar: AvatarId;
		picture?: string;
		frame?: FrameId;
		friend?: { code: string; seatId: string };
	}

	let { open = $bindable(false), name, avatar, picture, frame, friend }: Props = $props();

	const rows = $derived(seatProfileRows(frame));
	let roomWidth = $state(0);
	let screenHeight = $state(0);
	const bigSize = $derived(Math.max(0, Math.min(roomWidth * 0.6, screenHeight * 0.4)));
</script>

<svelte:window bind:innerHeight={screenHeight} />

<!-- eslint-disable-next-line grim/names-as-badges -- the dialog's plain-text name; shown as a badge (heading) -->
<Dialog bind:open title={name}>
	{#snippet heading()}<PlayerBadge {name} />{/snippet}
	<div class="profile" data-testid="player-profile">
		<div class="big" bind:clientWidth={roomWidth}>
			{#if bigSize}<SeatDisc
					size={bigSize}
					{name}
					number={1}
					{avatar}
					{picture}
					frame={seatFrame(frame)}
				/>{/if}
		</div>
		<dl class="rows">
			{#each rows as row (row.id)}
				<div class="row" data-testid="player-profile-{row.id}">
					<dt>{row.label}</dt>
					<dd>
						{#if row.swatch}<span class="swatch" style:background={row.swatch}
							></span>{/if}{row.value}
					</dd>
				</div>
			{/each}
			{#if friend}
				<div class="row" data-testid="player-profile-friend">
					<dt>{t('player.seatProfile.friend')}</dt>
					<dd><SeatFriendButton {open} code={friend.code} seatId={friend.seatId} /></dd>
				</div>
			{/if}
		</dl>
	</div>
</Dialog>

<style>
	.big {
		display: grid;
		justify-items: center;
		padding-block: var(--space-3);
	}
	.rows {
		margin: 0;
	}
	/* Rows with dividers, as in Settings. */
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-height: var(--tap-target);
		border-top: 1px solid var(--border);
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
	}
	.swatch {
		width: 1.25em;
		height: 1.25em;
		border-radius: 50%;
		box-shadow: var(--button-ring);
	}
</style>
