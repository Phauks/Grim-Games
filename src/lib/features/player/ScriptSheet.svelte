<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import {
		BASE_DISTRIBUTION,
		MAX_DEALT_PLAYERS,
		MIN_PLAYERS,
		SEATED_TYPES
	} from '#lib/core/rules/distribution.ts';
	import type { ScriptJinx } from '#lib/core/rules/jinxes.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import { groupByType } from './player-script.ts';

	interface Props {
		/** What the sheet lists: the script's characters plus recommended Travellers. */
		characters: readonly Character[];
		jinxes: readonly ScriptJinx[];
		/** Seats in the player's circle; highlights that column of the breakdown. */
		players: number;
	}

	let { characters, jinxes, players }: Props = $props();
	const groups = $derived(groupByType(characters));
	const names = $derived(characters.map((c) => c.name));
	const counts = Array.from(
		{ length: MAX_DEALT_PLAYERS - MIN_PLAYERS + 1 },
		(_, i) => MIN_PLAYERS + i
	);
	const highlighted = $derived(Math.min(players, MAX_DEALT_PLAYERS));
	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const nameOf = (id: string) => byId.get(id)?.name ?? id;
	const TONES: Partial<Record<Character['type'], 'good' | 'evil'>> = {
		townsfolk: 'good',
		outsider: 'good',
		minion: 'evil',
		demon: 'evil'
	};
</script>

{#snippet row(c: Character)}
	<li class="character" data-character={c.id}>
		<CharacterBadge characterId={c.id} character={c} />
		<p class="ability"><GlossaryText text={c.ability} {names} /></p>
	</li>
{/snippet}

<div class="sheet">
	<!-- Each section opens and closes from its header, remembered on the device (Trevor). -->
	{#each groups as group (group.type)}
		<Collapsible
			title={group.type === 'traveller' ? 'Recommended Travellers' : TYPE_PLURALS[group.type]}
			storageKey="play:{group.type}"
			tone={TONES[group.type]}
		>
			<ul>
				{#each group.characters as c (c.id)}{@render row(c)}{/each}
			</ul>
		</Collapsible>
	{/each}

	<Collapsible title="Jinxes" storageKey="play:jinxes">
		{#if jinxes.length}
			<ul>
				{#each jinxes as jinx (jinx.characters.join('+'))}
					<li class="jinx">
						<span class="pair">
							<CharacterBadge
								characterId={jinx.characters[0]}
								character={byId.get(jinx.characters[0])}
							/>
							<CharacterBadge
								characterId={jinx.characters[1]}
								character={byId.get(jinx.characters[1])}
							/>
						</span>
						<p class="ability">
							<GlossaryText
								text={jinx.reason}
								names={[nameOf(jinx.characters[0]), nameOf(jinx.characters[1])]}
							/>
						</p>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="none" data-testid="no-jinxes">None</p>
		{/if}
	</Collapsible>

	<Collapsible title="Players" storageKey="play:breakdown">
		<div class="scroll">
			<table>
				<thead>
					<tr>
						<th scope="col"><span class="visually-hidden">Character type</span></th>
						{#each counts as n (n)}
							<th scope="col" data-current={n === highlighted || undefined}>{n}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each SEATED_TYPES as type (type)}
						<tr data-type={type}>
							<th scope="row">{TYPE_PLURALS[type]}</th>
							{#each counts as n (n)}
								<td data-current={n === highlighted || undefined}>{BASE_DISTRIBUTION[n][type]}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="legend">* Not the first night</p>
	</Collapsible>
</div>

<style>
	.sheet {
		display: grid;
		gap: var(--space-4);
	}
	ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(20 * var(--u))), 1fr));
		gap: var(--space-2) var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.character,
	.jinx {
		display: grid;
		justify-items: start;
		gap: 2px;
		align-content: start;
	}
	.pair {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.ability {
		margin: 0;
		padding-left: var(--space-1);
		font-family: var(--font-ability);
		line-height: 1.35;
	}
	.none,
	.legend {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.scroll {
		overflow-x: auto;
	}
	table {
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
		font-size: 0.9rem;
	}
	th,
	td {
		padding: var(--space-1);
		text-align: center;
		min-width: 1.6em;
	}
	tbody th {
		text-align: left;
		font-weight: 600;
	}
	tr[data-type='townsfolk'] th,
	tr[data-type='outsider'] th {
		color: var(--good);
	}
	tr[data-type='minion'] th,
	tr[data-type='demon'] th {
		color: var(--evil);
	}
	[data-current] {
		background: var(--surface-selected);
		font-weight: 700;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
