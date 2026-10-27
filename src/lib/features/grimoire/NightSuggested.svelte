<script lang="ts">
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { trueCharacter, type SeatId } from '#lib/core/model/index.ts';
	import type {
		AnswerOption,
		AnswerValue,
		ChosenPlayers,
		ChosenPlayersRow,
		InfoPicker,
		LearnedRole,
		LearnedRoles,
		NightAnswer,
		NightStep,
		Reliability,
		ValidInfo,
		Why
	} from '#lib/core/rules/index.ts';
	import {
		answerOptions,
		chosenPlayers,
		learnedRoles,
		validInformation
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatName } from './night-steps.ts';

	/**
	 * What the game says for a night step (Trevor, 2026-10-16), from core's `withNightInfo`:
	 * the answer the grimoire gives (the Undertaker's executed character), the truthful
	 * options for an info picker, or who dies. Suggestions only: nothing is applied, and an
	 * answer the player's ability can't be trusted for is marked. Values and names only, no
	 * new rules wording.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
		/** One line, for the walk-through strip. */
		compact?: boolean;
		/** Show a character to the player. */
		onShow?: (characterId: CharacterId) => void;
		/** Show the "Your number is" info token with a suggested number (a number step). */
		onShowNumber?: (n: number) => void;
	}

	let { grimoire, step, compact = false, onShow, onShowNumber }: Props = $props();
	const headingId = $props.id();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const assistance = $derived(preferences.current.assistance);
	const info = $derived(step.info);
	const name = (seatId: SeatId) => seatName(game, seatId);

	function valueText(v: AnswerValue): string {
		switch (v.kind) {
			case 'yes-no':
				return v.value ? 'Yes' : 'No';
			case 'character':
				// Drawn as a badge (the value snippet); only its id here.
				return v.value;
			case 'number':
				return String(v.value);
			case 'none':
				return v.reason;
		}
	}

	/**
	 * Why an answer may not be the truth: the Vortox, registration. Allowed values are drawn
	 * after the text, so their characters show as badges. Who made the player drunk or
	 * poisoned is the step's Afflictions, not repeated here (Trevor, 2026-10-27).
	 */
	interface Flag {
		text: string;
		/** A rule that changes what may be given (the Vortox), drawn as a warning. */
		warn?: boolean;
		/** Players named after the text, each with their character. */
		seats?: readonly SeatId[];
		allowed?: readonly AnswerValue[];
	}
	function flags(r: Reliability & { possible?: AnswerValue[] }, listed = false): Flag[] {
		const out: Flag[] = [];
		// A listed answer's rows already say which values the Vortox allows.
		if (r.mustBeFalse && !listed) out.push({ text: 'Vortox: must be false', warn: true });
		if (r.misregister.length > 0)
			out.push({ text: 'Might register falsely:', seats: r.misregister });
		if (r.possible && r.possible.length > 1 && !listed)
			out.push({ text: 'Allowed:', allowed: r.possible });
		return out;
	}

	/**
	 * Every answer that may be given while the player is drunk, poisoned or under the Vortox
	 * (Trevor, 2026-10-27: "when poisoned, need to offer alternative information"), from
	 * core's `answerOptions`; empty while only the truth may be given.
	 */
	const options = (a: NightAnswer): AnswerOption[] => answerOptions(game, a, characters);

	/**
	 * Every valid piece of information, never one pick (Trevor, 2026-10-18: "show all valid
	 * information"), from core's `validInformation`.
	 */
	const valid = (p: InfoPicker): ValidInfo[] => validInformation(game, p);
	/**
	 * Only number information is suggested (Trevor, 2026-10-18: "only show info suggest for
	 * numbers, not sets of characters"); players and characters are left to the Storyteller.
	 */
	const numberPickers = $derived(
		info?.kind === 'picker'
			? info.pickers.filter((p) => valid(p).some((v) => v.number !== undefined))
			: []
	);
	/**
	 * The valid numbers themselves, in brackets (Trevor, 2026-10-22: "1 valid" read as if 1
	 * were the number to give; the closed step should be enough to run the night).
	 */
	const validLists = $derived(
		numberPickers.map((p) => {
			const options = valid(p).map((v) => (v.number === undefined ? 'Any other' : v.number));
			return {
				seatId: numberPickers.length > 1 ? p.seatId : undefined,
				list: `(${options.join(', ')})`
			};
		})
	);

	/**
	 * The logic behind a suggestion (Trevor, 2026-10-17: "show the logic"): the players it is
	 * worked out from and what it becomes if one registers otherwise. Beside the information
	 * in the opened step, with no Why button to press (Trevor, 2026-10-22).
	 */
	const hasWhy = (why: Why | undefined): why is Why =>
		!!why && (why.facts.length > 0 || why.alternatives.length > 0);
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

	/**
	 * The roles a "learn a role" step could show (Trevor, 2026-10-25: the Investigator's
	 * Minion), from core's `learnedRoles`: the row the board's reminders mark first, then true
	 * ones, then each player who may register as the type, whose character is picked here.
	 */
	const rolePickers = $derived(
		info?.kind === 'picker'
			? info.pickers.flatMap((picker) => {
					const roles = learnedRoles(game, picker, characters);
					return roles && (roles.rows.length > 0 || roles.none || roles.anyOther)
						? [{ picker, roles }]
						: [];
				})
			: []
	);
	const rowKey = (p: InfoPicker, row: LearnedRole) =>
		JSON.stringify([p.seatId, row.target, row.reason, row.marked ?? false]);
	/** The character picked for a row that offers several (a Recluse shown as a Minion). */
	let shownAs = $state<Record<string, CharacterId>>({});
	const shownRole = (p: InfoPicker, row: LearnedRole): CharacterId | undefined =>
		row.characterIds.length === 1 ? row.characterIds[0] : shownAs[rowKey(p, row)];
	/**
	 * One badge per character the strip's line names, in row order, the ones the board's
	 * reminders mark emphasised (Trevor, 2026-10-26).
	 */
	const roleIds = (all: readonly { roles: LearnedRoles }[]) => {
		const out: { id: CharacterId; marked: boolean }[] = [];
		for (const { roles } of all) {
			for (const r of roles.rows) {
				const id = r.characterIds[0];
				const seen = out.find((o) => o.id === id);
				if (seen) seen.marked ||= !!r.marked;
				else if (id) out.push({ id, marked: !!r.marked });
			}
		}
		return out;
	};

	/**
	 * The players a "learn players" step could show (Steward, Noble), from core's
	 * `chosenPlayers`: the ones the board's Know reminders mark first (Trevor, 2026-10-26).
	 */
	const playerPickers = $derived(
		info?.kind === 'picker'
			? info.pickers.flatMap((picker) => {
					const players = chosenPlayers(game, picker);
					return players && (players.rows.length > 0 || players.anyOther)
						? [{ picker, players }]
						: [];
				})
			: []
	);
	const playerRowKey = (p: InfoPicker, row: ChosenPlayersRow) =>
		JSON.stringify([p.seatId, row.target, row.seats, row.reason, row.exact ?? false]);
	/** The players the strip's line names: the marked rows' players, else each row's player. */
	const playerSeats = (all: readonly { players: ChosenPlayers }[]) => {
		const out: { seatId: SeatId; marked: boolean }[] = [];
		for (const { players } of all) {
			const marked = players.rows.filter((r) => r.marked);
			for (const r of marked.length > 0 ? marked : players.rows) {
				for (const seatId of r.exact ? [r.target, ...r.seats] : [r.target]) {
					const seen = out.find((o) => o.seatId === seatId);
					if (seen) seen.marked ||= !!r.marked;
					else out.push({ seatId, marked: !!r.marked });
				}
			}
		}
		return out;
	};

	const showAnswers = $derived(assistance.nightAnswers);
	const showPickers = $derived(assistance.infoSuggestions);
	const has = $derived(
		(info?.kind === 'answer' && showAnswers && info.answers.length > 0) ||
			(info?.kind === 'picker' &&
				showPickers &&
				(numberPickers.length > 0 || rolePickers.length > 0 || playerPickers.length > 0)) ||
			(info?.kind === 'death' &&
				showAnswers &&
				info.checks.some((c) => c.verdict && c.verdict.kind !== 'choose'))
	);

	/**
	 * The strip's one line: the first answer, or how many are valid; a character as a badge,
	 * players as their name badges (`seats` after the text, `valid` each before its numbers).
	 */
	const line = $derived.by(
		(): {
			characterId?: CharacterId;
			text: string;
			seats?: readonly SeatId[];
			valid?: typeof validLists;
			roles?: { id: CharacterId; marked: boolean }[];
			players?: { seatId: SeatId; marked: boolean }[];
		} => {
			if (!info || !has) return { text: '' };
			if (info.kind === 'answer') {
				const a = info.answers[0];
				const note = a.unreliable ? ' (not reliable)' : '';
				return a.kind === 'character'
					? { characterId: a.value, text: note }
					: { text: `${valueText(a)}${note}` };
			}
			if (info.kind === 'picker') {
				return {
					text: '',
					...(rolePickers.length > 0 ? { roles: roleIds(rolePickers) } : {}),
					...(playerPickers.length > 0 ? { players: playerSeats(playerPickers) } : {}),
					...(rolePickers.length === 0 && playerPickers.length === 0 ? { valid: validLists } : {})
				};
			}
			const v = info.checks.find((c) => c.verdict && c.verdict.kind !== 'choose')?.verdict;
			if (v?.kind === 'dies') return { text: 'Dead: ', seats: v.seatIds };
			if (v?.kind === 'ask') return { text: 'Dead? ', seats: v.ifYes };
			return { text: v?.kind === 'no-death' ? 'No death' : '' };
		}
	);
