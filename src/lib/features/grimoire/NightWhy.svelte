<script lang="ts">
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { trueCharacter, type SeatId } from '#lib/core/model/index.ts';
	import type { AnswerValue, Why } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatName } from './night-steps.ts';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';

	/**
	 * The logic behind a night suggestion (Trevor, 2026-10-17: "show the logic"): the players
	 * it is worked out from and what it becomes if one registers otherwise. Beside the
	 * information in the opened step; its reliability is already in the flags above it.
	 */
	interface Props {
		grimoire: Grimoire;
		why: Why;
	}

	let { grimoire, why }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);

	const TYPE: Record<string, string> = {
		townsfolk: 'Townsfolk',
		outsider: 'Outsider',
		minion: 'Minion',
		demon: 'Demon',
		traveller: 'Traveller',
		fabled: 'Fabled',
		loric: 'Loric'
	};
	const ALIGNMENT: Record<string, string> = { good: 'Good', evil: 'Evil' };
</script>

<!-- A player as their name pill and their character's badge (Trevor, 2026-10-17). -->
{#snippet player(
	seatId: SeatId,
	characterId: CharacterId | undefined = trueCharacter(game, seatId, characters)
)}<span class="player"
		><PlayerBadge name={seatName(game, seatId)} />{#if characterId}<CharacterBadge
				{characterId}
				character={characters.get(characterId)}
			/>{/if}</span
	>{/snippet}

{#snippet value(v: AnswerValue)}{#if v.kind === 'character'}<CharacterBadge
			characterId={v.value}
			character={characters.get(v.value)}
		/>{:else if v.kind === 'yes-no'}{v.value
			? 'Yes'
			: 'No'}{:else if v.kind === 'number'}{v.value}{:else if v.kind === 'characters'}{#each v.value as id, n (id)}{n
				? ', '
				: ''}<CharacterBadge characterId={id} character={characters.get(id)} />{/each}{#if v.more}{v
				.value.length > 0
				? ', '
				: ''}+<CountBadge count={v.more.count} />
			{TYPE[v.more.type] ??
				v.more.type}{:else if v.value.length === 0}None{/if}{:else}{v.reason}{/if}{/snippet}

<div class="why-block" data-testid="why">
	{#if why.facts.length > 0}
		<span class="why-head">From</span>
		<ul class="why" data-testid="why-facts">
			<!-- By position: the Juggler's facts name a player once per guess. -->
			{#each why.facts as f, i (i)}
				<li>
					{@render player(f.seatId, f.characterId)}
					{#if f.type}<span class="fact">{TYPE[f.type] ?? f.type}</span>{/if}
					{#if f.alignment}<span class="fact">{ALIGNMENT[f.alignment]}</span>{/if}
					{#if f.dead}<span class="fact">Dead</span>{/if}
					{#if f.redHerring}<span class="fact">Red herring</span>{/if}
					{#if f.guess}<span class="fact"
							>Guess: <CharacterBadge
								characterId={f.guess.characterId}
								character={characters.get(f.guess.characterId)}
							/>
							{f.guess.correct ? 'Right' : 'Wrong'}</span
						>{/if}
				</li>
			{/each}
		</ul>
	{/if}
	{#if why.alternatives.length > 0}
		<span class="why-head">If someone registers otherwise</span>
		<ul class="why" data-testid="why-alternatives">
			{#each why.alternatives as alt (alt.seatId)}
				{#each alt.as as way, n (n)}
					<li>
						{@render player(alt.seatId, alt.source)}
						<span class="fact"
							>as {[way.alignment && ALIGNMENT[way.alignment], way.type && TYPE[way.type]]
								.filter(Boolean)
								.join(' ')}</span
						>
						{#if way.value}<span aria-hidden="true">→</span>
							<strong>{@render value(way.value)}</strong>{/if}
					</li>
				{/each}
			{/each}
		</ul>
	{/if}
</div>

<style>
	.why-block {
		display: grid;
		gap: var(--space-1);
		width: 100%;
		font-size: 0.85rem;
	}
	.why {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.why > li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
	}
	.why-head {
		color: var(--on-surface-muted);
		font-weight: 600;
	}
	.player {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	.fact {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--on-surface-muted);
	}
</style>
