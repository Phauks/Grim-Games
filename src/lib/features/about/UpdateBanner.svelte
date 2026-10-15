<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/ui/primitives/Button.svelte';

	// How often an open app checks for a new build (a game can run for hours).
	const CHECK_EVERY_MS = 30 * 60 * 1000;

	let waiting = $state<ServiceWorker | null>(null);
	let dismissed = $state(false);
	// Set only when the user taps Refresh, so the first install's clients.claim() never reloads.
	let refreshRequested = false;

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
		<p class="text">
			<strong>Update ready</strong>
			<span>Your game is saved and reopens after refreshing.</span>
		</p>
		<div class="actions">
			<Button variant="quiet" onclick={() => (dismissed = true)}>Later</Button>
			<Button variant="accent" onclick={refresh}>Refresh</Button>
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
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: min(24rem, calc(100vw - 2 * var(--space-3)));
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 0.4);
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
</style>
