<script lang="ts" module>
	export const STEP_FOCUS_LABEL = "Show this character's reminders";
</script>

<script lang="ts">
	import Select from '#lib/ui/primitives/Select.svelte';
	import { stepFocus } from './step-focus.svelte.ts';

	/**
	 * How a walked-through night step's reminders are shown in the reminder bank (Trevor,
	 * 2026-10-17), on the walk-through strip and in Settings, one stored value.
	 */
	interface Props {
		/** A visible label elsewhere (Settings' row, name left of the control). */
		labelledBy?: string;
	}

	let { labelledBy }: Props = $props();
</script>

<Select
	label={STEP_FOCUS_LABEL}
	{labelledBy}
	value={stepFocus.current.mode}
	options={[
		{ value: 'highlight', label: 'Highlight' },
		{ value: 'only', label: 'Only this character' },
		{ value: 'front', label: 'Bring to front' }
	]}
	onChange={(mode) => stepFocus.update({ mode })}
/>
