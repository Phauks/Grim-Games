<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import AddScript from './AddScript.svelte';
	import { restoreScripts } from './current-script.svelte.ts';
	import ScriptPicker from './ScriptPicker.svelte';
	import { fetchSharedRef } from './share-codes.ts';
	import { sharedRefFromHash } from './share.ts';

	/**
	 * Search (Trevor, 2026-10-17: "Rename scripts to search"): finding published scripts.
	 * Add script is in the Library, where the user's own scripts live.
	 */
	let picker: ScriptPicker | undefined = $state();
	let adder: AddScript | undefined = $state();

	/** A share link (`/scripts#c=…` and the like) loads through the usual checks, then is cleared. */
	async function openSharedLink() {
		const ref = sharedRefFromHash(location.hash);
		if (!ref) return;
		history.replaceState(history.state, '', location.pathname);
		try {
			await adder?.loadFetched(await fetchSharedRef(ref));
		} catch (e) {
			toast(t('scripts.openSharedFailed'), errorMessage(e));
		}
	}

	onMount(() => {
		void restoreScripts().then(openSharedLink);
	});
</script>

<svelte:window onhashchange={() => void openSharedLink()} />

<main>
	<header>
		<h1>{t('scripts.heading')}</h1>
		<!-- Share links only: adding scripts is the Library's (Trevor, 2026-10-17). -->
		<AddScript bind:this={adder} button={false} onsaved={() => picker?.showSaved()} />
	</header>

	<ErrorBoundary area="scripts">
		<ScriptPicker bind:this={picker} />
	</ErrorBoundary>
</main>

<style>
	main {
		max-width: var(--page-max);
		margin: 0 auto;
		padding: var(--space-5) var(--page-gutter);
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-5);
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	h1 {
		margin: 0;
		font-size: 2rem;
	}
</style>
