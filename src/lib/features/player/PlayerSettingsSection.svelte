<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import { playerSettings } from './player-settings.svelte.ts';
	import { SHEET_BACKGROUNDS } from '#lib/ui/themes/sheet-backgrounds.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import ReminderLinesSetting from '#lib/features/grimoire/ReminderLinesSetting.svelte';
</script>

<!-- Name, picture and laurel are in the Profile, from the button beside Settings' X (Trevor,
     2026-10-27). -->

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

<!-- The Grim tab's own choice; the Storyteller's board has its own in Board (Trevor, 2026-10-29). -->
<ReminderLinesSetting
	value={playerSettings.current.reminderLines}
	onChange={(reminderLines) => playerSettings.update({ reminderLines })}
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
