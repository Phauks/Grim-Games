<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import { playerSettings } from './player-settings.svelte.ts';
	import { SHEET_BACKGROUNDS } from '#lib/ui/themes/sheet-backgrounds.ts';
	import PrintSettingsFields from './PrintSettingsFields.svelte';
	import PlayerNameRow from '#lib/features/room/PlayerNameRow.svelte';
	import { joinedRoom } from '#lib/features/room/joined-room.svelte.ts';
	import SettingCollapsible from '#lib/ui/settings/SettingCollapsible.svelte';
	import SettingFrame from '#lib/ui/settings/SettingFrame.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import AvatarPictureRow from './AvatarPictureRow.svelte';
	import { DEFAULT_FRAME } from '#lib/core/frames/index.ts';
</script>

<!-- This phone's name in its room, while a player screen in a room opened Settings (Trevor,
     2026-10-27: one Settings everywhere). -->
{#if joinedRoom.player}<PlayerNameRow player={joinedRoom.player} />{/if}

<!-- The player's own picture on their seat (2026-10-27). -->
<AvatarPictureRow name={joinedRoom.player?.view?.me.name} />

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

<!-- Also the eye on the Grim tab, as a note's own (Trevor, 2026-10-26). -->
<SettingToggle
	label={t('player.hideGuesses')}
	checked={playerSettings.current.hideGuesses}
	onChange={(hideGuesses) => playerSettings.update({ hideGuesses })}
/>

<!-- Also beside the Grim tab's eye and in Public Town's settings cog (Trevor, 2026-10-27). -->
<SettingToggle
	label={t('player.matchShape')}
	description={t('player.matchShapeDetail')}
	checked={playerSettings.current.matchShape}
	onChange={(matchShape) => playerSettings.update({ matchShape })}
/>
<SettingToggle
	label={t('player.townMatchShape')}
	checked={playerSettings.current.townMatchShape}
	onChange={(townMatchShape) => playerSettings.update({ townMatchShape })}
/>

<!-- Also at the top of every script sheet (Trevor, 2026-10-23; colours 2026-10-24). -->
<SettingSelect
	label={t('player.sheetBackground')}
	value={playerSettings.current.sheetBackground}
	options={SHEET_BACKGROUNDS.map((value) => ({
		value,
		label: t(`player.sheetBackground.${value}`)
	}))}
	defaultValue="theme"
	onChange={(sheetBackground) => playerSettings.update({ sheetBackground })}
/>

<!-- Also in Print's own screen (Trevor: every setting in Settings and where it is used). -->
<SettingCollapsible title={t('player.printSettings')} storageKey="settings-player-print">
	<PrintSettingsFields />
</SettingCollapsible>
