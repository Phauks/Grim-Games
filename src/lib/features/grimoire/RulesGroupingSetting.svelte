<script lang="ts">
	import Select from '#lib/ui/primitives/Select.svelte';
	import { boardLooks } from './board-looks.svelte.ts';

	interface Props {
		/** A spectator's board: its Fabled and Loric stay put (Trevor, 2026-10-27). */
		disabled?: boolean;
	}

	let { disabled = false }: Props = $props();

	/**
	 * Whether the Fabled and Loric are grouped, shown wherever they are (Trevor, 2026-10-17:
	 * "place this setting on the fabled"): their sheets, beside Board and tokens. They always sit
	 * in the corner, so there is no Location choice (Trevor, 2026-10-30: "only corner").
	 */
</script>

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
