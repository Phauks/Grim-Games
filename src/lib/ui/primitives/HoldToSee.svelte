<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Something secret shown only while a finger, mouse button or Space is held on it, so a
	 * neighbour can't glance at it (Trevor, 2026-10-19: the locked draw; 2026-10-26: a player's
	 * character on their own phone). Letting go, losing the pointer or the page going hidden
	 * hides it again. Pointer Events, touch first.
	 */
	interface Props {
		/** Held now. */
		held?: boolean;
		/** The button's name, and the face shown while it is not held. */
		label: string;
		/** What shows while held. */
		children: Snippet;
		/** Told on every press and release. */
		onhold?: (on: boolean) => void;
		testid?: string;
	}

	let { held = $bindable(false), label, children, onhold, testid }: Props = $props();

	function hold(on: boolean) {
		if (held === on) return;
		held = on;
		onhold?.(on);
	}
	function onVisibility() {
		if (document.visibilityState !== 'visible') hold(false);
	}
</script>

<svelte:document onvisibilitychange={onVisibility} />

<!-- Held down to show; let go (or lose the pointer) to hide again. -->
<button
	type="button"
	class="hold"
	data-testid={testid}
	aria-pressed={held}
	aria-label={label}
	onpointerdown={(e) => {
		e.currentTarget.setPointerCapture?.(e.pointerId);
		hold(true);
	}}
	onpointerup={() => hold(false)}
	onpointercancel={() => hold(false)}
	onlostpointercapture={() => hold(false)}
	onkeydown={(e) => {
		if (e.key === ' ' && !e.repeat) {
			e.preventDefault();
			hold(true);
		}
	}}
	onkeyup={(e) => e.key === ' ' && hold(false)}
	onblur={() => hold(false)}
>
	{#if held}{@render children()}{:else}<span class="hidden-face">{label}</span>{/if}
</button>

<style>
	/* The face's own box: no button look, no text selection or callout. */
	.hold {
		display: grid;
		place-items: center;
		min-width: calc(10 * var(--u));
		min-height: calc(10 * var(--u));
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		color: inherit;
		touch-action: none;
		user-select: none;
		-webkit-touch-callout: none;
		-webkit-user-select: none;
	}
	/* The same size as the token it hides, so seeing it moves nothing. */
	.hidden-face {
		display: grid;
		place-items: center;
		box-sizing: border-box;
		width: calc(10 * var(--u));
		height: calc(10 * var(--u));
		padding: var(--space-3);
		border-radius: 50%;
		background: var(--token-face);
		color: var(--on-token);
		box-shadow: inset 0 0 0 3px var(--token-rim); /* px-ok: token rim line, as RevealDialog */
		font-size: 0.9rem;
	}
</style>
