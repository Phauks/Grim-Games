<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		BASE_DISTRIBUTION,
		MAX_DEALT_PLAYERS,
		MIN_PLAYERS,
		SEATED_TYPES
	} from '#lib/core/rules/distribution.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';

	/** The character types dealt for each player count (the Players section of the sheet). */
	interface Props {
		/** Players at the table, when known (the board): that column starts highlighted. */
		players?: number;
	}

	let { players }: Props = $props();
	const counts = Array.from(
		{ length: MAX_DEALT_PLAYERS - MIN_PLAYERS + 1 },
		(_, i) => MIN_PLAYERS + i
	);
	// Tapping a player count highlights its column; tapping it again clears it (Trevor,
	// 2026-10-16). The board starts from its seat count and doesn't store a choice.
	const COUNT_KEY = 'grim-games:play:player-count';
	function storedCount(): number | undefined {
		try {
			const n = Number(globalThis.localStorage?.getItem(COUNT_KEY));
			return counts.includes(n) ? n : undefined;
		} catch {
			return undefined;
		}
	}
	let chosen = $state<number | null>();
	const highlighted = $derived(
		chosen !== undefined
			? (chosen ?? undefined)
			: players === undefined
				? storedCount()
				: Math.min(players, MAX_DEALT_PLAYERS)
	);
	function choose(n: number) {
		chosen = highlighted === n ? null : n;
		if (players !== undefined) return;
		try {
			if (chosen === null) globalThis.localStorage?.removeItem(COUNT_KEY);
			else globalThis.localStorage?.setItem(COUNT_KEY, String(chosen));
		} catch {
			// Private browsing or full storage: the choice lasts until the page closes.
		}
	}
</script>

<div class="scroll">
	<table>
		<thead>
			<tr>
				<th scope="col"><span class="visually-hidden">{t('player.characterType')}</span></th>
				{#each counts as n (n)}
					<th scope="col" data-current={n === highlighted || undefined}>
						<button
							type="button"
							class="count"
							aria-pressed={n === highlighted}
							aria-label={t('player.playerCount', { n })}
							onclick={() => choose(n)}>{n}</button
						>
					</th>
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

<style>
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
	thead th:has(.count) {
		padding: 0;
	}
	.count {
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		touch-action: manipulation;
	}
	.count:hover {
		text-decoration: underline;
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
