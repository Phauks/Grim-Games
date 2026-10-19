<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import UpdateChanges from './UpdateChanges.svelte';
	import { updateCheck } from './update-check.svelte.ts';

	// How often an open app checks for a new build (a game can run for hours).
	const CHECK_EVERY_MS = 30 * 60 * 1000;

	let waiting = $state<ServiceWorker | null>(null);
	let dismissed = $state(false);
	// Another tab tapped Refresh: the new build is active here too, but this page still runs
	// the old one until it reloads.
	let activated = $state(false);
	// What the waiting build changed (update-check.svelte.ts), shared with About.
	const changes = $derived(updateCheck.changes);
	let changesOpen = $state(false);
	const listId = $props.id();
	const toggleLabel = $derived(
		!changes
			? t('shell.whatChanged')
			: changes.complete
				? t('shell.whatChangedCount', { count: changes.commits.length })
				: t('shell.whatChanged')
	);

	$effect(() => {
		if (waiting || activated) void updateCheck.loadChanges();
	});
	// About offers Refresh too once a build is ready, however it was found.
	$effect(() => {
		if (waiting || activated) updateCheck.ready = true;
	});

	// Check for updates in About found a build: show the card again, even after Later.
	$effect(() => {
		if (updateCheck.found === 0) return;
		dismissed = false;
		void navigator.serviceWorker?.getRegistration().then((reg) => {
			if (reg?.waiting && navigator.serviceWorker.controller) waiting = reg.waiting;
		});
	});

	onMount(() => {
		if (!('serviceWorker' in navigator)) return;
		let registration: ServiceWorkerRegistration | undefined;

		const watch = (reg: ServiceWorkerRegistration) => {
			registration = reg;
			// About shows a download the browser started by itself.
			updateCheck.watch(reg);
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
		let hadController = !!navigator.serviceWorker.controller;
		const onControllerChange = () => {
			// Refresh was tapped here or in About; updateCheck.refresh reloads the page.
			if (updateCheck.refreshing) return;
			// A first install claims the page too; only a page that had a controller is behind.
			if (hadController) {
				activated = true;
				dismissed = false;
			}
			hadController = true;
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
		if (activated) return location.reload();
		void updateCheck.refresh();
	}
</script>

{#if (waiting || activated) && !dismissed}
	<div class="update" role="status" data-testid="update-banner">
		<div class="main">
			<p class="text">
				<strong>{t('shell.updateReady')}</strong>
				<span>{t('shell.updateSaved')}</span>
			</p>
			<div class="actions">
				<Button variant="quiet" onclick={() => (dismissed = true)}>{t('shell.updateLater')}</Button>
				<Button variant="accent" onclick={refresh}>{t('shell.updateRefresh')}</Button>
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
			{toggleLabel}
		</button>
		<div id={listId} class="changes" hidden={!changesOpen || !changes}>
			{#if changes}<UpdateChanges {changes} />{/if}
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
		box-shadow: 0 calc(0.5 * var(--u)) calc(1.5 * var(--u)) rgb(0 0 0 / 0.4); /* colour-ok: a shadow is darkness, not a theme colour */
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
	@media (prefers-reduced-motion: reduce) {
		.caret {
			transition: none;
		}
	}
</style>
