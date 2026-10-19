<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { trueCharacter, type SeatId } from '#lib/core/model/index.ts';
	import type {
		AnswerValue,
		Impairment,
		InfoPicker,
		NightAnswer,
		NightStep,
		Reliability,
		ValidInfo,
		Why
	} from '#lib/core/rules/index.ts';
	import { validInformation } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
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
	const names = (seats: readonly SeatId[]) => seats.map(name).join(', ');

	/** "poisoned", or the Preacher's reminder "No Ability" (TPI). */
	const reason = (i: Impairment) => (i.reason === 'no-ability' ? 'No Ability' : i.reason);

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
	 * Why an answer may not be the truth: impaired, the Vortox, registration. Impairments and
	 * allowed values are drawn after the text, so their characters show as badges.
	 */
	interface Flag {
		text: string;
		/** Players named after the text, each with their character. */
		seats?: readonly SeatId[];
		impairments?: readonly Impairment[];
		allowed?: readonly AnswerValue[];
	}
	function flags(r: Reliability & { possible?: AnswerValue[] }): Flag[] {
		const out: Flag[] = [];
		if (r.unreliable) out.push({ text: 'Not reliable:', impairments: r.impairments });
		if (r.mustBeFalse) out.push({ text: 'Vortox: must be false' });
		if (r.misregister.length > 0)
			out.push({ text: 'Might register falsely:', seats: r.misregister });
		if (r.possible && r.possible.length > 1) out.push({ text: 'Allowed:', allowed: r.possible });
		return out;
	}

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
	const validCount = $derived(numberPickers.reduce((n, p) => n + valid(p).length, 0));

	/**
	 * The logic behind a suggestion (Trevor, 2026-10-17: "show the logic"): the players it is
	 * worked out from and what it becomes if one registers otherwise. In a dialog, so the
	 * step never grows under the Storyteller's finger.
	 */
	let whyOpen = $state(false);
	let whyShown = $state.raw<{ why: Why; flags: Flag[] }>();
	const hasWhy = (why: Why | undefined) =>
		!!why && (why.facts.length > 0 || why.alternatives.length > 0);
	function openWhy(why: Why, r: Reliability & { possible?: AnswerValue[] }) {
		whyShown = { why, flags: flags(r) };
		whyOpen = true;
	}
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

	const showAnswers = $derived(assistance.nightAnswers);
	const showPickers = $derived(assistance.infoSuggestions);
	const has = $derived(
		(info?.kind === 'answer' && showAnswers && info.answers.length > 0) ||
			(info?.kind === 'picker' && showPickers && numberPickers.length > 0) ||
			(info?.kind === 'death' &&
				showAnswers &&
				info.checks.some((c) => c.verdict && c.verdict.kind !== 'choose'))
	);

	/** The strip's one line: the first answer, or how many are valid; a character as a badge. */
	const line = $derived.by((): { characterId?: CharacterId; text: string } => {
		if (!info || !has) return { text: '' };
		if (info.kind === 'answer') {
			const a = info.answers[0];
			const note = a.unreliable ? ' (not reliable)' : '';
			return a.kind === 'character'
				? { characterId: a.value, text: note }
				: { text: `${valueText(a)}${note}` };
		}
		// A count, never one answer: the full list is in the step (Trevor, 2026-10-18).
		if (info.kind === 'picker') return { text: `${validCount} valid` };
		const v = info.checks.find((c) => c.verdict && c.verdict.kind !== 'choose')?.verdict;
		if (v?.kind === 'dies') return { text: `Dead: ${names(v.seatIds)}` };
		if (v?.kind === 'ask') return { text: `Dead? ${names(v.ifYes)}` };
		return { text: v?.kind === 'no-death' ? 'No death' : '' };
	});
</script>

