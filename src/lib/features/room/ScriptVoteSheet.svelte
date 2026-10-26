<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { editionLogo, logoInScriptJson } from '#lib/core/data/script-logo.ts';
	import { editionScript } from '#lib/core/data/index.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import {
		MAX_SCRIPT_VOTE_OPTIONS,
		MIN_SCRIPT_VOTE_OPTIONS,
		SCRIPT_VOTE_KINDS,
		SCRIPT_VOTE_MINUTES,
		VOTE_SUBJECTS,
		type ScriptVoteCharacter,
		type ScriptVoteKind,
		type VoteSubject
	} from '#lib/core/sync/script-vote.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { readEntries } from '#lib/features/scripts/botcscripts-api.ts';
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
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import { roomHost } from './host.svelte.ts';
	import { scriptVoteCountLabel } from './script-vote-count.ts';
	import VoteTimeLeft from './VoteTimeLeft.svelte';

	/**
	 * The room's vote on the next script (Trevor, 2026-10-20, plan R1): the Storyteller offers
	 * scripts, players vote on their phones, and the Storyteller picks from the count. New game
	 * shows it; the room only counts. Scripts are found with New game's own script controls
	 * (Trevor, 2026-10-23: "same search controls as available outside in new game mode") and
	 * added in rows, any number up to MAX_SCRIPT_VOTE_OPTIONS (Trevor, 2026-10-23: "should not
	 * be limited to 2 or 3"). The same vote can be on the game mode, from New game's own list
	 * of modes (Trevor, 2026-10-23). While the vote is open the sheet shows the
	 * room's code and QR, so players not in the room yet can join and vote (Trevor,
	 * 2026-10-23), and the time left when the Storyteller set a limit. Trevor, 2026-10-26: the
	 * Storyteller can let players see the count, before or during the vote, and end it early
	 * with a final call on every phone; each script carries its characters, so players can
	 * read its details; a ranking is counted as an instant runoff.
	 */
	interface Props {
		open: boolean;
		/** The scripts New game offers, by its own ids. */
		choices: ScriptChoiceOption[];
		/** The Storyteller picked this script from the count. */
		onPick: (id: string) => void;
		/** The game modes New game offers, Standard first. */
		modes: { value: string; label: string }[];
		/** The Storyteller picked this game mode from the count. */
		onPickMode: (id: string) => void;
	}

	let { open = $bindable(), choices, onPick, modes, onPickMode }: Props = $props();

	const host = roomHost();
	// The base three's characters, for their details on the ballot.
	$effect(() => {
		if (open) void loadOfficialData();
	});
	const tally = $derived(host.scriptVote);
	let subject = $state<VoteSubject>('script');
	const onMode = $derived(subject === 'mode');
	const subjects = VOTE_SUBJECTS.map((value) => ({
		value,
		label: t(`room.scriptVote.subject.${value}`)
	}));
	let picked = $state<string[]>([]);
	let kind = $state<ScriptVoteKind>('single');
	/** The script New game's controls show, added to the vote with Add to vote. */
	let adding = $state<ScriptChoice>('tb');
	/** The game mode the drop-down shows, for a vote on the mode. */
	let addingMode = $state('');
	const nextMode = $derived(modes.find((m) => !picked.includes(m.value))?.value ?? '');
	const modeShown = $derived(
		modes.some((m) => m.value === addingMode) && !picked.includes(addingMode)
			? addingMode
			: nextMode
	);
	const candidate = $derived(onMode ? modeShown : adding);
	const offered = $derived(onMode ? modes : choices);
	const addable = $derived(
		picked.length < MAX_SCRIPT_VOTE_OPTIONS &&
			!!candidate &&
			!picked.includes(candidate) &&
			offered.some((c) => c.value === candidate)
	);
	const nameOf = (id: string) => offered.find((c) => c.value === id)?.label ?? id;
	/**
	 * Rows for what is picked and one more while there is room, never fewer than a vote needs,
	 * so the next Add fills a row that is already there.
	 */
	const rows = $derived(
		Math.min(MAX_SCRIPT_VOTE_OPTIONS, Math.max(MIN_SCRIPT_VOTE_OPTIONS, picked.length + 1))
	);
	function setSubject(next: VoteSubject) {
		if (next === subject) return;
		subject = next;
		picked = [];
	}
	/** Players see the count too; off keeps the ballot secret, as before. */
	let showTally = $state(false);
	let ended = $state(false);
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
			if (onMode) {
				const mode = modes.find((m) => m.value === id);
				return mode ? [{ id, name: mode.label }] : [];
			}
			const choice = choices.find((c) => c.value === id);
			if (!choice) return [];
			const logo = editionLogo(choice.value) ?? logoInScriptJson(choice.json);
			const edition = editionOf(choice);
			const author = choice.author ?? edition?.meta?.author;
			const characters = choice.json
				? readEntries(choice.json)
				: (edition?.characters.map((c): ScriptVoteCharacter => ({ id: c.id })) ?? []);
			return [
				{
					id,
					name: choice.label,
					...(author ? { author } : {}),
					...(logo ? { logo } : {}),
					...(characters.length ? { characters } : {})
				}
			];
		});
		const limit = minutes === NO_LIMIT ? undefined : Number(minutes);
		if (host.openScriptVote(kind, options, limit, subject, showTally)) picked = [];
	}

	/** One of the base three, for its author and characters in its details on the ballot. */
	function editionOf(choice: ScriptChoiceOption) {
		const data = officialData.current;
		return !choice.json && data ? editionScript(choice.value, data) : undefined;
	}

	function setShowTally(show: boolean) {
		if (tally) host.showScriptVoteTally(show);
		else showTally = show;
	}

	function pick(id: string) {
		const mode = tally?.subject === 'mode';
		host.closeScriptVote();
		open = false;
		if (mode) onPickMode(id);
		else onPick(id);
	}
