<script lang="ts">
	import Select from '#lib/ui/primitives/Select.svelte';
	import { boardLooks } from './board-looks.svelte.ts';

	interface Props {
		/** A spectator's board: its Fabled and Loric stay put (Trevor, 2026-10-27). */
		disabled?: boolean;
	}

	let { disabled = false }: Props = $props();

	/**
	 * Where the Fabled and Loric sit on the board and whether they are grouped, shown wherever
	 * they are (Trevor, 2026-10-17: "place this setting on the fabled", then "separate group
	 * and location ... into two dropdowns"): their sheets, beside Board and tokens. Labelled
	 * Location and Grouping (Trevor, 2026-10-18).
	 */
</script>

<Select
	label="Location"
	{disabled}
	value={boardLooks.current.rulesAt}
	options={[
		{ value: 'middle', label: 'Middle' },
		{ value: 'edge', label: 'Corner' }
	]}
	onChange={(rulesAt) => boardLooks.update({ rulesAt })}
/>
<Select
	label="Grouping"
	{disabled}
	value={boardLooks.current.rulesGrouped ? 'grouped' : 'each'}
	options={[
		{ value: 'each', label: 'Individual' },
		{ value: 'grouped', label: 'Stacked' }
	]}
	onChange={(v) => boardLooks.update({ rulesGrouped: v === 'grouped' })}
/>
