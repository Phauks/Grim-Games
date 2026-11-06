<script lang="ts">
	import { REMINDER_NUMBER_MAX, REMINDER_NUMBER_MIN } from '#lib/core/model/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';

	/**
	 * A held # token's number, picked in its pill beside the token (plan M48, Trevor
	 * 2026-11-04: any number but 1 took going into its settings): the Storyteller's
	 * (ReminderHandPill) and a player's (player/PlayerReminderBin) alike.
	 */
	interface Props {
		value: number;
		onchange: (n: number) => void;
	}

	let { value, onchange }: Props = $props();
</script>

<NumberSelect
	label={t('common.reminderNumber')}
	hideLabel
	{value}
	min={REMINDER_NUMBER_MIN}
	max={REMINDER_NUMBER_MAX}
	{onchange}
	testid="hand-number"
/>