</script>

<BottomSheet
	bind:open
	title={t(
		(tally ? tally.subject === 'mode' : onMode)
			? 'room.scriptVote.modeTitle'
			: 'room.scriptVote.title'
	)}
	wide
>
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
							<li data-winner={tally.winner === option.id || undefined}>
								<span class="name">{option.name}</span>
								<span class="points">{scriptVoteCountLabel(tally.kind, tally, option.id)}</span>
								<Button onclick={() => pick(option.id)}>{t('room.scriptVote.play')}</Button>
							</li>
						{/each}
					</ul>
				{:else}
					<Select
						label={t('room.scriptVote.subject')}
						options={subjects}
						value={subject}
						onChange={setSubject}
					/>
					<!-- A row for each pick and an empty one for the next, so Add fills a row in place. -->
					<fieldset class="slots">
						<legend>{t(onMode ? 'room.scriptVote.modes' : 'room.scriptVote.scripts')}</legend>
						<ol data-testid="script-vote-slots">
							{#each { length: rows }, i}
								{@const id = picked[i]}
								<li>
									<span class="slot"
										>{t(onMode ? 'room.scriptVote.modeSlot' : 'room.scriptVote.slot', {
											number: i + 1
										})}</span
									>
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
					{#if onMode}
						<!-- New game's own list of modes, Standard first. -->
						<Select
							label={t('room.scriptVote.addMode')}
							options={modes.filter((m) => !picked.includes(m.value))}
							value={modeShown}
							onChange={(v) => (addingMode = v)}
						/>
					{:else}
						<!-- New game's own script controls: the base three, search, and the Library. -->
						<ScriptPicker
							label={t('room.scriptVote.addScript')}
							value={adding}
							onChange={(v) => (adding = v)}
						/>
					{/if}
					<Button icon="add" disabled={!addable} onclick={() => (picked = [...picked, candidate])}
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
					<VoteTimeLeft
						endsAt={tally.endsAt}
						finalCall={!!tally.finalCall}
						onEnded={(e) => (ended = e)}
					/>
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
				<!-- Before and during the vote, in the same place (Trevor, 2026-10-26). -->
				<Toggle
					label={t('room.scriptVote.showTally')}
					checked={tally ? !!tally.showTally : showTally}
					onChange={setShowTally}
				/>
			</div>
			<div class="end">
				{#if tally}
					<!-- Ends it after a final call on every phone (Trevor, 2026-10-26); Close
					     vote takes it off the phones at once. -->
					<Button disabled={!!tally.finalCall || ended} onclick={() => host.endScriptVote()}
						>{t('room.scriptVote.end')}</Button
					>
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
		gap: var(--space-2);
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
	/* The instant runoff's winner (Trevor, 2026-10-26). */
	.results li[data-winner] .points {
		color: var(--accent);
		font-weight: 600;
	}
</style>
