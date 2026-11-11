<script lang="ts">
	import type { ReminderLabel } from '#lib/core/data/index.ts';
	import { REMINDER_NUMBER_MAX, REMINDER_NUMBER_MIN } from '#lib/core/model/index.ts';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';

	/**
	 * Beside a held token in its pill, what it can be before it goes down: a # token's number
	 * (plan M48, Trevor 2026-11-04: any number but 1 took going into its settings), or which of
	 * a stacked counting run's tokens (Trevor, 2026-11-06: stacked in the bin). The Storyteller's
	 * pill (ReminderHandPill) and a player's (player/PlayerReminderBin) alike (Trevor,
	 * 2026-11-06: "the same components for parity"). Neither, nothing.
	 */
	interface Props {
		number?: number;
		onNumber: (n: number) => void;
		/** The run's tokens still to place, in order, and the one on top. */
		run?: { labels: readonly ReminderLabel[]; label: ReminderLabel };
		onRun: (label: ReminderLabel) => void;
	}

	let { number, onNumber, run, onRun }: Props = $props();
</script>

{#if number !== undefined}<NumberSelect
		label={t('common.reminderNumber')}
		hideLabel
		value={number}
		min={REMINDER_NUMBER_MIN}
		max={REMINDER_NUMBER_MAX}
		onchange={onNumber}
		testid="hand-number"
	/>{:else if run && run.labels.length > 1}<!-- eslint-disable grim/names-as-badges -- each token shows as its badge (the snippets); its words are the options' accessible names --><Select
		label={t('common.reminderRun')}
		hideLabel
		value={run.label}
		options={run.labels.map((value) => ({ value, label: value }))}
		onChange={(v) => onRun(v as ReminderLabel)}
	>
		{#snippet item(option)}<ReminderToken label={option.value as ReminderLabel} />{/snippet}
		{#snippet selected(option)}<ReminderToken label={option.value as ReminderLabel} />{/snippet}
	</Select><!-- eslint-enable grim/names-as-badges -->{/if}
