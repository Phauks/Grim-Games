<script lang="ts">
	import Select from '#lib/ui/primitives/Select.svelte';
	import { boardLooks } from './board-looks.svelte.ts';

	/**
	 * Where the Fabled and Loric sit on the board and whether they are grouped, shown wherever
	 * they are (Trevor, 2026-10-17: "place this setting on the fabled", then "separate group
	 * and location ... into two dropdowns"): the Background dialog and their sheets.
	 */
</script>

<Select
	label="Fabled and Loric"
	value={boardLooks.current.rulesAt}
	options={[
		{ value: 'middle', label: 'Middle' },
		{ value: 'edge', label: 'Corner, smaller' }
	]}
	onChange={(rulesAt) => boardLooks.update({ rulesAt })}
/>
<Select
	label="Fabled and Loric grouping"
	value={boardLooks.current.rulesGrouped ? 'grouped' : 'each'}
	options={[
		{ value: 'each', label: 'Each on its own' },
		{ value: 'grouped', label: 'Grouped' }
	]}
	onChange={(v) => boardLooks.update({ rulesGrouped: v === 'grouped' })}
/>
