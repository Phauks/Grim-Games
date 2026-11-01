<script lang="ts">
	import type { GuideField } from '#lib/core/modes/index.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import BuilderField from './BuilderField.svelte';
	import BuilderTable from './BuilderTable.svelte';

	/**
	 * A part's Source or Storyteller instructions, opened from its header (Trevor, 2026-11-01:
	 * they are on every part but not always included, so each is added per part). Saved as it
	 * is typed, like the rest of the builder; the X closes it.
	 */
	interface Props {
		open: boolean;
		title: string;
		field: GuideField;
		/** The part (or list item) it belongs to. */
		parent: string;
		path: string;
		value: unknown;
		onChange: (value: unknown) => void;
		onGuide: () => void;
	}

	let {
		open = $bindable(),
		title,
		field,
		parent,
		path,
		value,
		onChange,
		onGuide
	}: Props = $props();
</script>

<Dialog bind:open {title}>
	<div class="note code-font" data-testid="mode-builder-note">
		<BuilderTable>
			<BuilderField {field} {parent} {path} {value} {onChange} {onGuide} />
		</BuilderTable>
	</div>
</Dialog>

<style>
	/* Its rows lay out as on the page (a dialog is drawn outside it). */
	.note {
		container: builder / inline-size;
	}
</style>