<!-- A player as their name pill and their character's badge (Trevor, 2026-10-17). -->
{#snippet player(
	seatId: SeatId,
	characterId: CharacterId | undefined = trueCharacter(game, seatId, characters)
)}<span class="player"
		><span class="pill">{name(seatId)}</span>{#if characterId}<CharacterBadge
				{characterId}
				character={characters.get(characterId)}
				inline
			/>{/if}</span
	>{/snippet}

{#snippet players(seats: readonly SeatId[])}{#each seats as seatId, n (seatId)}{n
			? ', '
			: ''}{@render player(seatId)}{/each}{/snippet}

{#snippet value(v: AnswerValue)}{#if v.kind === 'character'}<CharacterBadge
			characterId={v.value}
			character={characters.get(v.value)}
			inline
		/>{:else}{valueText(v)}{/if}{/snippet}

{#snippet flagBody(flag: Flag)}{flag.text}{#each flag.seats ?? [] as seatId, n (seatId)}{n
			? ', '
			: ' '}{@render player(seatId)}{/each}{#each flag.impairments ?? [] as i, n (n)}{n
			? '; '
			: ' '}{reason(i)} · {#if i.source.seatId}{@render player(
				i.source.seatId,
				i.source.characterId
			)}{:else}<CharacterBadge
				characterId={i.source.characterId}
				character={characters.get(i.source.characterId)}
				inline
			/>{/if}{/each}{#each flag.allowed ?? [] as v, n (n)}{n ? ' / ' : ' '}{@render value(
			v
		)}{/each}{/snippet}

{#snippet answer(a: NightAnswer)}
	<li data-unreliable={a.unreliable ? '' : undefined}>
		<span class="main">
			{#if info && info.kind === 'answer' && info.answers.length > 1}<span class="whose"
					>{@render player(a.seatId)}:</span
				>{/if}
			{#if a.kind === 'character'}
				<CharacterBadge characterId={a.value} character={characters.get(a.value)} inline />
			{:else}
				<strong>{valueText(a)}</strong>
			{/if}
			{#if a.because.length > 0}<span class="because">({@render players(a.because)})</span>{/if}
		</span>
		{#each flags(a) as flag (flag.text)}
			<span class="flag" class:warn={a.unreliable || a.mustBeFalse}>
				{#if a.unreliable}<Icon name="warning" />{/if}{@render flagBody(flag)}
			</span>
		{/each}
		{#if hasWhy(a.why)}
			<Button variant="quiet" onclick={() => openWhy(a.why, a)}>Why</Button>
		{/if}
		{#if a.kind === 'character' && onShow}
			{@const id = a.value}
			<Button variant="quiet" onclick={() => onShow(id)}>Show to player</Button>
		{:else if a.kind === 'number' && onShowNumber}
			{@const n = a.value}
			<Button variant="quiet" onclick={() => onShowNumber(n)}>Show to player</Button>
		{/if}
	</li>
{/snippet}

{#if compact}
	{#if has}<span class="compact" data-testid="night-suggested"
			>Valid Information: {#if line.characterId}<CharacterBadge
					characterId={line.characterId}
					character={characters.get(line.characterId)}
					inline
					interactive={false}
				/>{/if}{line.text}</span
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
												inline
											/>{/each}
										{#if v.target}<span class="pill">{name(v.target)}</span>
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
						{#each flags(p) as flag (flag.text)}
							<span class="flag" class:warn={p.unreliable || p.mustBeFalse}>
								{#if p.unreliable}<Icon name="warning" />{/if}{@render flagBody(flag)}
							</span>
						{/each}
						{#if hasWhy(p.why)}
							<Button variant="quiet" onclick={() => openWhy(p.why, p)}>Why</Button>
						{/if}
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

<Dialog bind:open={whyOpen} title="Why">
	{#if whyShown}
		<h3 class="why-head">From</h3>
		{#if whyShown.why.facts.length === 0}
			<p class="none">None</p>
		{:else}
			<ul class="why" data-testid="why-facts">
				{#each whyShown.why.facts as f (f.seatId)}
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
									inline
								/>
								{f.guess.correct ? 'Right' : 'Wrong'}</span
							>{/if}
					</li>
				{/each}
			</ul>
		{/if}
		<h3 class="why-head">If someone registers otherwise</h3>
		{#if whyShown.why.alternatives.length === 0}
			<p class="none">None</p>
		{:else}
			<ul class="why" data-testid="why-alternatives">
				{#each whyShown.why.alternatives as alt (alt.seatId)}
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
		{#if whyShown.flags.length > 0}
			<h3 class="why-head">Reliability</h3>
			<ul class="why">
				{#each whyShown.flags as flag (flag.text)}<li>{@render flagBody(flag)}</li>{/each}
			</ul>
		{/if}
	{/if}
</Dialog>

<style>
	.why {
		gap: var(--space-1);
	}
	.why-head {
		margin-top: var(--space-2);
	}
	.player {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	/* The same neutral pill as the name under a seat. */
	.pill {
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface);
		font-family: var(--font-player);
		font-weight: 600;
	}
	.fact {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--on-surface-muted);
	}
	.none {
		margin: 0;
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
	li[data-unreliable] .main {
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
	.compact {
		display: block;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 0.85rem;
	}
</style>
