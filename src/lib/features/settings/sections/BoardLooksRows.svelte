<script lang="ts">
	import {
		boardLooks,
		DEFAULT_BOARD_LOOKS,
		LOGO_OPACITY
	} from '#lib/features/grimoire/board-looks.svelte.ts';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import ReminderLinesSetting from '#lib/features/grimoire/ReminderLinesSetting.svelte';

	/**
	 * The board's device looks (Trevor, 2026-10-17: settings appear where they act and in
	 * Settings), the same store as the board's Background dialog, so both change one value.
	 */
</script>

<SettingToggle
	label={t('settings.vignette')}
	checked={boardLooks.current.vignette}
	onChange={(vignette) => boardLooks.update({ vignette })}
/>
<SettingSlider
	label={t('settings.vignetteStrength')}
	value={boardLooks.current.vignetteStrength}
	min={0}
	max={1}
	step={0.05}
	defaultValue={DEFAULT_BOARD_LOOKS.vignetteStrength}
	disabled={!boardLooks.current.vignette}
	format={(strength) => intl.number(strength, { style: 'percent' })}
	onChange={(vignetteStrength) => boardLooks.update({ vignetteStrength })}
/>
<SettingToggle
	label={t('settings.scriptLogo')}
	checked={boardLooks.current.logo}
	onChange={(logo) => boardLooks.update({ logo })}
/>
<SettingSlider
	label={t('settings.scriptLogoOpacity')}
	value={boardLooks.current.logoOpacity}
	{...LOGO_OPACITY}
	defaultValue={DEFAULT_BOARD_LOOKS.logoOpacity}
	disabled={!boardLooks.current.logo}
	format={(opacity) => intl.number(opacity, { style: 'percent' })}
	onChange={(logoOpacity) => boardLooks.update({ logoOpacity })}
/>
<!-- A used ghost vote: grey outline ghost, or struck through in red (Trevor, 2026-10-19). -->
<SettingToggle
	label={t('settings.strikeUsedGhostVote')}
	checked={boardLooks.current.usedGhostVote === 'struck'}
	onChange={(struck) => boardLooks.update({ usedGhostVote: struck ? 'struck' : 'hollow' })}
/>
<!-- When a reminder shows its line back to its seat (Trevor, 2026-10-29); the preview's too. -->
<ReminderLinesSetting
	value={boardLooks.current.reminderLines}
	onChange={(reminderLines) => boardLooks.update({ reminderLines })}
/>
