<script lang="ts">
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import { boardLooks } from './board-looks.svelte.ts';

	/**
	 * Where the Fabled and Loric sit on the board, shown wherever they are (Trevor,
	 * 2026-10-17: "place this setting on the fabled"): the Background dialog and their sheets.
	 */
</script>

<Segmented
	label="Fabled and Loric"
	value={boardLooks.current.rulesAt}
	options={[
		{ value: 'middle', label: 'Middle' },
		{ value: 'edge', label: 'Edge, smaller' },
		{ value: 'corner', label: 'Corner, grouped' }
	]}
	onChange={(rulesAt) => boardLooks.update({ rulesAt })}
/>
