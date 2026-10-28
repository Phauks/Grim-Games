<script lang="ts">
	import { FACE_RADIUS, seatFrame } from '#lib/core/frames/index.ts';
	import { joinedRoom } from '#lib/features/room/joined-room.svelte.ts';
	import { savedPlayerName } from '#lib/features/room/player.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import AvatarFace from '#lib/ui/seating/AvatarFace.svelte';
	import FrameDrawing from '#lib/ui/seating/FrameDrawing.svelte';
	import { avatarPicture } from './avatar-picture.svelte.ts';
	import { playerSettings } from './player-settings.svelte.ts';

	/**
	 * Opens the Profile from Settings' header, beside the X (Trevor, 2026-10-27): the player's
	 * own avatar in their laurel, so it reads as "you" without a label.
	 */
	let { onclick }: { onclick: () => void } = $props();
	const frame = $derived(seatFrame(playerSettings.current.frame));
	const name = $derived(joinedRoom.player?.view?.me.name ?? savedPlayerName());
</script>

<button
	type="button"
	class="profile-button"
	aria-label={t('player.profile')}
	data-testid="profile-button"
	{onclick}
>
	<span class="face" style:inset="{50 - (frame.faceRadius ?? FACE_RADIUS)}%"
		><AvatarFace avatar={playerSettings.current.avatar} {name} picture={avatarPicture.url} /></span
	>
	{#if frame.drawing.length}<span class="drawn"><FrameDrawing {frame} /></span>{/if}
</button>

<style>
	.profile-button {
		position: relative;
		flex: none;
		width: var(--tap-target);
		height: var(--tap-target);
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}
	.face {
		position: absolute;
		overflow: hidden;
		border-radius: 50%;
		background: var(--token-face);
	}
	.drawn {
		position: absolute;
		inset: 0;
	}
</style>
