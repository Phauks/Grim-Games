<script lang="ts">
	import Button from './Button.svelte';
	import DeleteButton from './DeleteButton.svelte';
	import TextField from './TextField.svelte';

	/**
	 * A list of short texts (a character's reminders): one TextField a row with its own trash,
	 * and an add button after the last. Rows keep their order; duplicates are allowed.
	 */
	interface Props {
		label: string;
		values: readonly string[];
		onChange: (values: string[]) => void;
		/** A row's accessible name, given its 1-based number. */
		rowLabel: (number: number) => string;
		removeLabel: (number: number) => string;
		addLabel: string;
		maxlength?: number;
		testid?: string;
	}

	let { label, values, onChange, rowLabel, removeLabel, addLabel, maxlength, testid }: Props =
		$props();

	const set = (i: number, value: string) => onChange(values.map((v, j) => (j === i ? value : v)));
</script>

<fieldset class="text-list" data-testid={testid}>
	<legend>{label}</legend>
	{#each values as value, i (i)}
		<div class="row">
			<TextField label={rowLabel(i + 1)} hideLabel {value} {maxlength} oninput={(v) => set(i, v)} />
			<DeleteButton
				label={removeLabel(i + 1)}
				onclick={() => onChange(values.filter((_, j) => j !== i))}
			/>
		</div>
	{/each}
	<div class="add">
		<Button variant="quiet" icon="add" onclick={() => onChange([...values, ''])}>{addLabel}</Button>
	</div>
</fieldset>

<style>
	.text-list {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		padding: 0;
		margin-bottom: var(--space-1);
		color: var(--on-surface-muted);
		font-family: var(--font-control);
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-1);
	}
	.add {
		justify-self: start;
	}
</style>
