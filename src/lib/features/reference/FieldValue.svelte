<script lang="ts">
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
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
	import CharacterDialog from '#lib/features/characters/CharacterDialog.svelte';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import { prefetchWikiPage } from '#lib/features/characters/wiki-page.svelte.ts';
	import CharacterEntry from '#lib/features/characters/CharacterEntry.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import { cardsOfCharacter } from '#lib/features/info-tokens/character-cards.ts';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import CharacterDataDialog from './CharacterDataDialog.svelte';
	import type { FieldId } from './fields.ts';
	import { EDITION_LABELS, TYPE_LABELS } from './labels.ts';
	import NightText from './NightText.svelte';
	import { reminderTargetLabel } from './reminder-target-label.ts';
	import ReminderSentence from './ReminderSentence.svelte';

	interface Props {
		field: FieldId;
		entry: ReferenceEntry;
		/** Opens the shared details overlay (e.g. why there are no pre-day reminders). */
		/** `character`: the overlay's title starts with its badge. */
		onExplain: (title: string, text: string, character?: Character) => void;
		/** Token size in px (fixed, so nothing reflows). */
		tokenSize?: number;
	}

	let { field, entry, onExplain, tokenSize = 56 }: Props = $props();
	// The token opens the character's details, as its badge does (Trevor, 2026-10-19). The
	// dialog is only created on first tap: the page shows hundreds of tokens.
	let detailsOpen = $state(false);
	let detailsUsed = $state(false);
	let dataOpen = $state(false);
	let dataUsed = $state(false);
	// Jinxes start folded: they vary most in size (Trevor, 2026-10-16). Built only when opened.

	const character = $derived(entry.character);
	/** The Report form as a rules report, its title started with this character's name. */
	// eslint-disable-next-line grim/names-as-badges -- prefilled text in a form field, not shown as a name
	const reportCharacter = () => reportDialog.show({ kind: 'rules', title: `${character.name}: ` });
	// Prep steps with [Token] as reminder chips and names as badges (built only for this field).
	const prep = $derived.by(() => {
		if (field !== 'prep') return [];
		const names = characterNames(officialData.current?.characters ?? []);
		return setupPrep(character.id, character.name, new Map([[character.id, character]])).map(
			(step) => prepTextSegments(step.text, names)
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

	/** Beside each reminder: when it goes down and who it may go on, e.g. "Placed at setup · Goes on: Good players". */
	function tokenNote(token: ReferenceToken): string | undefined {
		const target = reminderTargetLabel(
			character.id,
			token.label,
			(id) => officialData.current?.byId.get(id)?.name ?? id
		);
		const parts = [setupLabel(token), target && t('reference.target.label', { target })];
		return parts.filter(Boolean).join(' · ') || undefined;
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
			>{#if info.position !== undefined}{t('reference.nightStep', {
					position: info.position
				})}{:else}–{/if}{#if info.number !== undefined}<small
					title={t('reference.provisionalNumber')}
					>{t('reference.nightSortNumber', { number: info.number })}</small
				>{/if}</span
		>
		<span class="st"
			>{#if info.text}<NightText text={info.text} {character} {night} />{:else}{t(
					'common.none'
				)}{/if}</span
		>
	</span>
{/snippet}

<!-- Wiki and Report as icon links under the name (Trevor, 2026-10-16). -->
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
		<!-- Everything the app reads about the character, by file (built only on first tap). -->
		<button
			type="button"
			aria-label={t('reference.data.open')}
			title={t('reference.data.open')}
			aria-haspopup="dialog"
			data-testid="character-data-open"
			onclick={() => {
				dataUsed = true;
				dataOpen = true;
			}}><Icon name="data" /></button
		>
	</span>
	{#if dataUsed}<CharacterDataDialog bind:open={dataOpen} {character} />{/if}
{/snippet}
<!-- eslint-enable svelte/no-navigation-without-resolve -->

<span class="value" data-field={field}>
	{#if field === 'token'}
		<button
			type="button"
			class="token-button"
			aria-label={t('reference.aboutCharacter', { name: character.name })}
			aria-haspopup="dialog"
			onpointerdown={() => prefetchWikiPage(character)}
			onfocus={() => prefetchWikiPage(character)}
			onclick={() => {
				detailsUsed = true;
				detailsOpen = true;
			}}
		>
			<CharacterToken
				{character}
				size={tokenSize}
				nightNumbers={preferences.current.tokenAppearance.nightLeaves === 'numbers' &&
				officialData.current
					? sheetNumbersFor(officialData.current.nightSheet, character.id)
					: undefined}
			/>
		</button>
		{#if detailsUsed}<CharacterDialog
				bind:open={detailsOpen}
				{character}
				icon={iconUrl(character)}
			/>{/if}
	{:else if field === 'name'}
		<!-- eslint-disable-next-line grim/names-as-badges -- Reference table cells are plain information (Trevor, 2026-10-16) -->
		<span class="block">{character.name}</span>{@render links()}
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
		{#if entry.setup}<CharacterBadge characterId={character.id} {character} />: <GlossaryText
				text={entry.setup.summary}
			/>{#if entry.setup.notes.length}<span class="small block"
					><GlossaryText text={entry.setup.notes.join(' ')} /></span
				>{/if}{:else}{t('common.none')}{/if}
	{:else if field === 'ability'}
		<span class="ability"><GlossaryText text={character.ability} names={[character.name]} /></span>
	{:else if field === 'flavor'}
		{#if character.flavor}<q class="flavor">{character.flavor}</q>{:else}{t('common.none')}{/if}
	{:else if field === 'tokens'}
		<span class="tokens"
			>{#each entry.tokens as token, i (i)}{@const note = tokenNote(token)}<span class="token-row"
					><ReminderToken
						label={token.label}
						type={character.type}
						{character}
						count={token.copies}
					/>{#if note}<span class="small">{note}</span>{/if}</span
				>{:else}{t('common.none')}{/each}</span
		>
	{:else if field === 'special'}
		<span class="spaced"
			>{#each character.special as s, i (i)}<code>{special(s)}</code>{:else}{t(
					'common.none'
				)}{/each}</span
		>
	{:else if field === 'cards'}
		<span class="spaced"
			>{#each cardsOfCharacter(character) as card (card.id)}<span>{t(card.titleKey)}</span
				>{:else}{t('common.none')}{/each}</span
		>
	{:else if field === 'firstNight'}
		{@render nightValue('night-first', 'first', entry.firstNight)}
	{:else if field === 'otherNight'}
		{@render nightValue('night-other', 'other', entry.otherNight)}
	{:else if field === 'jinxes'}
		{#if entry.jinxes.length}
			<!-- Starts folded each time (Trevor, 2026-10-16), the count beside it. -->
			<Collapsible title={t('characters.jinxes')} level={4} startClosed count={entry.jinxes.length}
				><ul class="list">
					{#each entry.jinxes as jinx (jinx.with)}
						<!-- The text-size badge as a bar across, the jinx indented under it (Trevor, 2026-10-16). -->
						<li class="jinx">
							<CharacterEntry characterId={jinx.with}
								><span class="small"><GlossaryText text={jinx.reason} /></span></CharacterEntry
							>
						</li>
					{/each}
				</ul></Collapsible
			>
		{:else}<span data-testid="no-jinxes">{t('common.none')}</span>{/if}
	{:else if field === 'prep'}
		{#if prep.length}
			<ul class="list">
				{#each prep as step, i (i)}
					<li>
						<span
							>{#each step as s, j (j)}{#if s.kind === 'character'}<CharacterBadge
										characterId={s.id}
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
	{/if}
</span>

<style>
	.value {
		min-width: 0;
	}
	/* The token itself is the button: no frame of its own, and at least a tap target. */
	.token-button {
		display: inline-grid;
		place-items: center;
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		border-radius: var(--radius-full);
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.flavor {
		font-style: italic;
	}
	.small {
		font-size: 0.8rem;
		line-height: 1.3;
		color: var(--on-surface-muted);
	}
	.block {
		display: block;
	}
	.tokens {
		display: flex;
		flex-direction: column;
		/* Each row spans the cell, so the line between rows does too. */
		align-items: stretch;
		gap: var(--space-2);
	}
	/* Stacked entries are told apart by a line, never by spacing alone (Trevor's delineation
	   rule): a phone stacks them with nothing beside them. */
	.token-row + .token-row,
	.list li:not(.jinx) + li:not(.jinx) {
		padding-top: var(--space-2);
		border-top: var(--card-border);
	}
	.token-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: calc(0.5 * var(--u));
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
</style>
