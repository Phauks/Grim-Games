<script lang="ts">
	import type { NightMarker } from '#lib/core/data/index.ts';
	import { MARKER_TEXT } from '#lib/core/rules/night-order.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import type { PlayerNight } from './player-script.ts';

	interface Props {
		nights: readonly PlayerNight[];
		players: number;
	}

	let { nights, players }: Props = $props();
	const isEvilInfo = (id: NightMarker) => id === 'minioninfo' || id === 'demoninfo';
</script>

<!-- Who wakes, in order. Names only: how to run each step is the Storyteller's. -->
<div class="nights">
	{#each nights as n (n.night)}
		<section aria-labelledby="night-{n.night}" data-night={n.night}>
			<h2 id="night-{n.night}">{n.night === 'first' ? 'First night' : 'Other nights'}</h2>
			<ol>
				{#each n.entries as entry, i (i)}
					<li>
						<span class="num">{i + 1}</span>
						{#if entry.kind === 'marker'}
							{@const off = isEvilInfo(entry.id) && !n.evilInfo}
							<span
								class="marker"
								data-marker={entry.id}
								aria-disabled={off || undefined}
								title={off ? `Not with ${players} players` : undefined}
								>{MARKER_TEXT[entry.id].name}</span
							>
						{:else}
							<CharacterBadge characterId={entry.character.id} />
						{/if}
					</li>
				{/each}
			</ol>
		</section>
	{/each}
</div>

<style>
	.nights {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, calc(16 * var(--u))), 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	h2 {
		margin: 0 0 var(--space-2);
		font-size: 1.1rem;
		color: var(--heading);
		border-bottom: 1px solid var(--border);
		padding-bottom: var(--space-1);
	}
	ol {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.num {
		flex: none;
		width: 2ch;
		text-align: right;
		color: var(--on-surface-muted);
		font-variant-numeric: tabular-nums;
	}
	.marker {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px dashed var(--border);
		border-radius: 999px;
		font-family: var(--font-control);
		color: var(--on-surface-muted);
	}
	.marker[aria-disabled] {
		opacity: 0.45;
		text-decoration: line-through;
	}
</style>
