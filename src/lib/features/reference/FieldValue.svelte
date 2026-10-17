<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		characterIcons,
		ICONS_PATH,
		type Character,
		type Special
	} from '#lib/core/data/index.ts';
	import { characterNames } from '#lib/core/rules/character-names.ts';
	import type {
		ReferenceEntry,
		ReferenceNight,
		ReferenceToken
	} from '#lib/core/rules/reference.ts';
	import { prepTextSegments, setupPrep } from '#lib/core/rules/setup-reminders.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { sheetNumbersFor } from '#lib/features/characters/sheet-night-numbers.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { reportDialog } from '#lib/features/reports/report-dialog.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import { characterCardsFor } from '#lib/features/info-tokens/character-cards.ts';
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
		/** `character`: the overlay's title starts with its badge. */
		onExplain: (title: string, text: string, character?: Character) => void;
		/** Token size in px (fixed, so nothing reflows). */
		tokenSize?: number;
		/** The name as plain text, not a badge: the table is pure information (Trevor, 2026-10-16). */
		plainName?: boolean;
	}

	let { field, entry, onExplain, tokenSize = 56, plainName = false }: Props = $props();
	// Jinxes start folded: they vary most in size (Trevor, 2026-10-16). Built only when opened.
	let jinxesOpen = $state(false);

	const character = $derived(entry.character);
	/** The Report form as a rules report, its title started with this character's name. */
	// eslint-disable-next-line grim/names-as-badges -- prefilled text in a form field, not shown as a name
	const reportCharacter = () => reportDialog.show({ kind: 'rules', title: `${character.name}: ` });
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
	/** "Setup", or "Setup: 1 of 2" when only some copies go down at setup. */
	function setupLabel(token: ReferenceToken): string | undefined {
		const placed = token.setup + token.firstDay;
		if (placed === 0) return undefined;
		const key = token.firstDay > 0 && token.setup === 0 ? 'reference.firstDay' : 'reference.setup';
		return placed === token.copies
			? t(key)
			: t('reference.setupSome', { label: t(key), placed, copies: token.copies });
	}

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

<!-- Wiki and Report as icon links: under the name in the table, at the top of a card
     (Trevor, 2026-10-16). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -- external links, not app routes -->
{#snippet links()}
	<span class="links">
		{#if entry.wiki}
			<!-- External wiki page (the rules authority), not an app route. -->
			<a
				href={entry.wiki}
				target="_blank"
				rel="noopener"
				aria-label={t('reference.wiki')}
				title={t('reference.wiki')}><Icon name="wiki" /></a
			>
		{/if}
		<!-- The in-app Report form, as a rules report about this character. -->
		<button
			type="button"
			aria-label={t('reference.report')}
			title={t('reference.report')}
			onclick={reportCharacter}><Icon name="report" /></button
		>
	</span>
{/snippet}
<!-- eslint-enable svelte/no-navigation-without-resolve -->

<span class="value" data-field={field}>
	{#if field === 'token'}
		<CharacterToken
			{character}
			size={tokenSize}
			nightNumbers={preferences.current.tokenAppearance.nightNumbers && officialData.current
				? sheetNumbersFor(officialData.current.nightSheet, character.id)
				: undefined}
		/>
	{:else if field === 'name' && plainName}
		<!-- eslint-disable-next-line grim/names-as-badges -- Reference table cells are plain information (Trevor, 2026-10-16) -->
		<span class="block">{character.name}</span>{@render links()}
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
		{#if entry.setup}<CharacterBadge characterId={character.id} {character} inline />: <GlossaryText
				text={entry.setup.summary}
			/>{#if entry.setup.notes.length}<span class="small block"
					><GlossaryText text={entry.setup.notes.join(' ')} /></span
				>{/if}{:else}{t('common.none')}{/if}
	{:else if field === 'ability'}
		<span class="ability"><GlossaryText text={character.ability} names={[character.name]} /></span>
	{:else if field === 'tokens'}
		<span class="spaced"
			>{#each entry.tokens as token, i (i)}<ReminderToken
					label={token.global ? t('reference.globalReminder', { label: token.label }) : token.label}
					type={character.type}
					count={token.copies}
					setup={setupLabel(token)}
				/>{:else}{t('common.none')}{/each}</span
		>
	{:else if field === 'special'}
		<span class="spaced"
			>{#each character.special as s, i (i)}<code>{special(s)}</code>{:else}{t(
					'common.none'
				)}{/each}</span
		>
	{:else if field === 'cards'}
		<span class="spaced"
			>{#each characterCardsFor([character.id]) as card (card.id)}<span>{t(card.titleKey)}</span
				>{:else}{t('common.none')}{/each}</span
		>
	{:else if field === 'firstNight'}
		{@render nightValue('night-first', 'first', entry.firstNight)}
	{:else if field === 'otherNight'}
		{@render nightValue('night-other', 'other', entry.otherNight)}
	{:else if field === 'jinxes'}
		{#if entry.jinxes.length}
			<button
				type="button"
				class="fold"
				aria-expanded={jinxesOpen}
				data-testid="jinx-toggle"
				onclick={() => (jinxesOpen = !jinxesOpen)}
				><span class="caret" aria-hidden="true"><Icon name="expand" /></span>{t(
					'reference.jinxCount',
					{ count: entry.jinxes.length }
				)}</button
			>
			{#if jinxesOpen}<ul class="list">
					{#each entry.jinxes as jinx (jinx.with)}
						<!-- The text-size badge as a bar across, the jinx indented under it (Trevor, 2026-10-16). -->
						<li class="jinx">
							<span class="jinx-bar"><CharacterBadge characterId={jinx.with} inline /></span>
							<span class="small jinx-reason"><GlossaryText text={jinx.reason} /></span>
						</li>
					{/each}
				</ul>{/if}
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
								t('reference.noDayTitle', { name: slot('character') }),
								t('reference.noDayText', { reason: entry.noDayReason ?? '' }),
								character
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
		{@render links()}
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
	.list li.jinx {
		justify-items: stretch;
		gap: var(--space-1);
	}
	.jinx-bar :global(.badge) {
		display: flex;
		width: 100%;
	}
	.jinx-reason {
		padding-inline-start: var(--space-3);
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
		gap: 0 var(--space-1);
		/* The icons' tap areas reach past them, so they line up with the text beside. */
		margin-inline: calc((var(--tap-target) - 1.1 * var(--u)) / -2);
	}
	.links a,
	.links button {
		display: inline-grid;
		place-items: center;
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		--icon-size: calc(1.1 * var(--u));
	}
	.links button {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.fold {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.fold .caret {
		display: grid;
		transition: transform 0.15s ease;
	}
	.fold[aria-expanded='false'] .caret {
		transform: rotate(-90deg);
	}
	@media (prefers-reduced-motion: reduce) {
		.fold .caret {
			transition: none;
		}
	}
</style>
