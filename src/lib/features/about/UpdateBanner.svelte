<script lang="ts">
	import { onMount } from 'svelte';
	import { buildInfo } from '#lib/build-info.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { REPOSITORY_URL } from './report-issue.ts';
	import { BUILD_NOTES_PATH, changesSince, parseBuildNotes, type Changes } from './update-notes.ts';

	// How often an open app checks for a new build (a game can run for hours).
	const CHECK_EVERY_MS = 30 * 60 * 1000;

	let waiting = $state<ServiceWorker | null>(null);
	let dismissed = $state(false);
	// Set only when the user taps Refresh, so the first install's clients.claim() never reloads.
	let refreshRequested = false;
	// What the waiting build changed; null until fetched, or when offline.
	let changes = $state<Changes | null>(null);
	let changesOpen = $state(false);
	const listId = $props.id();

	async function loadChanges() {
		try {
			// Past every cache: the network has the newest build's notes, the one waiting.
			const response = await fetch(BUILD_NOTES_PATH, { cache: 'no-store' });
			const notes = response.ok ? parseBuildNotes(await response.json()) : null;
			changes = notes && changesSince(notes, buildInfo.commit);
		} catch {
			changes = null;
		}
	}

	$effect(() => {
		if (waiting) void loadChanges();
	});

	onMount(() => {
		if (!('serviceWorker' in navigator)) return;
		let registration: ServiceWorkerRegistration | undefined;

		const watch = (reg: ServiceWorkerRegistration) => {
			registration = reg;
			// Only a waiting worker with a controller already in place is an update;
			// the very first install has nothing to replace.
			if (reg.waiting && navigator.serviceWorker.controller) waiting = reg.waiting;
			reg.addEventListener('updatefound', () => {
				const next = reg.installing;
				next?.addEventListener('statechange', () => {
					if (next.state === 'installed' && navigator.serviceWorker.controller) {
						waiting = next;
						dismissed = false;
					}
				});
			});
		};

		navigator.serviceWorker.ready.then(watch);
		const onControllerChange = () => {
			if (!refreshRequested) return;
			refreshRequested = false;
			location.reload();
		};
		navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

		const check = () => registration?.update().catch(() => {});
		const onVisible = () => document.visibilityState === 'visible' && check();
		document.addEventListener('visibilitychange', onVisible);
		const timer = setInterval(check, CHECK_EVERY_MS);

		return () => {
			navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
			document.removeEventListener('visibilitychange', onVisible);
			clearInterval(timer);
		};
	});

	function refresh() {
		refreshRequested = true;
		waiting?.postMessage({ type: 'SKIP_WAITING' });
	}
</script>

{#if waiting && !dismissed}
	<div class="update" role="status" data-testid="update-banner">
		<div class="main">
			<p class="text">
				<strong>Update ready</strong>
				<span>Your game is saved and reopens after refreshing.</span>
			</p>
			<div class="actions">
				<Button variant="quiet" onclick={() => (dismissed = true)}>Later</Button>
				<Button variant="accent" onclick={refresh}>Refresh</Button>
			</div>
		</div>
		<!-- The row is always there, disabled until the notes arrive, so the card never grows by itself. -->
		<button
			type="button"
			class="toggle"
			aria-expanded={changesOpen}
			aria-controls={listId}
			disabled={!changes}
			onclick={() => (changesOpen = !changesOpen)}
		>
			<span class="caret" class:open={changesOpen} aria-hidden="true"><Icon name="expand" /></span>
			What changed{changes ? ` (${changes.commits.length}${changes.complete ? '' : '+'})` : ''}
		</button>
		<div id={listId} class="changes" hidden={!changesOpen || !changes}>
			{#if changes && changes.commits.length > 0}
				<ul>
					{#each changes.commits as commit (commit.sha)}
						<li>
							<!-- External GitHub link, not an app route. -->
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href="{REPOSITORY_URL}/commit/{commit.sha}" target="_blank" rel="noopener">
								<span class="sha">{commit.sha.slice(0, 7)}</span>
								<span>{commit.subject}</span>
							</a>
						</li>
					{/each}
				</ul>
				{#if !changes.complete}<p class="more">Older changes not listed.</p>{/if}
			{:else}
				<p class="more">None</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* A small card in the corner, over the page (never pushes content: no reflow). */
	.update {
		position: fixed;
		right: max(var(--space-3), env(safe-area-inset-right));
		bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
		left: auto;
		z-index: 50;
		display: grid;
		gap: var(--space-1);
		width: min(calc(24 * var(--u)), calc(100vw - 2 * var(--space-3)));
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		box-shadow: 0 calc(0.5 * var(--u)) calc(1.5 * var(--u)) rgb(0 0 0 / 0.4);
	}
	.main {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.text {
		display: grid;
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.3;
	}
	.text span {
		color: var(--on-surface-muted);
	}
	.actions {
		display: flex;
		flex: none;
		gap: var(--space-2);
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-size: 0.85rem;
		text-align: start;
		cursor: pointer;
	}
	.toggle:disabled {
		color: var(--on-surface-muted);
		cursor: default;
	}
	.caret {
		display: grid;
		transform: rotate(-90deg);
		transition: transform 0.15s ease;
	}
	.caret.open {
		transform: none;
	}
	.changes {
		max-height: min(40dvh, calc(16 * var(--u)));
		overflow-y: auto;
		font-size: 0.8rem;
		line-height: 1.35;
	}
	.changes ul {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* The whole row is the link, so each commit is one comfortable tap. */
	.changes a {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		color: inherit;
		text-decoration: none;
	}
	.sha {
		text-decoration: underline;
		font-variant-numeric: tabular-nums;
	}
	.more {
		margin: var(--space-1) 0 0;
		color: var(--on-surface-muted);
	}
	@media (prefers-reduced-motion: reduce) {
		.caret {
			transition: none;
		}
	}
</style>
