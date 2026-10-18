<script lang="ts" module>
	import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';

	const PREFIX = 'grim-games:collapsed:';

	// '1' closed, '0' opened (only stored for a section that starts closed), else the default.
	function readOpen(key: string, defaultOpen: boolean): boolean {
		const stored = readStoredText(PREFIX + key);
		return stored === undefined ? defaultOpen : stored !== '1';
	}

	// Storage blocked: the section still opens and closes for this visit.
	function writeOpen(key: string, open: boolean, defaultOpen = true): void {
		writeStoredText(PREFIX + key, open === defaultOpen ? undefined : open ? '0' : '1');
	}

	/** Opens a remembered section before it is shown, e.g. a link straight to its content. */
	export function rememberOpen(key: string): void {
		writeStoredText(PREFIX + key, '0');
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Props {
		title: string;
		/** Remembers open or closed on this device under this key; leave out to not remember. */
		storageKey?: string;
		/** Heading level of the title. */
		level?: 2 | 3 | 4;
		/** Colours the title by alignment, for character type groups. */
		tone?: 'good' | 'evil';
		/**
		 * Shown open regardless of the remembered choice, e.g. while a search is typed so every
		 * match is visible. The header can't close it meanwhile; the remembered choice is kept.
		 */
		forceOpen?: boolean;
		/**
		 * Nothing to show but "None": closed, and opened again as soon as something appears
		 * (Trevor, 2026-10-18). The header still opens it meanwhile; nothing is remembered.
		 */
		empty?: boolean;
		/**
		 * Starts closed every time, whatever was remembered, and its opening isn't remembered:
		 * for a section rarely needed, like setup's Travellers (Trevor, 2026-10-18).
		 */
		startClosed?: boolean;
		/** Extra content at the end of the header row (a count, a badge); not part of the tap. */
		aside?: Snippet;
		/** Starts closed until opened (e.g. About's Advanced part); remembered like any other. */
		defaultOpen?: boolean;
		children: Snippet;
	}

	let {
		title,
		storageKey,
		level = 2,
		tone,
		forceOpen = false,
		empty = false,
		startClosed = false,
		aside,
		defaultOpen = true,
		children
	}: Props = $props();

	// Open by default; a section closed before stays closed. Read again if the key changes.
	let open = $derived(
		!startClosed && (storageKey ? readOpen(storageKey, defaultOpen) : defaultOpen)
	);
	let openWhileEmpty = $state(false);
	// Something appeared: open it, even if it was closed before.
	let wasEmpty = empty;
	$effect.pre(() => {
		if (wasEmpty && !empty) {
			open = true;
			if (storageKey) writeOpen(storageKey, true, defaultOpen);
		}
		if (empty && !wasEmpty) openWhileEmpty = false;
		wasEmpty = empty;
	});
	const shown = $derived(forceOpen || (empty ? openWhileEmpty : open));
	const id = $props.id();

	function toggle() {
		if (forceOpen) return;
		if (empty) {
			openWhileEmpty = !openWhileEmpty;
			return;
		}
		open = !open;
		if (storageKey && !startClosed) writeOpen(storageKey, open, defaultOpen);
	}
</script>

<!--
	A section whose whole header row opens and closes it, with a caret like a menu. Closed
	sections keep their header, so only the content below moves.
-->
<section class="collapsible" data-open={shown ? '' : undefined}>
	<div class="head" data-tone={tone}>
		<svelte:element this={`h${level}`} class="title">
			<button
				type="button"
				class="toggle"
				aria-expanded={shown}
				aria-disabled={forceOpen ? 'true' : undefined}
				aria-controls="{id}-body"
				onclick={toggle}
			>
				<span class="caret" aria-hidden="true"><Icon name="expand" /></span>
				<span class="label">{title}</span>
			</button>
		</svelte:element>
		{#if aside}<div class="aside">{@render aside()}</div>{/if}
	</div>
	<div id="{id}-body" class="body" hidden={!shown}>
		{@render children()}
	</div>
</section>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.title {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: inherit;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: var(--collapsible-heading, var(--heading));
		font: inherit;
		font-size: var(--section-title-size);
		font-weight: 600;
		text-align: start;
		cursor: pointer;
		touch-action: manipulation;
	}
	.head[data-tone='good'] .toggle {
		color: var(--good);
	}
	.head[data-tone='evil'] .toggle {
		color: var(--evil);
	}
	.toggle[aria-disabled='true'] {
		cursor: default;
	}
	/* Mouse only: a tap leaves :hover stuck on touch screens, underlining the last title. */
	@media (hover: hover) {
		.toggle:not([aria-disabled='true']):hover .label {
			text-decoration: underline;
		}
	}
	.caret {
		display: grid;
		place-items: center;
		flex: none;
		transition: transform 0.15s ease;
	}
	.collapsible:not([data-open]) .caret {
		transform: rotate(-90deg);
	}
	.label {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.aside {
		flex: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.caret {
			transition: none;
		}
	}
</style>
