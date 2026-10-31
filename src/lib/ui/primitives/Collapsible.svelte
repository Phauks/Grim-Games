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
	import { untrack, type Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import CountBadge from './CountBadge.svelte';
	import type { TypeTone } from '#lib/core/data/character-type.ts';

	interface Props {
		title: string;
		/** Remembers open or closed on this device under this key; leave out to not remember. */
		storageKey?: string;
		/** Heading level of the title. */
		level?: 2 | 3 | 4;
		/** A character type's colour family (`typeTone`). */
		tone?: TypeTone;
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
		/**
		 * The aside sits right after the title instead of at the row's far end, e.g. an (i)
		 * that explains the heading (Trevor, 2026-10-18).
		 */
		asideByTitle?: boolean;
		/**
		 * How many items it holds, shown beside the title while closed, so a closed section
		 * still says what is inside (Trevor, 2026-10-19).
		 */
		count?: number;
		/** Shows the count while open too, e.g. a list whose length changes as it is filtered. */
		countOpen?: boolean;
		/** Starts closed until opened (e.g. About's Advanced part); remembered like any other. */
		defaultOpen?: boolean;
		/** Kept in place but can't open yet, e.g. while what it holds is still loading. */
		disabled?: boolean;
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
		asideByTitle = false,
		count,
		countOpen = false,
		defaultOpen = true,
		disabled = false,
		children
	}: Props = $props();

	// Open by default; a section closed before stays closed. Read again if the key changes.
	let open = $derived(
		!startClosed && (storageKey ? readOpen(storageKey, defaultOpen) : defaultOpen)
	);
	let openWhileEmpty = $state(false);
	// Something appeared: open it, even if it was closed before.
	let wasEmpty = untrack(() => empty);
	$effect.pre(() => {
		if (wasEmpty && !empty) {
			open = true;
			if (storageKey) writeOpen(storageKey, true, defaultOpen);
		}
		if (empty && !wasEmpty) openWhileEmpty = false;
		wasEmpty = empty;
	});
	const shown = $derived(!disabled && (forceOpen || (empty ? openWhileEmpty : open)));
	const id = $props.id();

	function toggle() {
		if (forceOpen || disabled) return;
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
	sections keep their header, so only the content below moves. Every caret in the app is this
	one (`grim/caret-section`), so they share one indent, spacing and count badge, and a line
	above it whenever something sits above it (wrapped ones: SectionStack) (Trevor, 2026-10-27).
-->
<section class="collapsible" data-open={shown ? '' : undefined}>
	<div class="head" data-type-band={tone} data-aside-by-title={asideByTitle ? '' : undefined}>
		<svelte:element this={`h${level}`} class="title">
			<button
				type="button"
				class="toggle"
				aria-expanded={shown}
				aria-disabled={forceOpen ? 'true' : undefined}
				{disabled}
				aria-controls="{id}-body"
				onclick={toggle}
			>
				<span class="caret" aria-hidden="true" data-caret><Icon name="expand" /></span>
				<span class="label">{title}</span>
				{#if count !== undefined && (countOpen || !shown)}<span
						class="count"
						aria-hidden="true"
						data-testid="section-count"><CountBadge {count} /></span
					>{/if}
			</button>
		</svelte:element>
		{#if aside}<div class="aside">{@render aside()}</div>{/if}
	</div>
	<div id="{id}-body" class="body" hidden={!shown}>
		{@render children()}
	</div>
</section>

<style>
	/* A line between it and anything above it in the same box (Trevor, 2026-10-27); a stack of
	   wrapped sections gets the same line from SectionStack. */
	.collapsible:not(:first-child) {
		border-top: 1px solid var(--border);
	}
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
	.head[data-aside-by-title] .title {
		flex: 0 1 auto;
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
	/* A character type's heading is a band in its tokens' colour, like the name band on its
	   characters' rows (Trevor, 2026-10-31, picked "B · Band"; colours in base.css). The band
	   is drawn behind the row, so a header pinned over a list keeps its own background round
	   the band's ends. It reaches out into the gutter rather than pushing its caret in, so
	   every caret keeps one indent (e2e/caret-dividers.e2e.ts). */
	.head[data-type-band] {
		position: relative;
		isolation: isolate;
		margin-block: var(--space-1);
		margin-inline: calc(-1 * var(--space-2));
		padding-inline: var(--space-2);
	}
	.head[data-type-band]::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: var(--radius-full);
		background: var(--type-band);
		box-shadow: var(--button-ring);
	}
	.head[data-type-band] .toggle {
		color: var(--on-type-band);
	}
	.toggle[aria-disabled='true'] {
		cursor: default;
	}
	.toggle:disabled {
		cursor: default;
		opacity: 0.5;
	}
	/* Room under open content before the next section's line. */
	.body {
		padding-bottom: var(--space-3);
	}
	/* Mouse only: a tap leaves :hover stuck on touch screens, underlining the last title. */
	@media (hover: hover) {
		.toggle:not([aria-disabled='true'], :disabled):hover .label {
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
		display: flex;
		flex: none;
		align-items: center;
	}
	.count {
		flex: none;
		font-size: 0.75em;
	}
	@media (prefers-reduced-motion: reduce) {
		.caret {
			transition: none;
		}
	}
</style>
