<script lang="ts">
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import { LOCALES, type LocaleId } from '#lib/i18n/locales.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';

	/**
	 * The interface language (Trevor, 2026-10-25: a Language tab, English only for now). Only
	 * released languages are offered; a language being translated joins the list when its
	 * catalog is complete. Per device, never in a profile or a room.
	 */
	const options = LOCALES.filter((info) => info.released).map((info) => ({
		value: info.id as LocaleId,
		label: info.name
	}));
</script>

<SettingSelect
	label={t('settings.language')}
	value={locale.current}
	{options}
	onChange={(id) => void locale.set(id)}
/>
