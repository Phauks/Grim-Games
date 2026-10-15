<script lang="ts">
	import { buildInfo } from '#lib/build-info.ts';
	import { characterIcons, ICONS_PATH, type Special } from '#lib/core/data/index.ts';
	import type { ReferenceEntry, ReferenceNight } from '#lib/core/rules/reference.ts';
	import { characterReportUrl } from '#lib/features/about/report-issue.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { EDITION_LABELS, TYPE_LABELS } from './labels.ts';
	import ReminderSentence from './ReminderSentence.svelte';

	interface Props {
		entry: ReferenceEntry;
	}

	let { entry }: Props = $props();

	const character = $derived(entry.character);
	const icons = $derived.by(() => {
		const set = characterIcons(character);
		if (!set) return [];
		return (
			[
				['Good', set.good],
				['Evil', set.evil],
				['Unaligned', set.unaligned]
			] as const
		)
			.filter(([, file]) => file !== undefined)
			.map(([label, file]) => ({ label, src: `${ICONS_PATH}/${file}` }));
	});
	const reportUrl = $derived(characterReportUrl(buildInfo, character, navigator.userAgent));

	function special(s: Special): string {
		return [
			`${s.type}: ${s.name}`,
			s.value !== undefined ? `= ${s.value}` : '',
			s.time ? `· ${s.time}` : '',
			s.global ? `· global ${s.global}` : ''
		]
			.filter(Boolean)
			.join(' ');
	}
</script>

