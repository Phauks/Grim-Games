<script lang="ts" module>
	import { getContext, setContext } from 'svelte';

	const WINDOW = Symbol('library-window');
	/** How the Library opens the previewed item in a window over the page. */
	export function setLibraryWindow(open: () => void) {
		setContext(WINDOW, open);
	}

	const PICK = Symbol('library-pick');
	type LibraryPick = { active: () => boolean; label: () => string; pick: () => void };
	/** How a Library picker takes the previewed item (its button replaces "Open in a window"). */
	export function setLibraryPick(pick: LibraryPick) {
		setContext(PICK, pick);
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * The open item, to the right of the list (Trevor, 2026-10-18: "open it to the right side,
	 * not as a modal, so that you can easily go between different items"). Where three columns
	 * don't fit, it fills the screen instead and its ✕ goes back to the list.
	 */
	interface Props {
		open?: boolean;
		title: string;
		/** Beside the list; otherwise over the whole screen. */
		inline: boolean;
		/** Replaces the title's text, e.g. with a character badge (names show as badges). */
		heading?: Snippet;
		/** The item's own buttons, before ✕ (the red trash last, next to it). */
		headActions?: Snippet;
		children: Snippet;
	}

	let { open = $bindable(false), title, inline, heading, headActions, children }: Props = $props();
	const openWindow = getContext<(() => void) | undefined>(WINDOW);
	const pick = getContext<LibraryPick | undefined>(PICK);
</script>

{#if inline}
	<!-- Always there, so the list never moves when an item opens. -->
	<section
		class="pane"
		class:open
		aria-label={open ? title : t('library.pane')}
		data-testid="library-pane"
	>
		{#if open}
			<header class="head">
				<h2>
					{#if heading}{@render heading()}{:else}{title}{/if}
				</h2>
				<div class="head-actions">
					{@render headActions?.()}
					{#if pick?.active()}
						<IconButton icon="open" label={pick.label()} onclick={pick.pick} />
					{:else if openWindow}
						<IconButton icon="openItem" label={t('library.openWindow')} onclick={openWindow} />
					{/if}
					<IconButton icon="close" label={t('common.close')} onclick={() => (open = false)} />
				</div>
			</header>
			<div class="body">{@render children()}</div>
		{:else}
			<p class="none">{t('library.paneEmpty')}</p>
		{/if}
	</section>
{:else}
	<Dialog bind:open {title} size="full" {heading} {headActions}>
		<!-- A full dialog doesn't scroll itself: its content does (Trevor, 2026-10-18). -->
		<div class="body screen" data-testid="library-pane">{@render children()}</div>
	</Dialog>
{/if}

<style>
	.pane {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-width: 0;
		min-height: 0;
	}
	/* Part of the Library's one window: the open item's header carries the accent, as its row does. */
	.pane.open .head {
		box-shadow: inset 0 0.25rem 0 var(--accent);
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
		border-bottom: var(--card-border);
	}
	h2 {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: var(--section-title-size);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.head-actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.pane .body {
		--pinned-inset: var(--space-3);
		min-height: 0;
		overflow-y: auto;
		padding: var(--space-3);
	}
	.screen {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		margin-top: var(--space-3);
	}
	.none {
		grid-row: 1 / -1;
		align-self: center;
		margin: 0;
		padding: var(--space-4);
		text-align: center;
		color: var(--on-surface-muted);
	}
</style>
