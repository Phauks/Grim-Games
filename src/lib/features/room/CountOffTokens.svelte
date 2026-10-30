<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import type { CountOffView } from '#lib/core/sync/room.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';

	/**
	 * Count off's numbers (plan J40; Trevor, 2026-10-30: "more like tokens then a dropdown"),
	 * the same on the phones and the Storyteller's device: a token for each number round the
	 * clock, with the name of whoever holds it under it ("others can see their name with the
	 * number"). The name's line is kept while no one holds it, so a tap moves nothing.
	 */
	interface Props {
		view: CountOffView;
		onTap: (number: number) => void;
	}

	let { view, onTap }: Props = $props();

	const holders = $derived(new Map(view.tokens.map((token) => [token.number, token])));
	const numbers = $derived(Array.from({ length: view.size }, (_, i) => i + 1));
</script>

<ul class="tokens" aria-label={t('room.countOff.numbers')} data-testid="count-off-tokens">
	{#each numbers as number (number)}
		{@const holder = holders.get(number)}
		<li class="cell">
			<button
				type="button"
				class="token"
				class:held={!!holder}
				class:mine={holder?.mine}
				aria-label={holder
					? t('room.countOff.held', { number, name: holder.name })
					: t('room.countOff.free', { number })}
				aria-pressed={holder?.mine ?? false}
				data-testid="count-off-token"
				onclick={() => onTap(number)}>{number}</button
			>
			<span class="name"
				>{#if holder}<PlayerBadge name={holder.name as PlayerName} />{/if}</span
			>
		</li>
	{/each}
</ul>

<style>
	.tokens {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(var(--tap-target) * 1.6), 1fr));
		gap: var(--space-3) var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.cell {
		display: grid;
		justify-items: center;
		gap: var(--space-1);
		min-width: 0;
	}
	.token {
		width: calc(var(--tap-target) * 1.15);
		height: calc(var(--tap-target) * 1.15);
		border: 1px solid var(--accent);
		border-radius: 50%;
		background: var(--token-face);
		color: var(--on-token);
		font-family: var(--font-control);
		font-size: 1.25rem;
	}
	.token.held {
		border-color: var(--border);
		background: var(--surface);
		color: var(--on-surface-muted);
	}
	.token.mine {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: var(--button-ring);
	}
	.name {
		max-width: 100%;
		min-width: 0;
		min-height: 1.4em;
		font-size: 0.85rem;
	}
</style>
