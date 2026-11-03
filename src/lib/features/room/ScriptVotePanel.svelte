<script lang="ts">
	import { roomJoinLink } from './join-link.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { editionLogo, logoInScriptJson } from '#lib/core/data/script-logo.ts';
	import { editionScript } from '#lib/core/data/index.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import {
		MAX_SCRIPT_VOTE_OPTIONS,
		MIN_SCRIPT_VOTE_OPTIONS,
		SCRIPT_VOTE_KINDS,
		SCRIPT_VOTE_MINUTES,
		type ScriptVoteCharacter,
		type ScriptVoteKind,
		type ScriptVoteOption,
		type StoredVoteSubject
	} from '#lib/core/sync/script-vote.ts';
	import {
		choiceId,
		choiceLabel,
		isRulesOnly,
		parseChoiceId,
		type VoteChoice
	} from '#lib/core/sync/vote-choice.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { readEntries } from '#lib/features/scripts/botcscripts-api.ts';
	import type { ScriptChoiceOption } from '#lib/features/modes/script-choices.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import AddRow from '#lib/ui/primitives/AddRow.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import { roomHost } from './host.svelte.ts';
	import VoteStats from './VoteStats.svelte';
	import VoteChoiceDialog from './VoteChoiceDialog.svelte';
	import VoteTimeLeft from './VoteTimeLeft.svelte';
	import type { VotePick } from './vote-pick.ts';

	/**
	 * The room's vote on the next script (Trevor, 2026-10-20, plan R1): the Storyteller offers
	 * scripts, players vote on their phones, and the Storyteller picks from the count. Its own
	 * screen, /vote, reached from New game (Trevor, 2026-10-26), or a sheet over the board once
	 * the game is over (Trevor, 2026-11-01); the room only counts. Scripts are found with New game's own script controls
	 * (Trevor, 2026-10-23: "same search controls as available outside in new game mode") and
	 * added in rows, any number up to MAX_SCRIPT_VOTE_OPTIONS (Trevor, 2026-10-23: "should not
	 * be limited to 2 or 3"). The same vote can be on the game mode, from New game's own list
	 * of modes (Trevor, 2026-10-23), or on the special rules (Trevor, 2026-10-26: "Voting
	 * should allow selecting game modes vs scripts, along with special rules"). Special rules
	 * stack, so the Storyteller keeps any number of them from the count. While the vote is open the screen shows the
	 * room's code and QR, so players not in the room yet can join and vote (Trevor,
	 * 2026-10-23), and the time left when the Storyteller set a limit. Trevor, 2026-10-26: the
	 * Storyteller can let players see the count, before or during the vote, and end it early
	 * with a final call on every phone; each script carries its characters, so players can
	 * read its details; a ranking is counted as an instant runoff. Trevor, 2026-11-03 (plan
	 * M33, mockup B): each thing on the ballot is a choice of a script, a game mode and special
	 * rules, each optional, so "TB +1 vs a custom vs Sushi buffet" is one vote; "+ New choice"
	 * opens a dialog for it and a row's pencil reopens it.
	 */
	interface Props {
		/** The scripts New game offers, by its own ids. */
		choices: ScriptChoiceOption[];
		/** The game modes New game offers, Standard first. */
		modes: { value: string; label: string }[];
		/** The special rules New game offers, built-in first. */
		rules: { value: string; label: string }[];
		/** The Storyteller played this from the count. */
		onPlay: (pick: VotePick) => void;
		/** Back to New game without the vote. */
		onBack: () => void;
		/**
		 * In a sheet over the board whose X closes it (Trevor, 2026-11-01): no Back before a
		 * vote opens; Cancel vote still closes an open one.
		 */
		hideBack?: boolean;
	}

	let { choices, modes, rules, onPlay, onBack, hideBack = false }: Props = $props();

	const TITLES = {
		script: 'room.scriptVote.title',
		mode: 'room.scriptVote.modeTitle',
		rules: 'room.scriptVote.rulesTitle',
		game: 'room.scriptVote.gameTitle'
	} as const;

	const host = roomHost();
	// The base three's characters, for their details on the ballot.
	$effect(() => {
		void loadOfficialData();
	});
	const tally = $derived(host.scriptVote);
	let picked = $state<VoteChoice[]>([]);
	let kind = $state<ScriptVoteKind>('single');

	/** A choice's name on the ballot, from its parts' names. */
	function labelOf(choice: VoteChoice): string {
		return choiceLabel({
			script:
				choice.script && (choices.find((c) => c.value === choice.script)?.label ?? choice.script),
			mode: choice.mode && modes.find((m) => m.value === choice.mode)?.label,
			rules: choice.rules.map((id) => rules.find((r) => r.value === id)?.label ?? id)
		});
	}

	/** The choice dialog: open on a choice's place, or on the next one for "+ New choice". */
	let editing = $state(false);
	let editAt = $state(0);
	function edit(at: number) {
		editAt = at;
		editing = true;
	}
	function save(choice: VoteChoice) {
		picked = editAt < picked.length ? picked.with(editAt, choice) : [...picked, choice];
	}
	const taken = $derived(picked.filter((_, i) => i !== editAt).map(choiceId));

	/**
	 * What the room says the vote is on, for the phones' title: one kind when every choice is
	 * only that (a rules-only vote keeps its keep switches), else the next game.
	 */
	function subjectOf(list: VoteChoice[]): StoredVoteSubject | undefined {
		if (list.every(isRulesOnly)) return 'rules';
		if (list.every((c) => c.script && !c.mode && !c.rules.length)) return undefined;
		if (list.every((c) => c.mode && !c.script && !c.rules.length)) return 'mode';
		return 'game';
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
	const link = $derived(host.code ? roomJoinLink(host.code) : undefined);
	const kinds = SCRIPT_VOTE_KINDS.map((value) => ({
		value,
		label: t(`room.scriptVote.kind.${value}`)
	}));
	const ready = $derived(
		picked.length >= MIN_SCRIPT_VOTE_OPTIONS && picked.length <= MAX_SCRIPT_VOTE_OPTIONS
	);
	const full = $derived(picked.length >= MAX_SCRIPT_VOTE_OPTIONS);

	function openVote() {
		const options = picked.map((choice) => {
			const id = choiceId(choice);
			const name = labelOf(choice);
			const script = choice.script && choices.find((c) => c.value === choice.script);
			if (!script) return { id, name };
			// The script's author, logo and characters, for its details on the ballot.
			const logo = editionLogo(script.value) ?? logoInScriptJson(script.json);
			const edition = editionOf(script);
			const author = script.author ?? edition?.meta?.author;
			const characters = script.json
				? readEntries(script.json)
				: (edition?.characters.map((c): ScriptVoteCharacter => ({ id: c.id })) ?? []);
			return {
				id,
				name,
				...(author ? { author } : {}),
				...(logo ? { logo } : {}),
				...(characters.length ? { characters } : {})
			};
		});
		const limit = minutes === NO_LIMIT ? undefined : Number(minutes);
		const subject = subjectOf(picked) ?? 'script';
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

	/**
	 * Back to New game when the Storyteller decides not to use the vote (Trevor, 2026-10-26); an
	 * open vote is closed first, so it leaves the phones too.
	 */
	function back() {
		if (tally) host.closeScriptVote();
		onBack();
	}

	/**
	 * The choice an option stands for. A vote opened before mixed choices kept a bare script or
	 * mode id, or a rule id.
	 */
	function choiceOf(id: string): VoteChoice {
		const choice = parseChoiceId(id);
		if (choice) return choice;
		if (tally?.subject === 'mode') return { mode: id, rules: [] };
		if (tally?.subject === 'rules') return { rules: [id] };
		return { script: id, rules: [] };
	}

	function pick(id: string) {
		const choice = choiceOf(id);
		host.closeScriptVote();
		onPlay({ subject: 'choice', ...choice });
	}

	const onRules = $derived(tally?.subject === 'rules');
	/**
	 * The rules the count favours, kept to start with once the vote ends: a ranking's winner,
	 * or every rule with the most votes.
	 */
	const leaders = $derived.by(() => {
		if (!tally) return [];
		if (tally.kind === 'ranked') return tally.winner ? [tally.winner] : [];
		const most = Math.max(0, ...Object.values(tally.points));
		return most ? tally.options.filter((o) => tally.points[o.id] === most).map((o) => o.id) : [];
	});
	/** The Storyteller's own choice of rules to keep, for the vote it was made on. */
	let kept = $state<{ voteId: string; ids: string[] }>();
	const keeping = $derived(kept && kept.voteId === tally?.voteId ? kept.ids : leaders);
	function keep(id: string, on: boolean) {
		if (!tally) return;
		const ids = on ? [...keeping, id] : keeping.filter((k) => k !== id);
		kept = {
			voteId: tally.voteId,
			ids: tally.options.map((o) => o.id).filter((o) => ids.includes(o))
		};
	}
	/** Every rule of each rules-only choice kept, each once, in the ballot's order. */
	function playRules() {
		const ids = [...new Set(keeping.flatMap((id) => choiceOf(id).rules))];
		host.closeScriptVote();
		onPlay({ subject: 'rules', ids });
	}
</script>

{#snippet play(option: ScriptVoteOption)}
	<Button onclick={() => pick(option.id)}>{t('room.scriptVote.play')}</Button>
{/snippet}

{#snippet keepRule(option: ScriptVoteOption)}
	<!-- Rules stack (Trevor, 2026-10-18), so each is kept or not, then played together. -->
	<Toggle
		hideLabel
		label={t('room.scriptVote.keepRule', { name: option.name })}
		checked={keeping.includes(option.id)}
		onChange={(on) => keep(option.id, on)}
	/>
{/snippet}

<!-- Its own screen, so it only goes away when the Storyteller leaves it (Trevor, 2026-10-26:
     "As the one running the vote, it goes away really easily"). -->
<div class="screen">
	<h2>
		{t(TITLES[tally ? (tally.subject ?? 'script') : 'game'])}
	</h2>
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
					<!-- The same count players see (Trevor, 2026-10-26), with Play on each row only once
					     the vote has ended (Trevor, 2026-10-26: "should not be able to play a script
					     until they close a vote"). -->
					<div data-testid="script-vote-results">
						<VoteStats
							kind={tally.kind}
							options={tally.options}
							{tally}
							action={ended ? (onRules ? keepRule : play) : undefined}
						/>
					</div>
				{:else}
					<!-- Each choice in a row, its pencil reopening the choice dialog, then a dashed
					     "+ New choice" (Trevor, 2026-11-03, mockup B). -->
					<fieldset class="slots">
						<legend>{t('room.scriptVote.choices')}</legend>
						<ol data-testid="script-vote-slots">
							{#each picked as choice, i (choiceId(choice))}
								{@const name = labelOf(choice)}
								<li>
									<span class="slot">{i + 1}</span>
									<span class="name">{name}</span>
									<span class="tools">
										<IconButton
											icon="edit"
											label={t('room.scriptVote.editChoice', { name })}
											aria-haspopup="dialog"
											onclick={() => edit(i)}
										/>
										<DeleteButton
											label={t('room.scriptVote.remove', { name })}
											onclick={() => (picked = picked.filter((_, j) => j !== i))}
										/>
									</span>
								</li>
							{/each}
						</ol>
						<AddRow
							label={t('room.scriptVote.newChoice')}
							data-testid="vote-new-choice"
							aria-haspopup="dialog"
							disabled={full}
							onclick={() => edit(picked.length)}
						/>
					</fieldset>
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
					<VoteTimeLeft endsAt={tally.endsAt} onEnded={(e) => (ended = e)} />
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
					<Button onclick={back} data-way-back>{t('room.scriptVote.cancel')}</Button>
				{:else if !hideBack}
					<Button onclick={back} data-way-back>{t('room.scriptVote.back')}</Button>
				{/if}
				{#if tally && !ended}
					<!-- One button (Trevor, 2026-10-26: "duplicative end vote and close vote"): End
					     vote closes it at once (2026-10-30), then it is New vote. -->
					<Button onclick={() => host.endScriptVote()}>{t('room.scriptVote.end')}</Button>
				{:else if tally}
					<Button onclick={() => host.closeScriptVote()}>{t('room.scriptVote.new')}</Button>
					{#if onRules}
						<Button variant="accent" onclick={playRules}>{t('room.scriptVote.playRules')}</Button>
					{/if}
				{:else}
					<Button type="submit" variant="accent" disabled={!ready || !host.code}
						>{t('room.scriptVote.open')}</Button
					>
				{/if}
			</div>
		</form>
	</div>
</div>

<VoteChoiceDialog
	bind:open={editing}
	number={editAt + 1}
	choice={picked[editAt]}
	scripts={choices}
	{modes}
	{rules}
	{taken}
	onSave={save}
/>

<style>
	.screen {
		display: grid;
		gap: var(--space-3);
	}
	h2 {
		margin: 0;
	}
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
		display: grid;
		gap: var(--space-2);
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
	.tools {
		display: flex;
		gap: var(--space-1);
	}
</style>
