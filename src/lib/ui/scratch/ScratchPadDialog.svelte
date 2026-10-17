<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ScratchActions from './ScratchActions.svelte';
	import ScratchPad from './ScratchPad.svelte';
	import type { ScratchPadState } from './scratch-store.svelte.ts';

	interface Props {
		open?: boolean;
		pad: ScratchPadState;
	}

	let { open = $bindable(false), pad }: Props = $props();
</script>

<!-- The pad full screen: as much paper as the screen has (Trevor, 2026-10-17). -->
<Dialog bind:open title={t('scratch.title')} size="max">
	{#snippet headActions()}
		<ScratchActions {pad} shortcuts={open} />
	{/snippet}
	<ScratchPad {pad} />
</Dialog>
