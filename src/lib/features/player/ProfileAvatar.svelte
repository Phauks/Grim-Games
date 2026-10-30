<script lang="ts">
	import { FACE_RADIUS, seatFrame } from '#lib/core/frames/index.ts';
	import { joinedRoom } from '#lib/features/room/joined-room.svelte.ts';
	import { savedPlayerName } from '#lib/features/room/player.svelte.ts';
	import AvatarFace from '#lib/ui/seating/AvatarFace.svelte';
	import CharacterEmblem from '#lib/ui/seating/CharacterEmblem.svelte';
	import FrameDrawing from '#lib/ui/seating/FrameDrawing.svelte';
	import { avatarPicture } from './avatar-picture.svelte.ts';
	import { playerSettings } from './player-settings.svelte.ts';

	/**
	 * The player's own avatar from their Profile, in their laurel with the character icon in
	 * full colour (Trevor, 2026-10-28). It fills the box its parent gives it: Settings' Profile
	 * button, and the middle of the friend code on Friends (2026-10-30).
	 */
	const frame = $derived(seatFrame(playerSettings.current.frame));
	const name = $derived(joinedRoom.player?.view?.me.name ?? savedPlayerName());
</script>

<span class="avatar" data-testid="profile-avatar"
	><span class="face" style:inset="{50 - (frame.faceRadius ?? FACE_RADIUS)}%"
		><AvatarFace avatar={playerSettings.current.avatar} {name} picture={avatarPicture.url} /></span
	>
	{#if frame.drawing.length}<span class="drawn"><FrameDrawing {frame} /></span>{/if}<CharacterEmblem
		avatar={playerSettings.current.avatar}
		fullColour
	/></span
>

<style>
	.avatar {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
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
