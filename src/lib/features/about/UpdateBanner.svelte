<script lang="ts">
	import { onMount } from 'svelte';

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
		<p>
			A new version of Grim-Games is ready. Your game is saved on this device and reopens after
			refreshing.
		</p>
		<div class="actions">
			<button type="button" onclick={() => (dismissed = true)}>Later</button>
			<button type="button" class="primary" onclick={refresh}>Refresh</button>
		</div>
	</div>
{/if}

<style>
	.update {
		position: fixed;
		inset: auto 0.75rem calc(0.75rem + env(safe-area-inset-bottom)) 0.75rem;
		z-index: 50;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		background: var(--on-surface);
		color: var(--surface);
		box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 0.4);
	}
	p {
		margin: 0;
		flex: 1 1 14rem;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
	}
	button {
		padding: 0 1rem;
		border-radius: 0.5rem;
		border: 1px solid currentColor;
		background: transparent;
		color: inherit;
		font: inherit;
	}
	.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-surface);
	}
</style>
