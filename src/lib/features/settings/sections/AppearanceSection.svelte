<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { ICON_SCALE, TEXT_ALIGNS, TEXT_SCALE, type TextAlign } from '#lib/ui/preferences.ts';
	import SettingChoice from '#lib/ui/settings/SettingChoice.svelte';
	import SettingSegmented from '#lib/ui/settings/SettingSegmented.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import { THEMES } from '#lib/ui/themes/registry.ts';

	const alignLabels = $derived<Record<TextAlign, string>>({
		left: t('settings.alignLeft'),
		justify: t('settings.alignJustify')
	});
</script>

<SettingChoice
	label={t('settings.theme')}
	value={preferences.theme.id}
	options={THEMES.map((theme) => ({ value: theme.id, label: theme.name }))}
	onChange={(themeId) => preferences.update({ themeId })}
/>
<SettingSlider
	label={t('settings.textSize')}
	description={t('settings.textSizeHelp')}
	value={preferences.current.textScale}
	{...TEXT_SCALE}
	format={(scale) => intl.number(scale, { style: 'percent' })}
	onChange={(textScale) => preferences.update({ textScale })}
/>
<SettingSegmented
	label={t('settings.textAlign')}
	description={t('settings.textAlignHelp')}
	value={preferences.current.textAlign}
	options={TEXT_ALIGNS.map((align) => ({ value: align, label: alignLabels[align] }))}
	onChange={(textAlign) => preferences.update({ textAlign: textAlign as TextAlign })}
/>
<SettingSlider
	label={t('settings.iconSize')}
	description={t('settings.iconSizeHelp')}
	value={preferences.current.iconScale}
	{...ICON_SCALE}
	format={(scale) => intl.number(scale, { style: 'percent' })}
	onChange={(iconScale) => preferences.update({ iconScale })}
/>
