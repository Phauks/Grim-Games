<script lang="ts">
	import type { Snippet } from 'svelte';
	import type {
		ScriptVoteKind,
		ScriptVoteOption,
		ScriptVoteTally
	} from '#lib/core/sync/script-vote.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import { scriptVoteCountLabel } from './script-vote-count.ts';

	/**
	 * The room vote's live count, the same on the Storyteller's vote screen and on each phone
	 * the Storyteller lets see it (Trevor, 2026-10-26: "players and storytellers get the same
	 * good, accurate, up to date stats"). Each option's votes with a bar of its share; for a
	 * ranked vote, its instant runoff's winner or the round it went out in, and the rounds one
	 * by one in a dialog. Then how many have voted and who, never what they chose. The room
	 * counts the phones that are here now, and anyone who has voted.
	 */
	interface Props {
		kind: ScriptVoteKind;
		options: readonly ScriptVoteOption[];
		tally: Pick<
			ScriptVoteTally,
			'points' | 'out' | 'winner' | 'rounds' | 'voted' | 'members' | 'people'
		>;
		/** At the end of each option's row, e.g. the Storyteller's Play. */
		action?: Snippet<[ScriptVoteOption]>;
	}

	let { kind, options, tally, action }: Props = $props();

	/** What a bar measures: ballots still counting in the last round, or everyone who voted. */
	const whole = $derived.by(() => {
		const last = tally.rounds?.at(-1);
		if (kind === 'ranked' && last) return Object.values(last).reduce((a, b) => a + b, 0);
		return tally.voted;
	});
	const share = (id: string) =>
		whole > 0 && !tally.out?.[id] ? Math.round(((tally.points[id] ?? 0) / whole) * 100) : 0;
	const nameOf = (id: string) => options.find((o) => o.id === id)?.name ?? id;
	let roundsOpen = $state(false);
</script>

<section class="stats" aria-label={t('room.scriptVote.count')} data-testid="vote-stats">
	<ol class="options">
		{#each options as option (option.id)}
			<li
				data-winner={tally.winner === option.id || undefined}
				data-out={tally.out?.[option.id] ? '' : undefined}
			>
				<span class="name"
					>{#if option.logo}<ScriptLogo
							src={option.logo}
							class="stats-logo"
						/>{/if}{option.name}</span
				>
				<span class="points" data-testid="vote-count"
					>{scriptVoteCountLabel(kind, tally, option.id)}</span
				>
				{#if action}<span class="action">{@render action(option)}</span>{/if}
				<span class="bar" aria-hidden="true"><span style:width="{share(option.id)}%"></span></span>
			</li>
		{/each}
	</ol>
	<div class="summary">
		<p class="voted" data-testid="script-vote-count">
			{t('room.scriptVote.voted', { voted: tally.voted, members: tally.members })}
		</p>
		{#if kind === 'ranked'}
			<!-- Always here for a ranking; usable once there is a round to show. -->
			<Button
				variant="quiet"
				aria-haspopup="dialog"
				disabled={!tally.rounds?.length || tally.voted === 0}
				onclick={() => (roundsOpen = true)}>{t('room.scriptVote.rounds')}</Button
			>
		{/if}
	</div>
	{#if tally.people?.length}
		<ul class="people" aria-label={t('room.scriptVote.people')} data-testid="vote-people">
			{#each tally.people as person, i (i)}
				<li data-voted={person.voted || undefined}>
					{#if person.name}<PlayerBadge name={person.name} />{:else}<span class="unnamed"
							>{t('room.scriptVote.unnamed')}</span
						>{/if}
					<span class="state"
						>{t(person.voted ? 'room.scriptVote.hasVoted' : 'room.scriptVote.notVoted')}</span
					>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<!-- The rounds one by one, as extra detail (Trevor: extra detail in a modal). -->
<Dialog bind:open={roundsOpen} title={t('room.scriptVote.rounds')}>
	<ol class="rounds" data-testid="vote-rounds">
		{#each tally.rounds ?? [] as round, r (r)}
			{@const dropped = Object.entries(tally.out ?? {}).find(([, at]) => at === r + 1)?.[0]}
			<li>
				<h3>{t('room.scriptVote.round', { round: r + 1 })}</h3>
				<p>
					{Object.entries(round)
						.map(([id, n]) => t('room.scriptVote.roundCount', { name: nameOf(id), count: n }))
						.join(' · ')}
				</p>
				{#if dropped}<p class="muted">
						{t('room.scriptVote.roundOut', { name: nameOf(dropped) })}
					</p>{:else if tally.winner && r === (tally.rounds?.length ?? 0) - 1}<p>
						{t('room.scriptVote.roundWin', { name: nameOf(tally.winner) })}
					</p>{/if}
			</li>
		{/each}
	</ol>
</Dialog>

<style>
	.stats {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.options,
	.people,
	.rounds {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Rows with dividers (Trevor: stacked items are rows, not cards). */
	.options li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--space-1) var(--space-3);
		padding-block: var(--space-2);
	}
	.options li + li,
	.rounds li + li {
		border-top: 1px solid var(--border);
	}
	.name {
		overflow-wrap: anywhere;
	}
	.options :global(.stats-logo) {
		width: 1.5em;
		height: 1.5em;
		margin-inline-end: var(--space-1);
		vertical-align: middle;
	}
	.points {
		font-variant-numeric: tabular-nums;
		color: var(--on-surface-muted);
	}
	li[data-winner] .points {
		color: var(--accent);
		font-weight: 600;
	}
	li[data-out] .name {
		color: var(--on-surface-muted);
	}
	/* Each option's share, under its row. */
	.bar {
		grid-column: 1 / -1;
		height: 0.35rem;
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--accent);
		transition: width 0.3s ease;
	}
	.summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.voted {
		margin: 0;
	}
	.people {
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: var(--space-1) var(--space-3);
	}
	.people li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-width: 0;
	}
	.state {
		color: var(--on-surface-muted);
		font-size: 0.9em;
	}
	.people li[data-voted] .state {
		color: var(--on-surface);
	}
	.unnamed {
		color: var(--on-surface-muted);
	}
	.rounds li {
		padding-block: var(--space-2);
	}
	.rounds h3 {
		margin: 0 0 var(--space-1);
		font-size: 1rem;
	}
	.rounds p {
		margin: 0;
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>
