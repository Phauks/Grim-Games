<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { DEFAULT_PREFERENCES, TEXT_ALIGNS, type TextAlign } from '#lib/ui/preferences.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import FontPreview from './FontPreview.svelte';
	import { TEXT_FONT_ROLES } from './font-roles.ts';
	import RulesTermsSection from './RulesTermsSection.svelte';
	import TextSizeRows from './TextSizeRows.svelte';

	const alignLabels = $derived<Record<TextAlign, string>>({
		left: t('settings.alignLeft'),
		justify: t('settings.alignJustify')
	});
</script>

<!-- Text (Trevor, 2026-10-18: split from Theme): the fonts on their preview lines, size,
     alignment and the rules-term underline. Character names and Reminder tokens fonts are in
     Tokens, beside their previews (Trevor, 2026-10-18). -->
<FontPreview roles={TEXT_FONT_ROLES} />
<TextSizeRows />
<SettingSelect
	label={t('settings.textAlign')}
	description={t('settings.textAlignHelp')}
	value={preferences.current.textAlign}
	defaultValue={DEFAULT_PREFERENCES.textAlign}
	options={TEXT_ALIGNS.map((align) => ({ value: align, label: alignLabels[align] }))}
	onChange={(textAlign) => preferences.update({ textAlign: textAlign as TextAlign })}
/>
<RulesTermsSection />
