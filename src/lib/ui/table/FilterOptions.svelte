<script lang="ts">
	/**
	 * A column filter's list of options: radio buttons to pick one, or checkboxes to pick any
	 * (component review, 2026-10-18: the Search, Reference, History and Library filters each
	 * drew their own). Each option is a full tap target high.
	 */
	interface Option {
		value: string;
		label: string;
	}

	type Props = {
		/** Names the list, e.g. "Character types". */
		legend: string;
		/** The legend stays the accessible name but isn't shown. */
		hideLegend?: boolean;
		options: readonly Option[];
		/** Shown in place of the options when there are none. */
		empty?: string;
	} & (
		| {
				/** Pick one; `name` groups the radio buttons. */
				name: string;
				value: string;
				onpick: (value: string) => void;
				values?: never;
				ontoggle?: never;
		  }
		| {
				/** Pick any. */
				values: readonly string[];
				ontoggle: (value: string, on: boolean) => void;
				name?: never;
				value?: never;
				onpick?: never;
		  }
	);

	let props: Props = $props();
</script>

<fieldset class="filter-options">
	<legend class={props.hideLegend ? 'visually-hidden' : undefined}>{props.legend}</legend>
	{#each props.options as option (option.value)}
		<label class="option">
			{#if props.values}
				<input
					type="checkbox"
					checked={props.values.includes(option.value)}
					onchange={(e) => props.ontoggle?.(option.value, e.currentTarget.checked)}
				/>
			{:else}
				<input
					type="radio"
					name={props.name}
					value={option.value}
					checked={props.value === option.value}
					onchange={() => props.onpick?.(option.value)}
				/>
			{/if}
			{option.label}
		</label>
	{:else}
		{#if props.empty}<p class="muted">{props.empty}</p>{/if}
	{/each}
</fieldset>

<style>
	.filter-options {
		display: grid;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		padding: 0;
		margin-bottom: var(--space-1);
		font-weight: 600;
	}
	.option {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--tap-target);
	}
	.option input {
		width: calc(1.25 * var(--u));
		height: calc(1.25 * var(--u));
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
