<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import { playerSettings } from './player-settings.svelte.ts';
	import { SHEET_BACKGROUNDS } from '#lib/ui/themes/sheet-backgrounds.ts';
	import PrintSettingsFields from './PrintSettingsFields.svelte';
	import DensityRow from './DensityRow.svelte';
	import PlayerSizeRows from './PlayerSizeRows.svelte';
	import SettingCollapsible from '#lib/ui/settings/SettingCollapsible.svelte';
	import SettingFrame from '#lib/ui/settings/SettingFrame.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import AvatarPictureRow from './AvatarPictureRow.svelte';

	/** The frame choice that leaves it to the Storyteller's board. */
	const STORYTELLER = 'storyteller';
</script>

<!-- The player's own picture on their seat (2026-10-27), also in the player screen's settings. -->
<AvatarPictureRow />

<!-- The frame round this player's seat token, sent with their initials (L4). -->
<SettingFrame
	label={t('player.frame')}
	value={playerSettings.current.frame ?? STORYTELLER}
	defaultValue={STORYTELLER}
	lead={{ value: STORYTELLER, label: t('player.frameStoryteller') }}
	onChange={(frame) => playerSettings.update({ frame: frame === STORYTELLER ? undefined : frame })}
	testid="player-frame-setting"
/>

<!-- Also the eye on the Grim tab, as a note's own (Trevor, 2026-10-26). -->
<SettingToggle
	label={t('player.hideGuesses')}
	checked={playerSettings.current.hideGuesses}
	onChange={(hideGuesses) => playerSettings.update({ hideGuesses })}
/>

<!-- Also in the player screen's own settings (plan E2). -->
<DensityRow />

<!-- Text and token sizes, also in Settings > Tokens and the player screen's cog (Trevor,
     2026-10-27). -->
<SettingCollapsible title={t('player.sizes')} storageKey="settings-player-sizes">
	<PlayerSizeRows />
</SettingCollapsible>

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
