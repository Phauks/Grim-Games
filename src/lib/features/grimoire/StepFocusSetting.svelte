<script lang="ts">
	import Select from '#lib/ui/primitives/Select.svelte';
	import { stepFocus } from './step-focus.svelte.ts';

	/**
	 * How a walked-through night step's reminders are shown in the reminder bank (Trevor,
	 * 2026-10-17), on the walk-through strip and in Settings, one stored value.
	 */
</script>

<Select
	label="Show the step's reminders"
	value={stepFocus.current.mode}
	options={[
		{ value: 'highlight', label: 'Highlight' },
		{ value: 'only', label: 'Only these' },
		{ value: 'front', label: 'Bring to front' }
	]}
	onChange={(mode) => stepFocus.update({ mode })}
/>
