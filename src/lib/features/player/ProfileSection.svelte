<script lang="ts">
	import { DEFAULT_FRAME, seatFrame } from '#lib/core/frames/index.ts';
	import PlayerNameRow from '#lib/features/room/PlayerNameRow.svelte';
	import { joinedRoom } from '#lib/features/room/joined-room.svelte.ts';
	import { savedPlayerName } from '#lib/features/room/player.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SeatDisc from '#lib/ui/seating/SeatDisc.svelte';
	import SettingFrame from '#lib/ui/settings/SettingFrame.svelte';
	import { avatarPicture } from './avatar-picture.svelte.ts';
	import AvatarPictureRow from './AvatarPictureRow.svelte';
	import { playerSettings } from './player-settings.svelte.ts';

	/**
	 * The player's Profile (Trevor, 2026-10-27): who they are at every table, apart from how
	 * their screen looks. Their name, picture and laurel, under their seat as others see it.
	 * Opened from the button beside Settings' X, not from the section list.
	 */
	const name = $derived(joinedRoom.player?.view?.me.name ?? savedPlayerName());
</script>

<div class="preview" data-testid="profile-preview">
	<SeatDisc
		size={112}
		{name}
		number={1}
		avatar={playerSettings.current.avatar}
		picture={avatarPicture.url}
		frame={seatFrame(playerSettings.current.frame)}
	/>
</div>

<!-- This phone's name in its room, while a player screen in a room opened Settings (Trevor,
     2026-10-27: one Settings everywhere). -->
{#if joinedRoom.player}<PlayerNameRow player={joinedRoom.player} />{/if}

<!-- The player's own picture on their seat (2026-10-27). -->
<AvatarPictureRow {name} />

<!-- The laurel round this player's seat token, sent with their initials (L4, A1). -->
<SettingFrame
	label={t('player.frame')}
	colourLabel={t('player.laurelColour')}
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
</style>
