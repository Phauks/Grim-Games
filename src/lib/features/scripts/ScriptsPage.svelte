<script lang="ts">
	import { onMount } from 'svelte';
	import { CHARACTER_TYPES, scriptToJson } from '#lib/core/data/index.ts';
	import { TYPE_LABELS, TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { scriptPageUrl } from './botcscripts-api.ts';
	import { currentScript, restoreScripts } from './current-script.svelte.ts';
	import { describeSource } from './saved-scripts.ts';
	import ScriptPicker from './ScriptPicker.svelte';
	import ShareControl from './ShareControl.svelte';
	import { decodeSharedScript, shareLink, sharedPayloadFromHash } from './share.ts';

	let picker: ScriptPicker | undefined = $state();

	const script = $derived(currentScript.current);
	const saved = $derived(currentScript.saved);
	const counts = $derived(
		script
			? CHARACTER_TYPES.flatMap((type) => {
					const n = script.characters.filter((c) => c.type === type).length;
					return n === 0 ? [] : [`${n} ${n === 1 ? TYPE_LABELS[type] : TYPE_PLURALS[type]}`];
				}).join(' · ')
			: 'None'
	);

	/** A share link (`/scripts#s=…`) loads its script through the usual checks, then is cleared. */
	async function openSharedLink() {
		const payload = sharedPayloadFromHash(location.hash);
		if (!payload) return;
		history.replaceState(history.state, '', location.pathname);
		try {
			const json = await decodeSharedScript(payload);
			await picker?.loadFetched({ text: JSON.stringify(json), source: { kind: 'share' } });
		} catch (e) {
			toast('Could not open the shared script', errorMessage(e));
		}
	}

	onMount(() => {
		void restoreScripts().then(openSharedLink);
	});

	/** The player link for the current script (`/play#s=…`), rebuilt when the script changes. */
	let shareUrl = $state<string>();
	$effect(() => {
		const current = script;
		shareUrl = undefined;
		if (!current) return;
		let stale = false;
		shareLink(location.origin, scriptToJson(current)).then(
			(url) => {
				if (!stale) shareUrl = url;
			},
			(e) => reportError(e, { area: 'scripts', notify: false })
		);
		return () => {
			stale = true;
		};
	});
</script>

<main>
	<h1>Scripts</h1>

	<!-- Same size with or without a script, so choosing one never moves the picker. -->
	<ErrorBoundary area="scripts">
		<section class="current" aria-labelledby="current-heading" data-testid="current-script">
			<h2 id="current-heading">Current script</h2>
			<p class="name" data-testid="current-script-name">{script?.name ?? 'None'}</p>
			<dl>
				<dt>Author</dt>
				<dd>{script?.meta.author || 'None'}</dd>
				<dt>Characters</dt>
				<dd class="counts" data-testid="current-script-counts">{counts}</dd>
				<dt>Source</dt>
				<dd>
					{#if saved?.source.kind === 'botcscripts'}
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={scriptPageUrl(saved.source.scriptId, saved.source.version)}
							target="_blank"
							rel="noopener noreferrer">{describeSource(saved.source)}</a
						>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{:else}
						{saved ? describeSource(saved.source) : 'None'}
					{/if}
				</dd>
			</dl>
			<ShareControl what="script" title={script?.name ?? 'Script'} url={shareUrl} />
		</section>
	</ErrorBoundary>

	<ErrorBoundary area="scripts">
		<ScriptPicker bind:this={picker} />
	</ErrorBoundary>
</main>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
		display: grid;
		gap: var(--space-5);
	}
	h1 {
		margin: 0;
		font-size: 2rem;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.current {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
	}
	.name {
		margin: 0;
		font-size: 1.3rem;
		color: var(--heading);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* Counts may need two lines on a phone; both are always reserved, so nothing moves. */
	.counts {
		min-height: 2lh;
		white-space: normal;
	}
	dd a {
		min-height: auto;
		color: inherit;
	}
</style>
