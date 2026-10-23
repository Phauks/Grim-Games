<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { RoomPlayer } from './player.svelte.ts';
	import VoteChoice from './VoteChoice.svelte';
	import VoteTimeLeft from './VoteTimeLeft.svelte';

	/**
	 * A phone's ballot in the room's vote on the next script (Trevor, 2026-10-20, plan R1). It
	 * opens over the page once for each new vote. A single choice is one tap; a multiple
	 * choice toggles each script; a ranking takes the scripts in order and is sent once all
	 * are placed. Each change is sent at once and replaces the last ballot.
	 */
	interface Props {
		player: RoomPlayer;
	}

	let { player }: Props = $props();

	const vote = $derived(player.view?.scriptVote);
	let open = $state(false);
	let seen: string | undefined;
	$effect(() => {
		const id = vote?.voteId;
		if (id && id !== seen) {
			open = true;
			ranking = undefined;
		}
		if (!id) open = false;
		seen = id;
	});

	/** A ranking being made, from the first tap or Start again until it is sent and after. */
	let ranking = $state<string[]>();
	const chosen = $derived(ranking ?? vote?.choices ?? []);
	let ended = $state(false);
	/** No taps while offline or once the Storyteller's time limit is up. */
	const offline = $derived(player.status !== 'open' || ended);

	function tap(id: string) {
		if (!vote) return;
		if (vote.kind === 'single') player.scriptBallot([id]);
		else if (vote.kind === 'multiple') {
			const next = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id];
			if (next.length) player.scriptBallot(next);
		} else {
			const next = ranking ?? [];
			if (next.includes(id)) return;
			ranking = [...next, id];
			if (ranking.length === vote.options.length) player.scriptBallot(ranking);
		}
	}

	const mode = $derived(vote?.subject === 'mode');
	const lead = $derived(
		vote?.kind === 'single'
			? t(mode ? 'room.scriptVote.modeBallotSingle' : 'room.scriptVote.ballotSingle')
			: vote?.kind === 'multiple'
				? t(mode ? 'room.scriptVote.modeBallotMultiple' : 'room.scriptVote.ballotMultiple')
				: t(mode ? 'room.scriptVote.modeBallotRanked' : 'room.scriptVote.ballotRanked')
	);
</script>

<!-- The same ballot for a vote on the game mode (Trevor, 2026-10-23). -->
<Dialog bind:open title={t(mode ? 'room.scriptVote.modeTitle' : 'room.scriptVote.title')}>
	<p class="lead">{lead}</p>
	<VoteTimeLeft endsAt={vote?.endsAt} onEnded={(e) => (ended = e)} />
	<ul class="vote" data-testid="script-ballot">
		{#each vote?.options ?? [] as option (option.id)}
			{@const place = chosen.indexOf(option.id)}
			<li>
				<VoteChoice
					mark={vote?.kind === 'ranked' && place >= 0 ? place + 1 : ''}
					pressed={place >= 0}
					disabled={offline}
					onclick={() => tap(option.id)}
					>{option.name}{#if option.author}<span class="author">, {option.author}</span
						>{/if}</VoteChoice
				>
			</li>
		{/each}
	</ul>
	{#if vote?.kind === 'ranked'}
		<!-- In place for a ranking, so a mistake can be undone without reopening. -->
		<Button variant="quiet" disabled={offline || chosen.length === 0} onclick={() => (ranking = [])}
			>{t('room.scriptVote.again')}</Button
		>
	{/if}
</Dialog>

<style>
	.lead {
		margin: 0 0 var(--space-3);
	}
	.vote {
		display: grid;
		gap: var(--space-1);
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
	}
	.author {
		color: var(--on-surface-muted);
	}
</style>
