<script lang="ts" module>
	const KEY = 'grim-games:collapsed-sections:v1';

	/** Section keys the user closed, remembered on this device (Trevor, 2026-10-16). */
	function readClosed(): string[] {
		try {
			const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
			return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : [];
		} catch {
			return [];
		}
	}

	let closed = $state<string[]>(typeof localStorage === 'undefined' ? [] : readClosed());

	function setOpen(key: string, open: boolean) {
		const next = closed.filter((k) => k !== key);
		if (!open) next.push(key);
		closed = next;
		try {
			localStorage.setItem(KEY, JSON.stringify(next));
		} catch {
			// Private browsing or full storage: remembered until the page closes.
		}
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Props {
		title: string;
		/** Remembers whether this section is open on this device, e.g. `play:jinxes`. */
		storageKey: string;
		/** Heading level of the title. */
		level?: 2 | 3;
		/** Colours the title: good (blue) or evil (red) character types. */
		tone?: 'good' | 'evil';
		/** Extra content at the end of the header row, outside the toggle. */
		end?: Snippet;
		children: Snippet;
	}

	let { title, storageKey, level = 2, tone, end, children }: Props = $props();

	const open = $derived(!closed.includes(storageKey));
	const id = $props.id();
</script>

<!--
	A section whose whole header row opens and closes it, with a caret (▸ closed, ▾ open).
	Open by default.
-->
<section class="collapsible" aria-labelledby="{id}-title" data-open={open || undefined}>
	<div class="head" data-tone={tone}>
		<svelte:element this={`h${level}`} id="{id}-title" class="title">
			<button
				type="button"
				aria-expanded={open}
				aria-controls="{id}-body"
				onclick={() => setOpen(storageKey, !open)}
			>
				<span class="caret" aria-hidden="true"><Icon name="forward" /></span>
				<span class="label">{title}</span>
			</button>
		</svelte:element>
		{#if end}{@render end()}{/if}
	</div>
	<div class="body" id="{id}-body" hidden={!open}>
		{@render children()}
	</div>
</section>

<style>
	.collapsible {
		display: grid;
		gap: var(--space-2);
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.title {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 1.1rem;
		color: var(--heading);
	}
	.head[data-tone='good'] .title {
		color: var(--good);
	}
	.head[data-tone='evil'] .title {
		color: var(--evil);
	}
	button {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
		touch-action: manipulation;
	}
	button:hover .label {
		text-decoration: underline;
	}
	.caret {
		display: inline-grid;
		transition: rotate 0.15s ease;
	}
	.collapsible[data-open] .caret {
		rotate: 90deg;
	}
	@media (prefers-reduced-motion: reduce) {
		.caret {
			transition: none;
		}
	}
	.body {
		display: grid;
		gap: var(--space-2);
	}
	.body[hidden] {
		display: none;
	}
</style>
