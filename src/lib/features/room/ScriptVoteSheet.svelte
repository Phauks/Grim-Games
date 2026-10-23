<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import {
		MAX_SCRIPT_VOTE_OPTIONS,
		MIN_SCRIPT_VOTE_OPTIONS,
		SCRIPT_VOTE_KINDS,
		SCRIPT_VOTE_MINUTES,
		type ScriptVoteKind
	} from '#lib/core/sync/script-vote.ts';
	import ScriptPicker from '#lib/features/modes/ScriptPicker.svelte';
	import type {
		ScriptChoice,
		ScriptChoiceOption
	} from '#lib/features/modes/script-choices.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import { roomHost } from './host.svelte.ts';
	import VoteTimeLeft from './VoteTimeLeft.svelte';

	/**
	 * The room's vote on the next script (Trevor, 2026-10-20, plan R1): the Storyteller offers
	 * two or three scripts, players vote on their phones, and the Storyteller picks from the
	 * count. New game shows it; the room only counts. Scripts are found with New game's own
	 * script controls (Trevor, 2026-10-23: "same search controls as available outside in new
	 * game mode") and added to three fixed rows. While the vote is open the sheet shows the
	 * room's code and QR, so players not in the room yet can join and vote (Trevor,
	 * 2026-10-23), and the time left when the Storyteller set a limit.
	 */
	interface Props {
		open: boolean;
		/** The scripts New game offers, by its own ids. */
		choices: ScriptChoiceOption[];
		/** The Storyteller picked this script from the count. */
		onPick: (id: string) => void;
	}

	let { open = $bindable(), choices, onPick }: Props = $props();

	const host = roomHost();
	const tally = $derived(host.scriptVote);
	let picked = $state<string[]>([]);
	let kind = $state<ScriptVoteKind>('single');
	/** The script New game's controls show, added to the vote with Add to vote. */
	let adding = $state<ScriptChoice>('tb');
	const addable = $derived(
		picked.length < MAX_SCRIPT_VOTE_OPTIONS &&
			!picked.includes(adding) &&
			choices.some((c) => c.value === adding)
	);
	const nameOf = (id: string) => choices.find((c) => c.value === id)?.label ?? id;
	const NO_LIMIT = 'none';
	let minutes = $state<string>(NO_LIMIT);
	const limits = [
		{ value: NO_LIMIT, label: t('room.scriptVote.noLimit') },
		...SCRIPT_VOTE_MINUTES.map((m) => ({
			value: String(m),
			label: t('room.scriptVote.minutes', { count: m })
		}))
	];
	const link = $derived(
		host.code ? `${location.origin}${resolve('/join/[code]', { code: host.code })}` : undefined
	);
	const kinds = SCRIPT_VOTE_KINDS.map((value) => ({
		value,
		label: t(`room.scriptVote.kind.${value}`)
	}));
	const ready = $derived(
		picked.length >= MIN_SCRIPT_VOTE_OPTIONS && picked.length <= MAX_SCRIPT_VOTE_OPTIONS
	);

	function openVote() {
		const options = picked.flatMap((id) => {
			const choice = choices.find((c) => c.value === id);
			return choice
				? [{ id, name: choice.label, ...(choice.author ? { author: choice.author } : {}) }]
				: [];
		});
		const limit = minutes === NO_LIMIT ? undefined : Number(minutes);
		if (host.openScriptVote(kind, options, limit)) picked = [];
	}

	function pick(id: string) {
		host.closeScriptVote();
		open = false;
		onPick(id);
	}
</script>

