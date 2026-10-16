<script lang="ts" module>
	const PREFIX = 'grim-games:collapsed:';

	function readClosed(key: string): boolean {
		try {
			return globalThis.localStorage?.getItem(PREFIX + key) === '1';
		} catch {
			return false;
		}
	}

	function writeClosed(key: string, closed: boolean): void {
		try {
			if (closed) globalThis.localStorage?.setItem(PREFIX + key, '1');
			else globalThis.localStorage?.removeItem(PREFIX + key);
		} catch {
			// Storage blocked: the section still opens and closes for this visit.
		}
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
		/** Extra content at the end of the header row (a count, a badge); not part of the tap. */
		aside?: Snippet;
		children: Snippet;
	}

	let { title, storageKey, level = 2, tone, forceOpen = false, aside, children }: Props = $props();

	// Open by default; a section closed before stays closed. Read again if the key changes.
	let open = $derived(!(storageKey && readClosed(storageKey)));
	const shown = $derived(open || forceOpen);
	const id = $props.id();

	function toggle() {
		if (forceOpen) return;
		open = !open;
		if (storageKey) writeClosed(storageKey, !open);
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
		font-size: 1.1rem;
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
	.toggle:not([aria-disabled='true']):hover .label {
		text-decoration: underline;
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
