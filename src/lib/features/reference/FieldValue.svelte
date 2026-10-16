<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { buildInfo } from '#lib/build-info.ts';
	import { characterIcons, ICONS_PATH, type Special } from '#lib/core/data/index.ts';
	import { characterNames } from '#lib/core/rules/character-names.ts';
	import type { ReferenceEntry, ReferenceNight } from '#lib/core/rules/reference.ts';
	import { prepTextSegments, setupPrep } from '#lib/core/rules/setup-reminders.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { characterReportUrl } from '#lib/features/about/report-issue.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { FieldId } from './fields.ts';
	import { EDITION_LABELS, TYPE_LABELS } from './labels.ts';
	import NightText from './NightText.svelte';
	import ReminderSentence from './ReminderSentence.svelte';

	interface Props {
		field: FieldId;
		entry: ReferenceEntry;
		/** Opens the shared details overlay (e.g. why there are no pre-day reminders). */
		onExplain: (title: string, text: string) => void;
		/** Token size in px (fixed, so nothing reflows). */
		tokenSize?: number;
	}

	let { field, entry, onExplain, tokenSize = 56 }: Props = $props();

	const character = $derived(entry.character);
	// Prep steps with [Token] as reminder chips and names as badges (built only for this field).
	const prep = $derived.by(() => {
		if (field !== 'prep') return [];
		const names = characterNames(officialData.current?.characters ?? []);
		return setupPrep(character.id, character.name).map((step) =>
			prepTextSegments(step.text, names)
		);
	});
	const variants = $derived.by(() => {
		const set = characterIcons(character);
		if (!set) return [];
		return (
			[
				[t('reference.iconGood'), set.good],
				[t('reference.iconEvil'), set.evil],
				[t('reference.iconUnaligned'), set.unaligned]
			] as const
		)
			.filter(([, file]) => file !== undefined)
			.map(([label, file]) => ({ label, src: `${ICONS_PATH}/${file}` }));
	});
	const reportUrl = $derived(characterReportUrl(buildInfo, character, navigator.userAgent));
	const tokens = $derived([
		...character.reminders.map((label) => ({ label, global: false })),
		...character.remindersGlobal.map((label) => ({ label, global: true }))
	]);

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

