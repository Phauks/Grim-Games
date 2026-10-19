<script lang="ts">
	import {
		boardLooks,
		DEFAULT_BOARD_LOOKS,
		LOGO_OPACITY,
		NAME_OFFSET,
		NAME_SIZE
	} from '#lib/features/grimoire/board-looks.svelte.ts';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';

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
	format={(opacity) => intl.number(opacity, { style: 'percent' })}
	onChange={(logoOpacity) => boardLooks.update({ logoOpacity })}
/>
<SettingSlider
	label={t('settings.nameSize')}
	value={boardLooks.current.nameSize}
	{...NAME_SIZE}
	defaultValue={DEFAULT_BOARD_LOOKS.nameSize}
	format={(size) => intl.number(size, { style: 'percent' })}
	onChange={(nameSize) => boardLooks.update({ nameSize })}
/>
<!-- Clear of the character's name on the token (Trevor, 2026-10-18). -->
<SettingSlider
	label={t('settings.nameOffset')}
	value={boardLooks.current.nameOffset}
	{...NAME_OFFSET}
	defaultValue={DEFAULT_BOARD_LOOKS.nameOffset}
	format={(offset) => intl.number(offset, { style: 'percent' })}
	onChange={(nameOffset) => boardLooks.update({ nameOffset })}
/>
<!-- A used ghost vote: grey outline ghost, or struck through in red (Trevor, 2026-10-19). -->
<SettingToggle
	label={t('settings.strikeUsedGhostVote')}
	checked={boardLooks.current.usedGhostVote === 'struck'}
	onChange={(struck) => boardLooks.update({ usedGhostVote: struck ? 'struck' : 'hollow' })}
/>
