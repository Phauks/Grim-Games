<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import FileView from '#lib/ui/primitives/FileView.svelte';

	/**
	 * A builder's file, shown before it is downloaded (Trevor, 2026-10-18: view the script's
	 * JSON first), as the shared file view: its name with Copy and Download in the file's own
	 * header, and line numbers ("standard component for all showcases"). Read only.
	 */
	interface Props {
		open?: boolean;
		title: string;
		json: unknown;
		fileName: string;
		downloadLabel: string;
	}

	let { open = $bindable(false), title, json, fileName, downloadLabel }: Props = $props();
	const text = $derived(JSON.stringify(json, null, '\t'));
</script>

<Dialog bind:open {title} size="full">
	<div class="json">
		<FileView
			title={fileName}
			{text}
			{fileName}
			copyLabel={t('common.copyJson')}
			{downloadLabel}
			testid="builder-json"
		/>
	</div>
</Dialog>

<style>
	/* A full dialog doesn't scroll itself: its content does. */
	.json {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
</style>