{#snippet night(label: string, info: ReferenceNight)}
	<div class="night" data-testid="night-{label === 'First night' ? 'first' : 'other'}">
		<p class="night-head">
			<Icon name="night" />
			<strong>{label}</strong>
			{#if info.position !== undefined}
				<span class="pos">#{info.position} on TPI’s sheet</span>
			{:else}
				<span class="muted">does not wake</span>
			{/if}
			{#if info.number !== undefined}<span class="num">provisional {info.number}</span>{/if}
		</p>
		{#if info.text}<p class="st-text">{info.text}</p>{/if}
	</div>
{/snippet}

<article class="card" id={character.id} data-testid="reference-card" data-character={character.id}>
	<header>
		<h3 class="visually-hidden">{character.name}</h3>
		<CharacterBadge characterId={character.id} />
		<span class="icons">
			{#each icons as icon (icon.label)}
				<span class="icon-variant">
					<span class="face"
						><img src={icon.src} alt="" width="40" height="40" loading="lazy" /></span
					>
					<span class="caption">{icon.label}</span>
				</span>
			{/each}
		</span>
	</header>

	<dl class="facts">
		<div>
			<dt>Type</dt>
			<dd>{TYPE_LABELS[character.type]}</dd>
		</div>
		<div>
			<dt>Edition</dt>
			<dd>{character.edition ? (EDITION_LABELS[character.edition] ?? character.edition) : '—'}</dd>
		</div>
		<div>
			<dt>Alignment</dt>
			<dd>{entry.alignmentNote}</dd>
		</div>
		<div>
			<dt>Setup</dt>
			<dd>
				{#if entry.setup}
					{character.name}: {entry.setup.summary}{#if entry.setup.source === 'ability-text'}
						(read from the text){/if}
					{#each entry.setup.notes as note (note)}<span class="note">{note}</span>{/each}
				{:else}
					No setup change
				{/if}
				{#if character.setup}<span class="note">TPI setup flag: yes</span>{/if}
			</dd>
		</div>
	</dl>

	<p class="ability">{character.ability}</p>

	<section>
		<h4>Reminder tokens</h4>
		{#if character.reminders.length || character.remindersGlobal.length}
			<ul class="tokens">
				{#each character.reminders as token, i (i)}<li>{token}</li>{/each}
				{#each character.remindersGlobal as token, i (i)}<li class="global">
						{token} <span class="muted">(global)</span>
					</li>{/each}
			</ul>
		{:else}
			<p class="muted">None</p>
		{/if}
		{#if character.special.length}
			<h4>Special</h4>
			<ul class="specials">
				{#each character.special as s, i (i)}<li><code>{special(s)}</code></li>{/each}
			</ul>
		{/if}
	</section>

	<section>
		<h4>Jinxes</h4>
		{#if entry.jinxes.length}
			<ul class="jinxes">
				{#each entry.jinxes as jinx (jinx.with)}
					<li>
						<CharacterBadge characterId={jinx.with} />
						<span
							>{jinx.reason}{#if jinx.exclusive}
								<em class="muted">(only one can be in play)</em>{/if}</span
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted" data-testid="no-jinxes">No jinxes</p>
		{/if}
	</section>

	<section>
		<h4>Night order</h4>
		{@render night('First night', entry.firstNight)}
		{@render night('Other nights', entry.otherNight)}
	</section>

	<section>
		<h4>Pre-day reminders</h4>
		{#if entry.dayReminders.length}
			<ul class="day">
				{#each entry.dayReminders as reminder, i (i)}
					<li>
						<ReminderSentence segments={reminder.segments} />
						<span class="when"
							>{reminder.groupTitle} · when {reminder.when}{#if reminder.autoDetected}
								· guessed from the ability{/if}</span
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">None: {entry.noDayReason ?? 'no reason given'}</p>
		{/if}
	</section>

	{#if entry.problems.length}
		<section class="problems" aria-label="Possible problems">
			<h4><Icon name="warning" /> Possible problems</h4>
			<ul>
				{#each entry.problems as problem (problem)}<li>{problem}</li>{/each}
			</ul>
		</section>
	{/if}

	<footer>
		{#if entry.wiki}
			<!-- External wiki page (the rules authority), not an app route. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={entry.wiki} target="_blank" rel="noopener"><Icon name="wiki" /> Wiki</a>
		{/if}
		<!-- External GitHub issue form; only public build and character info in it. -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={reportUrl} target="_blank" rel="noopener"><Icon name="report" /> Report a problem</a>
	</footer>
</article>

<style>
	.card {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-4);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
		min-width: 0;
		/* Off-screen cards skip layout and paint; the size estimate keeps the scrollbar steady. */
		content-visibility: auto;
		contain-intrinsic-size: auto 40rem;
		scroll-margin-top: calc(var(--tap-target) + var(--space-4));
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.icons {
		display: flex;
		gap: var(--space-2);
	}
	.icon-variant {
		display: grid;
		justify-items: center;
		font-size: 0.75rem;
		color: var(--on-surface-muted);
	}
	.face {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		background: var(--token-face);
		overflow: hidden;
	}
	.face img {
		width: 2.5rem;
		height: 2.5rem;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: var(--space-2) var(--space-4);
		margin: 0;
	}
	.facts div {
		min-width: 0;
	}
	dt {
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
	}
	.note {
		display: block;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	.ability {
		margin: 0;
		font-size: 1.05rem;
		line-height: 1.5;
	}
	section {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
	}
	h4 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		font-family: var(--font-display);
		font-weight: var(--font-display-weight);
		font-size: 0.9rem;
		letter-spacing: 0.04em;
		color: var(--heading);
		--icon-size: 1.1rem;
	}
	p {
		margin: 0;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tokens {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.tokens li {
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-full);
		background: var(--reminder-face);
		color: var(--on-reminder);
		font-size: 0.9rem;
	}
	.tokens .muted {
		color: inherit;
		opacity: 0.8;
	}
	.specials code {
		font-size: 0.85rem;
		overflow-wrap: anywhere;
	}
	.jinxes,
	.day {
		display: grid;
		gap: var(--space-3);
	}
	.jinxes li {
		display: grid;
		gap: var(--space-1);
		justify-items: start;
	}
	.day li {
		display: grid;
		gap: var(--space-1);
	}
	.when {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	.night {
		display: grid;
		gap: var(--space-1);
	}
	.night-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		--icon-size: 1.1rem;
	}
	.pos {
		font-variant-numeric: tabular-nums;
	}
	.num {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	.st-text {
		padding-left: var(--space-3);
		border-left: 2px solid var(--border);
		font-size: 0.95rem;
	}
	.muted {
		color: var(--on-surface-muted);
	}
	.problems {
		padding: var(--space-3);
		border-radius: var(--radius-md);
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	.problems ul {
		display: grid;
		gap: var(--space-1);
		padding-left: var(--space-4);
		list-style: disc;
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
	}
	footer a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		--icon-size: 1.2rem;
	}
</style>
