<script lang="ts">
	import Select from '#lib/ui/primitives/Select.svelte';
	import { boardLooks } from './board-looks.svelte.ts';

	/**
	 * Where the Fabled and Loric sit on the board and whether they are grouped, shown wherever
	 * they are (Trevor, 2026-10-17: "place this setting on the fabled", then "separate group
	 * and location ... into two dropdowns"): the Background dialog and their sheets. Labelled
	 * Location and Grouping (Trevor, 2026-10-18); among other settings `titled` heads them
	 * "Fabled and Loric".
	 */
	interface Props {
		titled?: boolean;
	}

	let { titled = false }: Props = $props();
</script>

{#if titled}<h3>Fabled and Loric</h3>{/if}

<Select
	label="Location"
	value={boardLooks.current.rulesAt}
	options={[
		{ value: 'middle', label: 'Middle' },
		{ value: 'edge', label: 'Corner' }
	]}
	onChange={(rulesAt) => boardLooks.update({ rulesAt })}
/>
<Select
	label="Grouping"
	value={boardLooks.current.rulesGrouped ? 'grouped' : 'each'}
	options={[
		{ value: 'each', label: 'Individual' },
		{ value: 'grouped', label: 'Grouped' }
	]}
	onChange={(v) => boardLooks.update({ rulesGrouped: v === 'grouped' })}
/>

<style>
	h3 {
		margin: var(--space-3) 0 0;
		font-family: var(--font-control);
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
</style>
