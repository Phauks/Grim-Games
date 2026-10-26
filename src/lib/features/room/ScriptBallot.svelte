<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { ScriptVoteOption } from '#lib/core/sync/script-vote.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import ScriptDetails from '#lib/features/scripts/ScriptDetails.svelte';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import type { RoomPlayer } from './player.svelte.ts';
	import VoteStats from './VoteStats.svelte';
	import VoteChoice from './VoteChoice.svelte';
	import VoteTimeLeft from './VoteTimeLeft.svelte';

	/**
	 * A phone's ballot in the room's vote on the next script (Trevor, 2026-10-20, plan R1): the
	 * player screen's content while a vote is open (Trevor, 2026-10-26: its own screen, not a
	 * popup), with the Storyteller's count under it when they let players see it. Taps make a draft that Vote sends (Trevor,
	 * 2026-10-26: "I chose my choices but can't vote, change, or review details"): one script
	 * for a single choice, any for a multiple choice, and for a ranking the scripts tapped in
	 * order, any number of them, moved up or down. Vote again replaces the last ballot and
	 * Withdraw vote takes it back. Each script opens its details (logo, author, characters), so
	 * its row needs only the logo and name.
	 */
	interface Props {
		player: RoomPlayer;
	}

	let { player }: Props = $props();

	const vote = $derived(player.view?.scriptVote);
	let seen: string | undefined;
	$effect(() => {
		const id = vote?.voteId;
		if (id !== seen) draft = undefined;
		seen = id;
	});

	/** This phone's choices before Vote sends them; the sent ballot until the first tap. */
	let draft = $state<string[]>();
	const sent = $derived(vote?.choices ?? []);
	const chosen = $derived(draft ?? sent);
	const changed = $derived(
		draft !== undefined && (draft.length !== sent.length || draft.some((c, i) => c !== sent[i]))
	);
	let ended = $state(false);
	/** No taps while offline or once the time is up. */
	const offline = $derived(player.status !== 'open' || ended);
	const ranked = $derived(vote?.kind === 'ranked');
	/** A ranking lists its order first, then what is not placed yet, in the order offered. */
	const rows = $derived.by(() => {
		const options = vote?.options ?? [];
		if (!ranked) return options;
		const placed = chosen.flatMap((id) => options.filter((o) => o.id === id));
		return [...placed, ...options.filter((o) => !chosen.includes(o.id))];
	});

	function tap(id: string) {
		if (!vote) return;
		const has = chosen.includes(id);
		if (vote.kind === 'single') draft = has ? [] : [id];
		else draft = has ? chosen.filter((c) => c !== id) : [...chosen, id];
	}

	function move(id: string, by: -1 | 1) {
		const next = [...chosen];
		const from = next.indexOf(id);
		const to = from + by;
		if (from < 0 || to < 0 || to >= next.length) return;
		[next[from], next[to]] = [next[to], next[from]];
		draft = next;
	}

	function send() {
		if (chosen.length) player.scriptBallot(chosen);
	}

	function withdraw() {
		if (player.scriptBallot([])) draft = [];
	}

	/** The script whose details are open. */
	let shown = $state<ScriptVoteOption>();
	let detailsOpen = $state(false);
	function details(option: ScriptVoteOption) {
		shown = option;
		detailsOpen = true;
		void loadOfficialData();
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

<!-- The same ballot for a vote on the game mode (Trevor, 2026-10-23). The page's own content
     while a vote is open, not a popup (Trevor, 2026-10-26). -->
<section class="ballot" aria-labelledby="ballot-title" data-testid="ballot-screen">
	<h2 id="ballot-title">{t(mode ? 'room.scriptVote.modeTitle' : 'room.scriptVote.title')}</h2>
	<p class="lead">{lead}</p>
	<VoteTimeLeft endsAt={vote?.endsAt} finalCall={!!vote?.finalCall} onEnded={(e) => (ended = e)} />
	<ul class="vote" data-testid="script-ballot">
		{#each rows as option (option.id)}
			{@const place = chosen.indexOf(option.id)}
			<li>
				<VoteChoice
					mark={ranked && place >= 0 ? place + 1 : ''}
					pressed={place >= 0}
					disabled={offline}
					onclick={() => tap(option.id)}
					>{#if option.logo}<ScriptLogo
							src={option.logo}
							class="ballot-logo"
						/>{/if}{option.name}</VoteChoice
				>
				{#if ranked}
					<!-- Disabled, not hidden, until placed, so nothing moves (Trevor: no reflow). -->
					<IconButton
						icon="moveUp"
						label={t('room.scriptVote.moveUp', { name: option.name })}
						disabled={offline || place <= 0}
						onclick={() => move(option.id, -1)}
					/>
					<IconButton
						icon="moveDown"
						label={t('room.scriptVote.moveDown', { name: option.name })}
						disabled={offline || place < 0 || place >= chosen.length - 1}
						onclick={() => move(option.id, 1)}
					/>
				{/if}
				{#if !mode}
					<IconButton
						icon="info"
						label={t('room.scriptVote.details', { name: option.name })}
						aria-haspopup="dialog"
						onclick={() => details(option)}
					/>
				{/if}
			</li>
		{/each}
	</ul>
	<div class="actions">
		<Button variant="quiet" disabled={offline || sent.length === 0} onclick={withdraw}
			>{t('room.scriptVote.withdraw')}</Button
		>
		<Button variant="accent" disabled={offline || !changed || chosen.length === 0} onclick={send}
			>{t(sent.length ? 'room.scriptVote.change' : 'room.scriptVote.vote')}</Button
		>
	</div>
	{#if vote?.tally}
		<!-- The Storyteller's own count, when they let players see it (Trevor, 2026-10-26). -->
		<VoteStats kind={vote.kind} options={vote.options} tally={vote.tally} />
	{/if}
</section>

<Dialog bind:open={detailsOpen} title={t('scripts.details.label')}>
	{#if shown}
		<ScriptDetails
			heading={t('room.scriptVote.detailsHeading')}
			name={shown.name}
			logo={shown.logo}
			facts={[{ label: t('room.scriptVote.author'), value: shown.author ?? t('common.none') }]}
			entries={shown.characters ?? []}
			data={officialData.current}
		/>
	{/if}
</Dialog>

<style>
	.ballot {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-3);
	}
	.ballot > * {
		margin: 0;
	}
	h2 {
		font-size: 1.2rem;
	}
	.vote {
		display: grid;
		gap: var(--space-1);
		padding: 0;
		list-style: none;
	}
	/* The choice fills the row; its move and details buttons sit at the end. */
	.vote li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.vote li > :global(:first-child) {
		flex: 1;
		min-width: 0;
	}
	/* The script's logo before its name (Trevor, 2026-10-24). */
	.vote :global(.ballot-logo) {
		width: 1.5em;
		height: 1.5em;
		margin-inline-end: var(--space-1);
		vertical-align: middle;
	}
	/* Withdraw on the left, Vote bottom right (Trevor: Confirm bottom right). */
	.actions {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
	}
</style>
