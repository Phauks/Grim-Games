<script lang="ts">
	import Select from '#lib/ui/primitives/Select.svelte';
	import { boardLooks } from './board-looks.svelte.ts';

	/** Where the script's name sits on the board (Trevor, 2026-10-17). */
</script>

<Select
	label="Script name"
	value={boardLooks.current.titleAt}
	options={[
		{ value: 'middle', label: 'Behind the circle' },
		{ value: 'toolbar', label: 'In the toolbar' },
		{ value: 'corner', label: 'Lower left corner' }
	]}
	onChange={(titleAt) => boardLooks.update({ titleAt })}
/>