{#snippet nightValue(testid: string, night: 'first' | 'other', info: ReferenceNight)}
	<span class="night" data-testid={testid}>
		<span class="pos" data-testid="{testid}-position" data-position={info.position}
			>{#if info.position !== undefined}#{info.position}{:else}–{/if}{#if info.number !== undefined}<small
					title={t('reference.provisionalNumber')}>{info.number}</small
				>{/if}</span
		>
		<span class="st"
			>{#if info.text}<NightText text={info.text} {character} {night} />{:else}{t(
					'common.none'
				)}{/if}</span
		>
	</span>
{/snippet}

<span class="value" data-field={field}>
	{#if field === 'token'}
		<CharacterToken {character} size={tokenSize} />
	{:else if field === 'name'}
		<!-- The same badge the game uses: icon, type colour and name (Trevor, 2026-10-15). -->
		<CharacterBadge characterId={character.id} />
	{:else if field === 'type'}
		{TYPE_LABELS[character.type]}
	{:else if field === 'edition'}
		{character.edition
			? (EDITION_LABELS[character.edition] ?? character.edition)
			: t('common.none')}
	{:else if field === 'icons'}
		<span class="icons">
			{#each variants as v (v.label)}
				<img src={v.src} alt={v.label} title={v.label} width="28" height="28" loading="lazy" />
			{:else}{t('common.none')}{/each}
		</span>
	{:else if field === 'alignment'}
		{entry.alignmentNote}
	{:else if field === 'setup'}
		{#if entry.setup}<GlossaryText
				text="{character.name}: {entry.setup.summary}"
			/>{#if entry.setup.notes.length}<span class="small block"
					><GlossaryText text={entry.setup.notes.join(' ')} /></span
				>{/if}{:else}{t('common.none')}{/if}
	{:else if field === 'ability'}
		<span class="ability"><GlossaryText text={character.ability} names={[character.name]} /></span>
	{:else if field === 'tokens'}
		<span class="spaced"
			>{#each tokens as token, i (i)}<ReminderToken
					label={token.global ? t('reference.globalReminder', { label: token.label }) : token.label}
					type={character.type}
				/>{:else}{t('common.none')}{/each}</span
		>
	{:else if field === 'special'}
		<span class="spaced"
			>{#each character.special as s, i (i)}<code>{special(s)}</code>{:else}{t(
					'common.none'
				)}{/each}</span
		>
	{:else if field === 'firstNight'}
		{@render nightValue('night-first', 'first', entry.firstNight)}
	{:else if field === 'otherNight'}
		{@render nightValue('night-other', 'other', entry.otherNight)}
	{:else if field === 'jinxes'}
		{#if entry.jinxes.length}
			<ul class="list">
				{#each entry.jinxes as jinx (jinx.with)}
					<li>
						<CharacterBadge characterId={jinx.with} />
						<span class="small"><GlossaryText text={jinx.reason} /></span>
					</li>
				{/each}
			</ul>
		{:else}<span data-testid="no-jinxes">{t('common.none')}</span>{/if}
	{:else if field === 'prep'}
		{#if prep.length}
			<ul class="list">
				{#each prep as step, i (i)}
					<li>
						<span
							>{#each step as s, j (j)}{#if s.kind === 'character'}<CharacterBadge
										characterId={s.id}
										inline
									/>{:else if s.kind === 'reminder'}<ReminderToken
										label={s.label}
										type={character.type}
									/>{:else}{s.text}{/if}{/each}</span
						>
					</li>
				{/each}
			</ul>
		{:else}{t('common.none')}{/if}
	{:else if field === 'preDay'}
		{#if entry.dayReminders.length}
			<ul class="list">
				{#each entry.dayReminders as reminder, i (i)}
					<li>
						<ReminderSentence segments={reminder.segments} type={character.type} />
						<span class="small"
							>{reminder.groupTitle} · {t('reference.when')}
							<GlossaryText text={reminder.when} />{#if reminder.autoDetected}
								· {t('reference.guessed')}{/if}</span
						>
					</li>
				{/each}
			</ul>
		{:else}
			<span class="none-row" data-testid="no-day"
				>{t('common.none')}{#if entry.noDayReason}<IconButton
						icon="info"
						label={t('reference.whyNoDay')}
						onclick={() =>
							onExplain(
								t('reference.noDayTitle', { name: character.name }),
								t('reference.noDayText', { reason: entry.noDayReason ?? '' })
							)}
					/>{/if}</span
			>
		{/if}
	{:else if field === 'problems'}
		{#if entry.problems.length}
			<ul class="problems">
				{#each entry.problems as problem (problem)}<li>{problem}</li>{/each}
			</ul>
		{:else}{t('common.none')}{/if}
	{:else if field === 'links'}
		<span class="links">
			{#if entry.wiki}
				<!-- External wiki page (the rules authority), not an app route. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={entry.wiki} target="_blank" rel="noopener"
					><Icon name="wiki" /> {t('reference.wiki')}</a
				>
			{/if}
			<!-- External GitHub issue form; only public build and character info in it. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={reportUrl} target="_blank" rel="noopener"
				><Icon name="report" /> {t('reference.report')}</a
			>
		</span>
	{/if}
</span>

<style>
	.value {
		min-width: 0;
	}
	.small {
		font-size: 0.8rem;
		line-height: 1.3;
		color: var(--on-surface-muted);
	}
	.block {
		display: block;
	}
	.spaced {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
	}
	.icons {
		display: inline-flex;
		gap: var(--space-1);
		vertical-align: middle;
	}
	.icons img {
		width: calc(1.75 * var(--u));
		height: calc(1.75 * var(--u));
		border-radius: 50%;
		background: var(--token-face);
	}
	.ability {
		line-height: 1.4;
	}
	code {
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}
	.night {
		display: inline-flex;
		gap: var(--space-2);
		align-items: baseline;
	}
	/* The step text wraps beside the position instead of widening the row. */
	.st {
		flex: 1 1 auto;
		min-width: 0;
	}
	.pos {
		flex: none;
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
		margin: 0;
		padding-left: var(--space-4);
		font-size: 0.85rem;
	}
	.links {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0 var(--space-4);
	}
	.links a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		white-space: nowrap;
		--icon-size: calc(1.1 * var(--u));
	}
</style>
