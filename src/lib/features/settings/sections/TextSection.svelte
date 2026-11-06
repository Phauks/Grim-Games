<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import FontPreview from './FontPreview.svelte';
	import { TEXT_FONT_ROLES } from './font-roles.ts';
	import RulesTermsSection from './RulesTermsSection.svelte';
	import TextSizeRows from './TextSizeRows.svelte';
</script>

<!-- Text (Trevor, 2026-10-18: split from Theme): the fonts on their preview lines, size,
     alignment and the rules-term underline. Character names and Reminder tokens fonts are in
     Tokens, beside their previews (Trevor, 2026-10-18). -->
<FontPreview roles={TEXT_FONT_ROLES} />
<TextSizeRows />
<!-- Two states, so a switch (Trevor, 2026-11-06): on spreads paragraphs to both edges. -->
<SettingToggle
	label={t('settings.textAlign')}
	description={t('settings.textAlignHelp')}
	checked={preferences.current.textAlign === 'justify'}
	onChange={(on) => preferences.update({ textAlign: on ? 'justify' : 'left' })}
/>
<RulesTermsSection />
