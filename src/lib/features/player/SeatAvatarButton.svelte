<script lang="ts">
	import type { AvatarId } from '#lib/core/avatars/index.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import type { FrameId } from '#lib/core/frames/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import AvatarFace from '#lib/ui/seating/AvatarFace.svelte';
	import PlayerProfileDialog from './PlayerProfileDialog.svelte';

	/**
	 * A seat's avatar in its sheet's header (2026-10-27); a tap opens that player's profile
	 * (Trevor, 2026-10-28), over the sheet so nothing moves.
	 */
	interface Props {
		name: PlayerName;
		avatar: AvatarId;
		picture?: string;
		frame?: FrameId;
		/** The live room and seat, for Add friend (plan F2). */
		friend?: { code: string; seatId: string };
	}

	let { name, avatar, picture, frame, friend }: Props = $props();
	let open = $state(false);
</script>

<button
	type="button"
	class="seat-avatar"
	data-testid="sheet-avatar"
	aria-label={t('player.seatProfile.open', { name })}
	onclick={() => (open = true)}
	><span class="face"><AvatarFace {avatar} {name} {picture} /></span></button
>
<PlayerProfileDialog bind:open {name} {avatar} {picture} {frame} {friend} />

<style>
	.seat-avatar {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		color: inherit;
		cursor: zoom-in;
	}
	.face {
		display: block;
		width: calc(2.5 * var(--u));
		height: calc(2.5 * var(--u));
	}
</style>
