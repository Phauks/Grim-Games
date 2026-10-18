<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type LibraryBrowser from './LibraryBrowser.svelte';

	/** The Library's Preview button, on its page and in a picker's dialog alike. */
	let { browser }: { browser: LibraryBrowser | undefined } = $props();
</script>

<IconButton
	icon="preview"
	label={t('library.preview')}
	aria-pressed={browser?.isPreviewing() ?? false}
	disabled={!browser?.canPreview()}
	onclick={() => browser?.togglePreview()}
/>
