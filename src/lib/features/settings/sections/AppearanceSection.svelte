<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { TEXT_ALIGNS, TEXT_SCALE, type TextAlign } from '#lib/ui/preferences.ts';
	import SettingChoice from '#lib/ui/settings/SettingChoice.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import { DEFAULT_PREFERENCES } from '#lib/ui/preferences.ts';
	import { THEMES } from '#lib/ui/themes/registry.ts';
	import FontPreview from './FontPreview.svelte';
	import RulesTermsSection from './RulesTermsSection.svelte';

	const alignLabels = $derived<Record<TextAlign, string>>({
		left: t('settings.alignLeft'),
		justify: t('settings.alignJustify')
	});
</script>

<!-- Theme and text (Trevor, 2026-10-17): theme, text size and alignment, and the rules-term
     underline; the preview, with each font's drop-down, stays at the top while these scroll. -->
<FontPreview />
<SettingChoice
	label={t('settings.theme')}
	value={preferences.theme.id}
	defaultValue={DEFAULT_PREFERENCES.themeId}
	options={THEMES.map((theme) => ({ value: theme.id, label: theme.name }))}
	onChange={(themeId) => preferences.update({ themeId })}
/>
<SettingSlider
	label={t('settings.textSize')}
	description={t('settings.textSizeHelp')}
	value={preferences.current.textScale}
	defaultValue={DEFAULT_PREFERENCES.textScale}
	{...TEXT_SCALE}
	format={(scale) => intl.number(scale, { style: 'percent' })}
	onChange={(textScale) => preferences.update({ textScale })}
/>
<SettingSelect
	label={t('settings.textAlign')}
	description={t('settings.textAlignHelp')}
	value={preferences.current.textAlign}
	defaultValue={DEFAULT_PREFERENCES.textAlign}
	options={TEXT_ALIGNS.map((align) => ({ value: align, label: alignLabels[align] }))}
	onChange={(textAlign) => preferences.update({ textAlign: textAlign as TextAlign })}
/>
<RulesTermsSection />
