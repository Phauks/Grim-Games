<script lang="ts">
	import { boardLooks, DEFAULT_BOARD_LOOKS } from '#lib/features/grimoire/board-looks.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';

	/**
	 * Where the Fabled and Loric sit and whether they are grouped (Trevor, 2026-10-18: labelled
	 * Location and Grouping, under a "Fabled and Loric" heading), the same store as the
	 * board's own choice.
	 */
</script>

<!-- A dropdown like the other choices in Settings; the Background dialog shows the same choice. -->
<SettingSelect
	label={t('settings.rulesAt')}
	value={boardLooks.current.rulesAt}
	options={[
		{ value: 'middle', label: t('settings.rulesAt.middle') },
		{ value: 'edge', label: t('settings.rulesAt.edge') }
	]}
	defaultValue={DEFAULT_BOARD_LOOKS.rulesAt}
	onChange={(rulesAt) => boardLooks.update({ rulesAt })}
/>
<SettingSelect
	label={t('settings.rulesGrouped')}
	value={boardLooks.current.rulesGrouped ? 'grouped' : 'each'}
	options={[
		{ value: 'each', label: t('settings.rulesGrouped.each') },
		{ value: 'grouped', label: t('settings.rulesGrouped.grouped') }
	]}
	defaultValue={DEFAULT_BOARD_LOOKS.rulesGrouped ? 'grouped' : 'each'}
	onChange={(v) => boardLooks.update({ rulesGrouped: v === 'grouped' })}
/>