</script>

<!-- A player as their name pill and their character's badge (Trevor, 2026-10-17). -->
{#snippet player(
	seatId: SeatId,
	characterId: CharacterId | undefined = trueCharacter(game, seatId, characters)
)}<span class="player"
		><PlayerBadge name={name(seatId)} />{#if characterId}<CharacterBadge
				{characterId}
				character={characters.get(characterId)}
			/>{/if}</span
	>{/snippet}

{#snippet players(seats: readonly SeatId[])}{#each seats as seatId, n (seatId)}{n
			? ', '
			: ''}{@render player(seatId)}{/each}{/snippet}

{#snippet value(v: AnswerValue)}{#if v.kind === 'character'}<CharacterBadge
			characterId={v.value}
			character={characters.get(v.value)}
		/>{:else}{valueText(v)}{/if}{/snippet}

{#snippet flagBody(flag: Flag)}{flag.text}{#each flag.seats ?? [] as seatId, n (seatId)}{n
			? ', '
			: ' '}{@render player(seatId)}{/each}{#each flag.allowed ?? [] as v, n (n)}{n
			? ' / '
			: ' '}{@render value(v)}{/each}{/snippet}

{#snippet flagLines(list: Flag[])}{#each list as flag (flag.text)}
		<span class="flag" class:warn={flag.warn}>
			{#if flag.warn}<Icon name="warning" />{/if}{@render flagBody(flag)}
		</span>
	{/each}{/snippet}

{#snippet answer(a: NightAnswer)}
	{@const listed = options(a)}
	<li data-unreliable={a.unreliable && listed.length === 0 ? '' : undefined}>
		{#if listed.length > 0}
			{#if info && info.kind === 'answer' && info.answers.length > 1}<span class="whose"
					>{@render player(a.seatId)}:</span
				>{/if}
			<ul class="valid" aria-label="Valid information" data-testid="answer-options">
				{#each listed as o, i (i)}{@render answerRow(a, o, i)}{/each}
			</ul>
			{@render flagLines(flags(a, true))}
			{#if hasWhy(a.why)}{@render whyBlock(a.why)}{/if}
		{:else}
			{@render answerOnly(a)}
		{/if}
	</li>
{/snippet}

<!-- One answer that may be given, with Show to player for a number or a character. -->
{#snippet answerRow(a: NightAnswer, o: AnswerOption, i: number)}
	{@const key = `${a.seatId}:other`}
	{@const id = o.otherCharacters
		? shownAs[key]
		: o.value.kind === 'character'
			? o.value.value
			: undefined}
	<li data-reason={o.reason}>
		<span class="main option">
			{#if o.otherCharacters}
				<strong>Any other</strong>
				<Select
					label="Shown as"
					hideLabel
					placeholder="Shown as"
					value={id}
					options={o.otherCharacters.map((c) => ({
						value: c,
						// eslint-disable-next-line grim/names-as-badges -- the option's accessible name and typeahead text; it shows as the badge (the item snippet)
						label: characters.get(c)?.name ?? c
					}))}
					onChange={(c) => (shownAs = { ...shownAs, [key]: c })}
				>
					{#snippet item(option)}<CharacterBadge
							characterId={option.value}
							character={characters.get(option.value)}
							interactive={false}
						/>{/snippet}
					{#snippet selected(option)}<CharacterBadge
							characterId={option.value}
							character={characters.get(option.value)}
							interactive={false}
						/>{/snippet}
				</Select>
			{:else if o.value.kind === 'character'}
				<CharacterBadge characterId={o.value.value} character={characters.get(o.value.value)} />
			{:else}
				<strong>{valueText(o.value)}</strong>
			{/if}
			{#if i === 0 && a.because.length > 0}<span class="because"
					>({@render players(a.because)})</span
				>{/if}
		</span>
		{@render reasonTag(o.reason)}
		{#if o.value.kind === 'number' && onShowNumber}
			{@const n = o.value.value}
			<Button variant="quiet" onclick={() => onShowNumber(n)}>Show to player</Button>
		{:else if o.value.kind === 'character' && onShow}
			<Button variant="quiet" disabled={!id} onclick={() => id && onShow(id)}>Show to player</Button
			>
		{/if}
	</li>
{/snippet}

{#snippet answerOnly(a: NightAnswer)}
	<span class="main">
		{#if info && info.kind === 'answer' && info.answers.length > 1}<span class="whose"
				>{@render player(a.seatId)}:</span
			>{/if}
		{#if a.kind === 'character'}
			<CharacterBadge characterId={a.value} character={characters.get(a.value)} />
		{:else}
			<strong>{valueText(a)}</strong>
		{/if}
		{#if a.because.length > 0}<span class="because">({@render players(a.because)})</span>{/if}
	</span>
	{@render flagLines(flags(a))}
	{#if hasWhy(a.why)}{@render whyBlock(a.why)}{/if}
	{#if a.kind === 'character' && onShow}
		{@const id = a.value}
		<Button variant="quiet" onclick={() => onShow(id)}>Show to player</Button>
	{:else if a.kind === 'number' && onShowNumber}
		{@const n = a.value}
		<Button variant="quiet" onclick={() => onShowNumber(n)}>Show to player</Button>
	{/if}
{/snippet}

{#if compact}
	{#if has}<span class="compact" data-testid="night-suggested"
			>Valid Information: {#if line.characterId}<CharacterBadge
					characterId={line.characterId}
					character={characters.get(line.characterId)}
					interactive={false}
				/>{/if}{line.text}{#each line.seats ?? [] as seatId, n (seatId)}{n ? ', ' : ''}<PlayerBadge
					name={name(seatId)}
				/>{/each}{#each line.valid ?? [] as v, n (n)}{n ? ', ' : ''}{#if v.seatId}<PlayerBadge
						name={name(v.seatId)}
					/>
				{/if}{v.list}{/each}{#each line.roles ?? [] as { id, marked }, n (id)}{n ? ', ' : ''}<span
					class="item"
					class:marked
					>{#if marked}<Icon name="reminder" />{/if}<CharacterBadge
						characterId={id}
						character={characters.get(id)}
						interactive={false}
					/></span
				>{/each}{#each line.players ?? [] as { seatId, marked }, n (seatId)}{n ? ', ' : ''}<span
					class="item"
					class:marked
					>{#if marked}<Icon name="reminder" />{/if}<PlayerBadge name={name(seatId)} /></span
				>{/each}</span
		>{/if}
{:else if has && info}
	<!-- A plain section under its heading, like the step's others (Trevor, 2026-10-19). -->
	<section aria-labelledby={headingId} data-testid="night-suggested">
		<h3 id={headingId}>Valid Information</h3>
		<ul>
			{#if info.kind === 'answer'}
				{#each info.answers as a (a.seatId)}{@render answer(a)}{/each}
			{:else if info.kind === 'picker'}
				{#each numberPickers as p (p.seatId)}
					<li data-unreliable={p.unreliable ? '' : undefined}>
						{#if numberPickers.length > 1}<span class="whose">{@render player(p.seatId)}:</span
							>{/if}
						<ul class="valid" aria-label="Valid information">
							{#each valid(p) as v, i (i)}
								<li data-reason={v.reason}>
									<span class="main option">
										{#if v.anyOther}<strong>Any other</strong>{/if}
										{#if v.number !== undefined}<strong>{v.number}</strong>{/if}
										{#if v.none}<strong>None</strong>{:else if v.yes !== undefined}<strong
												>{v.yes ? 'Yes' : 'No'}</strong
											>{/if}
										{#each v.characterIds ?? [] as id, n (id)}{n ? ' / ' : ''}<CharacterBadge
												characterId={id}
												character={characters.get(id)}
											/>{/each}
										{#if v.target}<PlayerBadge name={name(v.target)} />
											{#if v.seats.length > 0}<span class="with">and one of</span>{/if}{/if}
										{@render players(v.seats)}
									</span>
									{#if v.reason === 'registers'}<span class="tag"
											>Registers: {@render players(v.registered ?? [])}</span
										>{:else if v.reason === 'unreliable'}<span class="tag warn"
											><Icon name="warning" />Not reliable</span
										>{:else if v.reason === 'vortox'}<span class="tag warn">Vortox</span>{/if}
									{#if v.number !== undefined && onShowNumber}
										{@const n = v.number}
										<Button variant="quiet" onclick={() => onShowNumber(n)}>Show to player</Button>
									{/if}
								</li>
							{/each}
						</ul>
						{@render flagLines(flags(p))}
						{#if hasWhy(p.why)}{@render whyBlock(p.why)}{/if}
					</li>
				{/each}
				{#each rolePickers as { picker: p, roles } (p.seatId)}
					<li data-unreliable={p.unreliable ? '' : undefined}>
						{#if rolePickers.length > 1}<span class="whose">{@render player(p.seatId)}:</span>{/if}
						<ul class="valid" aria-label="Valid information" data-testid="learned-roles">
							{#each roles.rows as row (rowKey(p, row))}
								{@render roleRow(p, row)}
							{/each}
							{#if roles.none}
								<li data-reason={roles.none}>
									<span class="main option"><strong>None</strong></span>
									{@render reasonTag(roles.none)}
									{#if onShowNumber}
										<Button variant="quiet" onclick={() => onShowNumber(0)}>Show to player</Button>
									{/if}
								</li>
							{/if}
							{#if roles.anyOther}
								<li data-reason={roles.anyOther}>
									<span class="main option"><strong>Any other</strong></span>
									{@render reasonTag(roles.anyOther)}
								</li>
							{/if}
						</ul>
						<!-- Who may register otherwise is in the rows; only why any info is allowed here. -->
						{@render flagLines(flags(p).filter((f) => !f.seats))}
					</li>
				{/each}
				{#each playerPickers as { picker: p, players: choices } (p.seatId)}
					<li data-unreliable={p.unreliable ? '' : undefined}>
						{#if playerPickers.length > 1}<span class="whose">{@render player(p.seatId)}:</span
							>{/if}
						<ul class="valid" aria-label="Valid information" data-testid="chosen-players">
							{#each choices.rows as row (playerRowKey(p, row))}
								<li data-reason={row.reason} data-marked={row.marked ? '' : undefined}>
									<span class="main option">
										{#if row.exact}{@render players([
												row.target,
												...row.seats
											])}{:else}{@render player(row.target)}{#if row.seats.length > 0}<span
													class="with">and two of</span
												>
												{@render players(row.seats)}{/if}{/if}
									</span>
									{#if row.marked}<span class="tag marked"><Icon name="reminder" />Marked</span
										>{/if}
									{@render reasonTag(row.reason, row.registered)}
								</li>
							{/each}
							{#if choices.anyOther}
								<li data-reason={choices.anyOther}>
									<span class="main option"><strong>Any other</strong></span>
									{@render reasonTag(choices.anyOther)}
								</li>
							{/if}
						</ul>
						{@render flagLines(flags(p).filter((f) => !f.seats))}
					</li>
				{/each}
			{:else}
				{#each info.checks as c (c.seatId)}
					{@const v = c.verdict}
					{#if v && v.kind !== 'choose'}
						<li>
							<span class="main"
								>{#if v.kind === 'dies'}<strong>Dead:</strong>
									{@render players(v.seatIds)}{:else if v.kind === 'ask'}<strong>Dead?</strong>
									{@render players(v.ifYes)}{:else}<strong>No death</strong>{/if}</span
							>
						</li>
					{/if}
				{/each}
			{/if}
		</ul>
	</section>
{/if}

{#snippet reasonTag(
	reason: LearnedRole['reason'] | AnswerOption['reason'],
	registered: readonly SeatId[] = []
)}
	{#if reason === 'registers'}<span class="tag"
			>Registers{#if registered.length > 0}: {@render players(registered)}{/if}</span
		>{:else if reason === 'unreliable'}<span class="tag warn"
			><Icon name="warning" />Not reliable</span
		>{:else if reason === 'vortox'}<span class="tag warn">Vortox</span
		>{:else if reason === 'invalid'}<span class="tag warn"><Icon name="warning" />Not valid</span
		>{/if}
{/snippet}

<!--
	One role to show: the character (picked here when several are allowed), the player who is
	it and the second player, and Show to player for the character's token.
-->
{#snippet roleRow(p: InfoPicker, row: LearnedRole)}
	{@const key = rowKey(p, row)}
	{@const id = shownRole(p, row)}
	<li data-reason={row.reason} data-marked={row.marked ? '' : undefined}>
		<span class="main option">
			{#if row.characterIds.length === 1}
				<CharacterBadge
					characterId={row.characterIds[0]}
					character={characters.get(row.characterIds[0])}
				/>
			{:else}
				<Select
					label="Shown as"
					hideLabel
					placeholder="Shown as"
					value={id}
					options={row.characterIds.map((c) => ({
						value: c,
						// eslint-disable-next-line grim/names-as-badges -- the option's accessible name and typeahead text; it shows as the badge (the item snippet)
						label: characters.get(c)?.name ?? c
					}))}
					onChange={(c) => (shownAs = { ...shownAs, [key]: c })}
				>
					{#snippet item(option)}<CharacterBadge
							characterId={option.value}
							character={characters.get(option.value)}
							interactive={false}
						/>{/snippet}
					{#snippet selected(option)}<CharacterBadge
							characterId={option.value}
							character={characters.get(option.value)}
							interactive={false}
						/>{/snippet}
				</Select>
			{/if}
			<PlayerBadge name={name(row.target)} />
			<span class="with">and</span>
			{#if row.other}<PlayerBadge name={name(row.other)} />{:else}<span class="with"
					>any other player</span
				>{/if}
		</span>
		{#if row.marked}<span class="tag marked"><Icon name="reminder" />Marked</span>{/if}
		{@render reasonTag(row.reason, row.registered)}
		{#if onShow}
			<Button variant="quiet" disabled={!id} onclick={() => id && onShow(id)}>Show to player</Button
			>
		{/if}
	</li>
{/snippet}

<!-- Why, beside the information; its reliability is already in the flags above it. -->
{#snippet whyBlock(why: Why)}
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
{/snippet}

<style>
	.why-block {
		display: grid;
		gap: var(--space-1);
		width: 100%;
		font-size: 0.85rem;
	}
	.why {
		gap: var(--space-1);
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
	/* The same heading as the step's Info token and Reminders (GuidedStep). */
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: 1rem;
	}
	ul {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
	}
	.main {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	.whose,
	.because {
		color: var(--on-surface-muted);
	}
	.flag {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		width: 100%;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
		--icon-size: 1em;
	}
	.flag.warn {
		color: var(--evil);
	}
	/* An answer that may not be the truth is greyed, its warning in red. */
	li[data-unreliable] > .main {
		opacity: 0.6;
	}
	/* Every valid row, each with why it is valid when not simply true. */
	.valid {
		width: 100%;
		gap: var(--space-1);
	}
	.valid > li + li {
		padding-top: var(--space-1);
		border-top: 1px solid var(--border);
	}
	.with,
	.tag {
		color: var(--on-surface-muted);
	}
	.tag {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		font-size: 0.85rem;
		--icon-size: 1em;
	}
	.tag.warn {
		color: var(--evil);
	}
	/*
	 * A row the character's reminders on the board mark: the one the Storyteller already
	 * chose, emphasised above the other valid rows (Trevor, 2026-10-26).
	 */
	.valid > li[data-marked] {
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--surface-selected);
	}
	.valid > li[data-marked] + li {
		border-top: none;
	}
	.tag.marked,
	.item.marked {
		color: var(--heading);
		font-weight: 600;
	}
	.item {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		--icon-size: 1em;
	}
	.compact {
		display: block;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 0.85rem;
	}
</style>
