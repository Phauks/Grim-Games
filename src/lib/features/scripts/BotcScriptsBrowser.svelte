<script lang="ts">
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import {
		normaliseSearch,
		parseBotcScriptsRef,
		type BotcScriptsRef,
		type BotcScriptsSummary
	} from './botcscripts-api.ts';
	import { ScriptFetchError, searchBotcScripts } from './fetch-script.ts';

	/**
	 * Search and browse BotC Scripts through our Worker. Polite to the site: one request per
	 * pause in typing or per tap on More, never prefetched, and the Worker caches answers.
	 * An empty search lists the most voted scripts, like Pocket Grimoire's "-score" order.
	 */
	interface Props {
		/** What's typed: a search, or a botcscripts.com link or script number. */
		query?: string;
		/** Called when a result is tapped. */
		onpick: (ref: BotcScriptsRef) => void;
		disabled?: boolean;
	}

	let { query = $bindable(''), onpick, disabled = false }: Props = $props();

	const DEBOUNCE_MS = 400;

	let results = $state<BotcScriptsSummary[]>([]);
	let count = $state(0);
	let page = $state(0);
	let hasMore = $state(false);
	let loading = $state(false);
	let failure = $state('');
	let searched = $state<string | undefined>(undefined);
	let controller: AbortController | undefined;

	const ref = $derived(parseBotcScriptsRef(query));
	const term = $derived(normaliseSearch(query));

	async function load(text: string, next: number) {
		controller?.abort();
		const mine = new AbortController();
		controller = mine;
		loading = true;
		failure = '';
		try {
			const found = await searchBotcScripts(text, next, mine.signal);
			if (controller !== mine) return;
			results = next === 1 ? found.results : [...results, ...found.results];
			count = found.count;
			page = found.page;
			hasMore = found.hasMore;
			searched = text;
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			if (!(e instanceof ScriptFetchError)) reportError(e, { area: 'scripts', notify: false });
			failure = errorMessage(e);
			if (next === 1) results = [];
		} finally {
			if (controller === mine) loading = false;
		}
	}

	// A search runs after a pause in typing; links and numbers don't search.
	$effect(() => {
		const text = term;
		if (ref || text === searched) return;
		const timer = setTimeout(() => void load(text, 1), searched === undefined ? 0 : DEBOUNCE_MS);
		return () => clearTimeout(timer);
	});

	$effect(() => () => controller?.abort());

	const status = $derived(
		ref
			? 'A BotC Scripts link or number: tap Load.'
			: failure ||
					(loading && results.length === 0
						? 'Searching…'
						: searched === undefined
							? ''
							: results.length === 0
								? 'None'
								: `${count} ${count === 1 ? 'script' : 'scripts'}${searched ? '' : ', most voted first'}`)
	);
</script>

<div class="browser">
	<label class="field">
		<span>Search, link or script number</span>
		<input type="search" autocomplete="off" enterkeyhint="search" bind:value={query} {disabled} />
	</label>

	<p class="status" role="status" data-testid="botc-status">{status}</p>

	<!-- Fixed height: results scroll inside it, so loading or paging never moves anything. -->
	<ul class="results" aria-label="BotC Scripts results" aria-busy={loading}>
		{#if !ref}
			{#each results as row (row.versionId)}
				<li>
					<button
						type="button"
						class="row"
						{disabled}
						onclick={() => onpick({ kind: 'version', versionId: row.versionId })}
					>
						<span class="name">{row.name || 'None'}</span>
						<span class="details"
							>{row.author || 'None'} · {row.type || 'None'} · {row.version}</span
						>
						<span class="score" aria-label="{row.score} votes">{row.score}</span>
					</button>
				</li>
			{/each}
		{/if}
	</ul>

	<div class="more">
		<Button
			variant="quiet"
			disabled={disabled || loading || !hasMore || !!ref}
			onclick={() => load(searched ?? term, page + 1)}>More</Button
		>
	</div>
</div>

<style>
	.browser {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 0;
		flex: 1;
	}
	.field {
		display: grid;
		gap: var(--space-1);
		margin-top: var(--space-3);
	}
	.field input {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: max(1rem, 16px);
	}
	.status {
		margin: 0;
		min-height: 1lh;
		color: var(--on-surface-muted);
		overflow-wrap: anywhere;
	}
	.results {
		flex: 1;
		min-height: calc(6 * var(--tap-target));
		max-height: 50dvh;
		overflow-y: auto;
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		align-content: start;
		gap: var(--space-1);
		overscroll-behavior: contain;
	}
	.row {
		width: 100%;
		min-height: var(--tap-target);
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0 var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		text-align: left;
	}
	.row:hover:not(:disabled) {
		background: var(--surface-selected);
	}
	.name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.details {
		grid-column: 1;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
		overflow-wrap: anywhere;
	}
	.score {
		grid-column: 2;
		grid-row: 1 / span 2;
		align-self: center;
		color: var(--on-surface-muted);
	}
	.more {
		display: flex;
		justify-content: center;
	}
</style>
