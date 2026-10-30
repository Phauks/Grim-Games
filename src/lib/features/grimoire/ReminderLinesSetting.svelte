<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import { DEFAULT_REMINDER_LINES, REMINDER_LINES, type ReminderLines } from './reminder-lines.ts';

	/**
	 * When a reminder shows its line back to its seat (Trevor, 2026-10-29), one row for the
	 * Storyteller's board (Settings › Board) and one for a player's Grim tab (Settings › Player),
	 * each keeping its own choice.
	 */
	interface Props {
		value: ReminderLines;
		onChange: (value: ReminderLines) => void;
	}

	let { value, onChange }: Props = $props();
</script>

<SettingSelect
	label={t('settings.reminderLines')}
	{value}
	options={REMINDER_LINES.map((line) => ({
		value: line,
		label: t(`settings.reminderLines.${line}`)
	}))}
	defaultValue={DEFAULT_REMINDER_LINES}
	{onChange}
/>
