<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Props {
		name: string;
		dead: boolean;
		reminders: number;
		onTap: () => void;
	}

	let { name, dead, reminders, onTap }: Props = $props();

	// Taps come from Pointer Events, not `click`: browsers drop the click of a tap that lands
	// just after a swipe or fling, which made reopening a seat right after dismissing its
	// sheet unreliable. `click` with detail 0 still covers keyboard activation.
	let down: { x: number; y: number } | null = null;
	const TAP_SLOP = 10;

	function pointerup(event: PointerEvent) {
		if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < TAP_SLOP) onTap();
		down = null;
	}
</script>

<button
	class="seat"
	data-dead={dead || undefined}
	aria-label={`Seat: ${name}`}
	onpointerdown={(event) => (down = { x: event.clientX, y: event.clientY })}
	onpointerup={pointerup}
	onpointercancel={() => (down = null)}
	onclick={(event) => event.detail === 0 && onTap()}
>
	<span class="token">
		{#if dead}
			<span class="shroud"><Icon name="dead" /></span>
		{:else}
			<span class="initial">{name.slice(0, 2)}</span>
		{/if}
		{#if reminders > 0}<span class="badge">{reminders}</span>{/if}
	</span>
	<span class="name">{name}</span>
</button>

<style>
	.seat {
		display: grid;
		justify-items: center;
		gap: var(--space-1);
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface);
		cursor: pointer;
	}
	.token {
		position: relative;
		display: grid;
		place-items: center;
		width: calc(4.25 * var(--u));
		height: calc(4.25 * var(--u));
		border-radius: 50%;
		border: 3px solid var(--seat-rim);
		background: var(--seat-face);
		color: var(--seat-color);
		font: var(--seat-font);
		box-shadow: var(--shadow);
	}
	.seat[data-dead] .token {
		filter: grayscale(1) brightness(0.6);
	}
	.initial {
		font-size: 1.1rem;
		text-transform: uppercase;
	}
	.shroud {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		--icon-size: calc(2.25 * var(--u));
	}
	.badge {
		position: absolute;
		right: calc(-0.25 * var(--u));
		bottom: calc(-0.25 * var(--u));
		display: grid;
		place-items: center;
		width: calc(1.5 * var(--u));
		height: calc(1.5 * var(--u));
		border-radius: 50%;
		border: 2px solid var(--on-reminder);
		background: var(--reminder-face);
		color: var(--on-reminder);
		font: 600 0.75rem / 1 var(--font-control);
	}
	.name {
		font-family: var(--font-player);
		font-size: 0.95rem;
	}
</style>