<BottomSheet bind:open title={t('room.scriptVote.title')} wide>
	<!-- Two columns on a tablet or wider (Trevor, 2026-10-23): the scripts on the left; the
	     room's code and QR, the time and the count on the right, from before the vote opens
	     so players can join first. One column on a phone, the scripts first. -->
	<div class="layout">
		<form
			class="vote"
			onsubmit={(e) => {
				e.preventDefault();
				if (!tally && ready) openVote();
			}}
		>
			<div class="scripts">
				{#if tally}
					<ul class="results" data-testid="script-vote-results">
						{#each tally.options as option (option.id)}
							<li>
								<span class="name">{option.name}</span>
								<span class="points"
									>{t(
										tally.kind === 'ranked' ? 'room.scriptVote.points' : 'room.scriptVote.votes',
										{ count: tally.points[option.id] ?? 0 }
									)}</span
								>
								<Button onclick={() => pick(option.id)}>{t('room.scriptVote.play')}</Button>
							</li>
						{/each}
					</ul>
				{:else}
					<!-- Three rows, always here, so adding or removing a script moves nothing. -->
					<fieldset class="slots">
						<legend>{t('room.scriptVote.scripts')}</legend>
						<ol data-testid="script-vote-slots">
							{#each { length: MAX_SCRIPT_VOTE_OPTIONS }, i}
								{@const id = picked[i]}
								<li>
									<span class="slot">{t('room.scriptVote.slot', { number: i + 1 })}</span>
									<span class="name" class:none={!id}>{id ? nameOf(id) : t('common.none')}</span>
									<DeleteButton
										label={t('room.scriptVote.remove', { name: id ? nameOf(id) : '' })}
										disabled={!id}
										onclick={() => (picked = picked.filter((p) => p !== id))}
									/>
								</li>
							{/each}
						</ol>
					</fieldset>
					<!-- New game's own script controls: the base three, search, and the Library. -->
					<ScriptPicker
						label={t('room.scriptVote.addScript')}
						value={adding}
						onChange={(v) => (adding = v)}
					/>
					<Button icon="add" disabled={!addable} onclick={() => (picked = [...picked, adding])}
						>{t('room.scriptVote.add')}</Button
					>
					<Select
						label={t('room.scriptVote.how')}
						options={kinds}
						value={kind}
						onChange={(v) => (kind = v)}
					/>
				{/if}
			</div>
			<div class="room">
				<!-- The room's code and QR, so players who are not in the room yet can join and vote. -->
				<section class="join" aria-label={t('room.scriptVote.join')}>
					<SharePanel
						url={link}
						title={t('room.scriptVote.join')}
						qrLabel={t('room.qrLabel')}
						pending={t('room.joining')}
						code={{ label: t('room.joinCode'), value: host.code && formatRoomCode(host.code) }}
						text={host.code ? t('room.shareText', { code: formatRoomCode(host.code) }) : undefined}
					/>
				</section>
				{#if tally}
					<VoteTimeLeft endsAt={tally.endsAt} />
					<p class="count" data-testid="script-vote-count">
						{t('room.scriptVote.voted', { voted: tally.voted, members: tally.members })}
					</p>
				{:else}
					<Select
						label={t('room.scriptVote.timeLimit')}
						options={limits}
						value={minutes}
						onChange={(v) => (minutes = v)}
					/>
				{/if}
			</div>
			<div class="end">
				{#if tally}
					<Button variant="danger" onclick={() => host.closeScriptVote()}
						>{t('room.scriptVote.close')}</Button
					>
				{:else}
					<ModalActions
						onCancel={() => (open = false)}
						submit
						disabled={!ready || !host.code}
						confirmLabel={t('room.scriptVote.open')}
					/>
				{/if}
			</div>
		</form>
	</div>
</BottomSheet>

<style>
	.vote {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
	}
	.layout {
		container-type: inline-size;
	}
	.scripts,
	.room {
		display: grid;
		align-content: start;
		gap: var(--space-4);
		min-width: 0;
	}
	.end {
		display: flex;
		justify-content: flex-end;
	}
	/* The sheet's width, not the window's: a computer's panel and a tablet's sheet alike. */
	@container (min-width: 30rem) {
		.vote {
			grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
			column-gap: var(--space-5);
		}
		.end {
			grid-column: 1 / -1;
		}
	}
	.slots {
		margin: 0;
		padding: 0;
		border: 0;
	}
	.slots legend {
		padding: 0;
		margin-bottom: var(--space-2);
	}
	.slots ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Rows with dividers (Trevor: stacked items are delineated). */
	.slots li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-3);
	}
	.slots li + li {
		border-top: 1px solid var(--border);
	}
	.slot {
		color: var(--on-surface-muted);
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.name.none {
		color: var(--on-surface-muted);
	}
	.count {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.results {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.results li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--space-3);
	}
	.points {
		font-variant-numeric: tabular-nums;
	}
</style>
