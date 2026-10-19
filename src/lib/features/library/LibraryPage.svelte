<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import AddScript from '#lib/features/scripts/AddScript.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import LibraryBrowser from './LibraryBrowser.svelte';
	import PreviewToggle from './PreviewToggle.svelte';

	/** The Library: the file manager (`LibraryBrowser`) under its title row. */
	let browser = $state<LibraryBrowser>();
</script>

<Page title={t('library.heading')}>
	{#snippet actions()}
		<!-- Icon buttons, so the title row stays one row on a phone (Trevor: icon buttons). -->
		<IconButton
			icon="players"
			label={t('library.newCollection')}
			onclick={() => browser?.newCollection()}
		/>
		<PreviewToggle {browser} />
		<!-- Adding scripts lives here, not on Search (Trevor, 2026-10-17). -->
		<AddScript onsaved={() => browser?.openAdded()} />
	{/snippet}

	<LibraryBrowser bind:this={browser} />
</Page>
