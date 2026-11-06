<script lang="ts">
	import { onMount } from 'svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ScriptName from './ScriptName.svelte';
	import { ScriptSearch } from './script-search.svelte.ts';
	import type { PageSource } from './search-sources.ts';
	import type { ScriptListing } from './script-providers.ts';

	/**
	 * One of Search's sources as a list of scripts to tap, for the script sheet (Trevor,
	 * 2026-11-06, option B: online scripts found without leaving New game). The same search as
	 * the Search page (`ScriptSearch`), one source at a time.
	 */
	interface Props {
		source: PageSource;
		term: string;
		/** A script was tapped. */
		onpick: (listing: ScriptListing) => void;
		disabled?: boolean;
	}

	let { source, term, onpick, disabled = false }: Props = $props();

	const search = new ScriptSearch(() => ({ sources: [source], term }));
	$effect(() => {
		search.shownCount = search.shown.length;
	});

	onMount(() => {
		loadOfficialData().then(
			(d) => (search.data = d),
			(e) => reportError(e, { area: 'scripts', notify: false })
		);
	});

	/** BotC Scripts' next page loads as the end of the list comes into view (no More button). */
	function more(node: HTMLElement) {
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((e) => e.isIntersecting)) search.loadMore();
		});
		observer.observe(node);
		return () => observer.disconnect();
	}
</script>

<ul class="rows" data-testid="online-scripts">
	{#each search.shown as listing (listing.row.key)}
		<li>
			<button type="button" class="row" {disabled} onclick={() => onpick(listing)}>
				<ScriptName name={listing.row.name} logo={listing.row.logo}>
					{#snippet sub()}{listing.row.author
							? t('player.byAuthor', { author: listing.row.author })
							: ''}{/snippet}
				</ScriptName>
			</button>
		</li>
	{/each}
</ul>
{#if search.botcMore > 0}<div class="end" {@attach more}></div>{/if}
<p class="status" role="status" data-testid="online-status">{search.status}</p>

<style>
	.rows {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row {
		display: flex;
		align-items: center;
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 0;
		border-radius: var(--card-radius);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	.row:hover {
		background: var(--choice-background);
	}
	.row:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: -3px;
	}
	.end {
		block-size: 1px;
	}
	.status {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
