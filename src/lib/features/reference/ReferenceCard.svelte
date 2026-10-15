<script lang="ts">
	import { buildInfo } from '#lib/build-info.ts';
	import { characterIcons, ICONS_PATH, type Special } from '#lib/core/data/index.ts';
	import type { ReferenceEntry, ReferenceNight } from '#lib/core/rules/reference.ts';
	import { characterReportUrl } from '#lib/features/about/report-issue.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { EDITION_LABELS, TYPE_LABELS } from './labels.ts';
	import NightText from './NightText.svelte';
	import ReminderSentence from './ReminderSentence.svelte';

	interface Props {
		entry: ReferenceEntry;
		/** Opens the shared details overlay (e.g. why there are no pre-day reminders). */
		onExplain: (title: string, text: string) => void;
	}

	let { entry, onExplain }: Props = $props();

	const character = $derived(entry.character);
	// Small thumbnails of the other icon variants (the token shows the default one).
	const variants = $derived.by(() => {
		const set = characterIcons(character);
		if (!set) return [];
		return (
			[
				['Good icon', set.good],
				['Evil icon', set.evil]
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

{#snippet night(label: string, testid: string, info: ReferenceNight)}
	<dt>{label}</dt>
	<dd class="pos" data-testid="{testid}-position">
		{#if info.position !== undefined}#{info.position}{:else}–{/if}{#if info.number !== undefined}<small
				title="Provisional number">{info.number}</small
			>{/if}
	</dd>
	<dd class="st" data-testid={testid}>
		{#if info.text}<NightText text={info.text} {character} />{:else}None{/if}
	</dd>
{/snippet}

<article class="card" id={character.id} data-testid="reference-card" data-character={character.id}>
	<header>
		<CharacterToken {character} size={56} />
		<div class="title">
			<h3>{character.name}</h3>
			<p class="meta">
				{TYPE_LABELS[character.type]} · {character.edition
					? (EDITION_LABELS[character.edition] ?? character.edition)
					: 'None'}
			</p>
		</div>
		<span class="variants">
			{#each variants as v (v.label)}
				<img src={v.src} alt={v.label} title={v.label} width="28" height="28" loading="lazy" />
			{/each}
		</span>
	</header>

	<p class="facts">
		<span><b>Starting alignment</b> {entry.alignmentNote}</span>
		<span
			><b>Setup</b>
			{#if entry.setup}{character.name}: {entry.setup.summary}{:else}None{/if}</span
		>
	</p>
	{#if entry.setup?.notes.length}
		<p class="small">{entry.setup.notes.join(' ')}</p>
	{/if}

	<p class="ability">{character.ability}</p>

	<div class="row">
		<b>Tokens</b>
		{#if character.reminders.length || character.remindersGlobal.length}
			<span class="chips">
				{#each character.reminders as token, i (i)}<ReminderToken
						label={token}
						type={character.type}
					/>{/each}
				{#each character.remindersGlobal as token, i (i)}<ReminderToken
						label="{token} (global)"
						type={character.type}
					/>{/each}
			</span>
		{:else}
			<span>None</span>
		{/if}
	</div>
	<div class="row">
		<b>Special</b>
		{#if character.special.length}
			<span class="specials">
				{#each character.special as s, i (i)}<code>{special(s)}</code>{/each}
			</span>
		{:else}
			<span>None</span>
		{/if}
	</div>

	<dl class="nights">
		{@render night('First night', 'night-first', entry.firstNight)}
		{@render night('Other nights', 'night-other', entry.otherNight)}
	</dl>

	<div class="row" class:block={entry.jinxes.length > 0}>
		<b>Jinxes</b>
		{#if entry.jinxes.length}
			<ul class="list">
				{#each entry.jinxes as jinx (jinx.with)}
					<li>
						<CharacterBadge characterId={jinx.with} />
						<span class="small">{jinx.reason}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<span data-testid="no-jinxes">None</span>
		{/if}
	</div>

	<div class="row" class:block={entry.dayReminders.length > 0}>
		<b>Pre-day</b>
		{#if entry.dayReminders.length}
			<ul class="list">
				{#each entry.dayReminders as reminder, i (i)}
					<li>
						<ReminderSentence segments={reminder.segments} type={character.type} />
						<span class="small"
							>{reminder.groupTitle} · when {reminder.when}{#if reminder.autoDetected}
								· guessed from the ability{/if}</span
						>
					</li>
				{/each}
			</ul>
		{:else}
			<span class="none-row" data-testid="no-day">
				None
				{#if entry.noDayReason}
					<IconButton
						icon="info"
						label="Why no pre-day reminders"
						onclick={() =>
							onExplain(
								`${character.name}: no pre-day reminders`,
								`Left out of the pre-day list: ${entry.noDayReason}.`
							)}
					/>
				{/if}
			</span>
		{/if}
	</div>

	{#if entry.problems.length}
		<div class="problems" role="note" aria-label="Possible problems">
			<b><Icon name="warning" /> Possible problems</b>
			<ul>
				{#each entry.problems as problem (problem)}<li>{problem}</li>{/each}
			</ul>
		</div>
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
		position: relative;
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
		min-width: 0;
		/* Off-screen cards skip layout and paint; the size estimate keeps the scrollbar steady. */
		content-visibility: auto;
		contain-intrinsic-size: auto calc(32 * var(--u));
		scroll-margin-top: calc(var(--tap-target) + var(--space-4));
	}
	header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.title {
		flex: 1;
		min-width: 0;
	}
	h3 {
		margin: 0;
		font-size: 1.15rem;
	}
	.meta {
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
	.variants {
		display: flex;
		gap: var(--space-1);
	}
	.variants img {
		width: calc(1.75 * var(--u));
		height: calc(1.75 * var(--u));
		border-radius: 50%;
		background: var(--token-face);
	}
	p {
		margin: 0;
	}
	b,
	dt {
		margin-right: var(--space-1);
		font-weight: 400;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-4);
		font-size: 0.95rem;
	}
	.small {
		font-size: 0.8rem;
		line-height: 1.3;
		color: var(--on-surface-muted);
	}
	.ability {
		line-height: 1.4;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) var(--space-2);
		font-size: 0.95rem;
		min-width: 0;
	}
	.row.block {
		display: grid;
		gap: var(--space-1);
	}
	.chips {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.specials {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0 var(--space-3);
	}
	code {
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}
	.nights {
		display: grid;
		grid-template-columns: auto auto 1fr;
		gap: var(--space-1) var(--space-2);
		align-items: baseline;
		margin: 0;
		font-size: 0.95rem;
	}
	dd {
		margin: 0;
		min-width: 0;
	}
	.pos {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		color: var(--heading);
	}
	.pos small {
		margin-left: var(--space-1);
		font-size: 0.7rem;
		color: var(--on-surface-muted);
	}
	.list {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.list li {
		display: grid;
		gap: 0;
		justify-items: start;
	}
	.none-row {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin-block: calc(var(--space-2) * -1);
	}
	.none-row :global(.icon-button) {
		color: var(--on-surface-muted);
	}
	.problems {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		box-shadow: inset 0 0 0 1px var(--accent);
		font-size: 0.85rem;
		--icon-size: calc(1 * var(--u));
	}
	.problems ul {
		margin: var(--space-1) 0 0;
		padding-left: var(--space-4);
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-4);
		font-size: 0.9rem;
	}
	footer a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		--icon-size: calc(1.1 * var(--u));
	}
</style>
