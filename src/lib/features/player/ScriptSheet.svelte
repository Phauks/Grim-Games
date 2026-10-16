<script lang="ts">
	import type { Character, LoadedScript } from '#lib/core/data/index.ts';
	import {
		BASE_DISTRIBUTION,
		MAX_DEALT_PLAYERS,
		MIN_PLAYERS,
		SEATED_TYPES
	} from '#lib/core/rules/distribution.ts';
	import type { ScriptJinx } from '#lib/core/rules/jinxes.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import type { ShareTarget } from '#lib/features/scripts/share-codes.ts';
	import ShareControl from '#lib/features/scripts/ShareControl.svelte';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { groupByType } from './player-script.ts';

	interface Props {
		script: LoadedScript;
		jinxes: readonly ScriptJinx[];
		/** Seats in the player's circle; highlights that column of the breakdown. */
		players: number;
		/** Makes the share link for this script when Share or QR code is tapped. */
		shareTarget: (() => Promise<ShareTarget>) | undefined;
	}

	let { script, jinxes, players, shareTarget }: Props = $props();
	const groups = $derived(groupByType(script.characters));
	const names = $derived(script.characters.map((c) => c.name));
	const counts = Array.from(
		{ length: MAX_DEALT_PLAYERS - MIN_PLAYERS + 1 },
		(_, i) => MIN_PLAYERS + i
	);
	const highlighted = $derived(Math.min(players, MAX_DEALT_PLAYERS));
	const byId = $derived(new Map(script.characters.map((c) => [c.id, c])));
	const nameOf = (id: string) => byId.get(id)?.name ?? id;
</script>

{#snippet row(c: Character)}
	<li class="character" data-character={c.id}>
		<CharacterBadge characterId={c.id} character={c} />
		<p class="ability"><GlossaryText text={c.ability} {names} /></p>
	</li>
{/snippet}

<div class="sheet">
	<!-- One control per link; a Room link (live sync) will sit beside this one. -->
	<div class="share">
		<ShareControl what="script" title={script.name} target={shareTarget} />
	</div>
	{#each groups as group (group.type)}
		<section aria-labelledby="type-{group.type}" data-type={group.type}>
			<h2 id="type-{group.type}">{TYPE_PLURALS[group.type]}</h2>
			<ul>
				{#each group.characters as c (c.id)}{@render row(c)}{/each}
			</ul>
		</section>
	{/each}

	<section aria-labelledby="jinxes">
		<h2 id="jinxes">Jinxes</h2>
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
	</section>

	<section aria-labelledby="breakdown">
		<h2 id="breakdown">Players</h2>
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
	</section>
</div>

<style>
	.sheet {
		display: grid;
		gap: var(--space-4);
	}
	.share {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	section {
		display: grid;
		gap: var(--space-2);
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--heading);
		border-bottom: 1px solid var(--border);
		padding-bottom: var(--space-1);
	}
	section[data-type='townsfolk'] h2,
	section[data-type='outsider'] h2 {
		color: var(--good);
	}
	section[data-type='minion'] h2,
	section[data-type='demon'] h2 {
		color: var(--evil);
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
