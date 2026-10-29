<script lang="ts">
	import { DEFAULT_FRAME, seatFrame } from '#lib/core/frames/index.ts';
	import PlayerNameRow from '#lib/features/room/PlayerNameRow.svelte';
	import { joinedRoom } from '#lib/features/room/joined-room.svelte.ts';
	import { savedPlayerName } from '#lib/features/room/player.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import SeatDisc from '#lib/ui/seating/SeatDisc.svelte';
	import SettingFrame from '#lib/ui/settings/SettingFrame.svelte';
	import { avatarPicture } from './avatar-picture.svelte.ts';
	import AvatarPictureRow from './AvatarPictureRow.svelte';
	import CharacterIconRow from './CharacterIconRow.svelte';
	import FlavourTextRow from './FlavourTextRow.svelte';
	import { playerSettings } from './player-settings.svelte.ts';

	/**
	 * The player's Profile (Trevor, 2026-10-27): who they are at every table, apart from how
	 * their screen looks. Their name, picture and laurel, under their seat as others see it.
	 * Opened from the button beside Settings' X, not from the section list.
	 */
	const name = $derived(joinedRoom.player?.view?.me.name ?? savedPlayerName());
	const frame = $derived(seatFrame(playerSettings.current.frame));

	// Tapping the seat shows it large, over the Profile (Trevor, 2026-10-28), so nothing moves.
	let enlarged = $state(false);
	let roomWidth = $state(0);
	let screenHeight = $state(0);
	const bigSize = $derived(Math.max(0, Math.min(roomWidth * 0.85, screenHeight * 0.6)));
</script>

<svelte:window bind:innerHeight={screenHeight} />

{#snippet seat(size: number)}
	<SeatDisc
		{size}
		{name}
		number={1}
		avatar={playerSettings.current.avatar}
		picture={avatarPicture.url}
		{frame}
		fullColour
	/>
{/snippet}

<div class="preview">
	<button
		type="button"
		class="enlarge"
		aria-label={t('player.bigPreview')}
		data-testid="profile-preview"
		onclick={() => (enlarged = true)}>{@render seat(112)}</button
	>
</div>

<Dialog bind:open={enlarged} title={t('player.bigPreview')} size="wide">
	<div class="big" bind:clientWidth={roomWidth} data-testid="profile-big-preview">
		{#if bigSize}{@render seat(bigSize)}{/if}
	</div>
</Dialog>

<!-- This phone's name: in its room while it is in one, else kept for the next (Trevor,
     2026-10-28: the Profile is where the player name is set). -->
<PlayerNameRow player={joinedRoom.player} />

<!-- A line about themselves, kept for later uses (Trevor, 2026-10-28). -->
<FlavourTextRow />

<!-- The character that represents them, on top of their laurel (Trevor, 2026-10-28). -->
<CharacterIconRow />

<!-- The player's own picture on their seat (2026-10-27). -->
<AvatarPictureRow {name} />

<!-- The laurel round this player's seat token, sent with their initials (L4, A1). -->
<SettingFrame
	label={t('player.frame')}
	colourLabel={t('player.frameColour')}
	motionLabel={t('player.frameMotion')}
	value={playerSettings.current.frame ?? DEFAULT_FRAME}
	defaultValue={DEFAULT_FRAME}
	onChange={(frame) =>
		playerSettings.update({ frame: frame === DEFAULT_FRAME ? undefined : frame })}
	testid="player-frame-setting"
/>

<style>
	.preview {
		display: grid;
		justify-items: center;
		padding-block: var(--space-3);
	}
	.enlarge {
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		color: inherit;
		cursor: zoom-in;
	}
	.big {
		display: grid;
		justify-items: center;
		padding-block: var(--space-3);
	}
</style>
