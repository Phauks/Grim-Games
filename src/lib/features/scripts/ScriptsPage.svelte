<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { restoreScripts } from './current-script.svelte.ts';
	import ScriptPicker from './ScriptPicker.svelte';
	import { fetchSharedRef } from './share-codes.ts';
	import { sharedRefFromHash } from './share.ts';

	let picker: ScriptPicker | undefined = $state();
	let adding = $state(false);
	let addAnchor: HTMLElement | undefined = $state();

	function add(which: 'paste' | 'file' | 'link') {
		adding = false;
		picker?.add(which);
	}

	/** A share link (`/scripts#c=…` and the like) loads through the usual checks, then is cleared. */
	async function openSharedLink() {
		const ref = sharedRefFromHash(location.hash);
		if (!ref) return;
		history.replaceState(history.state, '', location.pathname);
		try {
			await picker?.loadFetched(await fetchSharedRef(ref));
		} catch (e) {
			toast(t('scripts.openSharedFailed'), errorMessage(e));
		}
	}

	onMount(() => {
		void restoreScripts().then(openSharedLink);
	});

	/** Counts enter/leave pairs, since dragging over child elements fires both repeatedly. */
	let dragDepth = $state(0);
	const dragging = $derived(dragDepth > 0);

	function carriesScript(event: DragEvent): boolean {
		const types = event.dataTransfer?.types ?? [];
		return (
			types.includes('Files') || types.includes('text/plain') || types.includes('text/uri-list')
		);
	}

	function onDragEnter(event: DragEvent) {
		if (!carriesScript(event)) return;
		event.preventDefault();
		dragDepth++;
	}

	function onDragOver(event: DragEvent) {
		if (!carriesScript(event)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
	}

	function onDragLeave() {
		dragDepth = Math.max(0, dragDepth - 1);
	}

	/** Dropping a script file (or a link, or JSON text) loads it like File or Paste. */
	function onDrop(event: DragEvent) {
		dragDepth = 0;
		const data = event.dataTransfer;
		if (!data || !picker) return;
		event.preventDefault();
		const file = data.files[0];
		if (file) {
			void picker.loadFile(file);
			return;
		}
		const text = data.getData('text/uri-list').split('\n')[0] || data.getData('text/plain');
		if (text.trim()) void picker.loadText(text);
	}
</script>

<!-- Anywhere on the page, so a missed drop never opens the file in place of the app. -->
<svelte:window
	ondragenter={onDragEnter}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
	onhashchange={() => void openSharedLink()}
/>

<main>
	<header>
		<h1>{t('scripts.heading')}</h1>
		<span bind:this={addAnchor}>
			<Button icon="add" aria-haspopup="dialog" onclick={() => (adding = !adding)}
				>{t('scripts.picker.add')}</Button
			>
		</span>
	</header>

	<Popover bind:open={adding} title={t('scripts.picker.add')} anchor={addAnchor}>
		<div class="add">
			<Button onclick={() => add('paste')}>{t('scripts.picker.paste')}</Button>
			<Button onclick={() => add('file')}>{t('scripts.picker.file')}</Button>
			<Button onclick={() => add('link')}>{t('scripts.picker.link')}</Button>
		</div>
	</Popover>

	<ErrorBoundary area="scripts">
		<ScriptPicker bind:this={picker} />
	</ErrorBoundary>

	<!-- An overlay, so the page never moves while something is dragged over it. -->
	<div class="drop" class:active={dragging} aria-hidden={!dragging} data-testid="drop-overlay">
		<p>{t('scripts.dropHint')}</p>
	</div>
</main>

<style>
	.drop {
		position: fixed;
		inset: 0;
		z-index: var(--z-raised);
		display: grid;
		place-items: center;
		padding: var(--space-5);
		border: 3px dashed var(--accent);
		background: var(--backdrop);
		pointer-events: none;
		opacity: 0;
		transition: opacity var(--duration-fast) var(--ease-out);
	}
	.drop.active {
		opacity: 1;
	}
	.drop p {
		margin: 0;
		padding: var(--space-4);
		border-radius: var(--card-radius);
		background: var(--card-background);
		color: var(--heading);
		font-size: 1.3rem;
	}
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
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.add {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	h1 {
		margin: 0;
		font-size: 2rem;
	}
</style>
