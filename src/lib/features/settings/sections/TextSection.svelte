<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import {
		DEFAULT_PREFERENCES,
		TEXT_ALIGNS,
		TEXT_SCALE,
		type TextAlign
	} from '#lib/ui/preferences.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import FontPreview from './FontPreview.svelte';
	import { TEXT_FONT_ROLES } from './font-roles.ts';
	import RulesTermsSection from './RulesTermsSection.svelte';

	const alignLabels = $derived<Record<TextAlign, string>>({
		left: t('settings.alignLeft'),
		justify: t('settings.alignJustify')
	});
</script>

<!-- Text (Trevor, 2026-10-18: split from Theme): the fonts on their preview lines, size,
     alignment and the rules-term underline. Character names and Reminder tokens fonts are in
     Tokens, beside their previews (Trevor, 2026-10-18). -->
<FontPreview roles={TEXT_FONT_ROLES} />
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
