<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import {
		GROUPED_SOURCES,
		groupSources,
		keepSources,
		orderSources,
		type PageSource,
		type SourceGroup
	} from './search-sources.ts';

	/**
	 * Search's search box (`part="search"`, the page's toolbar) or its sources (`part="source"`,
	 * at the end of the page's title row). The sources are a menu (Trevor, 2026-10-18): All
	 * Sources, then each group behind its caret, every source on or off.
	 */
	interface Props {
		part: 'search' | 'source';
		term?: string;
		sources: PageSource[];
	}

	let { part, term = $bindable(''), sources = $bindable() }: Props = $props();

	const GROUPS: readonly SourceGroup[] = ['engines', 'collections'];

	let open = $state(false);
	let trigger = $state<HTMLButtonElement>();

	const allOn = $derived(GROUPED_SOURCES.every((s) => sources.includes(s)));
	const summary = $derived(
		allOn
			? t('scripts.sources.all')
			: sources.length === 0
				? t('common.none')
				: sources.length === 1
					? t(`scripts.picker.source.${sources[0]}`)
					: t('scripts.sources.count', { count: sources.length })
	);

	function set(changed: readonly PageSource[], on: boolean) {
		const next = on
			? orderSources([...sources, ...changed])
			: sources.filter((s) => !changed.includes(s));
		sources = next;
		keepSources(next);
	}
</script>

{#if part === 'search'}
	<div class="search">
		<SearchField
			bind:value={term}
			label={t('scripts.picker.search')}
			placeholder={t('scripts.picker.searchPlaceholder')}
		/>
	</div>
{:else}
	<div class="source">
		<button
			bind:this={trigger}
			type="button"
			class="trigger"
			aria-haspopup="dialog"
			aria-expanded={open}
			aria-label="{t('scripts.sources.label')}: {summary}"
			onclick={() => (open = !open)}
		>
			<span class="summary">{summary}</span>
			<Icon name="expand" />
		</button>
	</div>
	<Popover bind:open anchor={trigger} title={t('scripts.sources.label')}>
		<div class="menu" data-testid="search-sources">
			<Toggle
				label={t('scripts.sources.all')}
				checked={allOn}
				onChange={(on) => set(GROUPED_SOURCES, on)}
			/>
			{#each GROUPS as group (group)}
				{@const members = groupSources(group)}
				{@const label = t(`scripts.sources.group.${group}`)}
				<Collapsible title={label} level={3} startClosed>
					{#snippet aside()}
						<Toggle
							{label}
							hideLabel
							checked={members.every((s) => sources.includes(s))}
							onChange={(on) => set(members, on)}
						/>
					{/snippet}
					<div class="members">
						{#each members as member (member)}
							<Toggle
								label={t(`scripts.picker.source.${member}`)}
								checked={sources.includes(member)}
								onChange={(on) => set([member], on)}
							/>
						{/each}
					</div>
				</Collapsible>
			{/each}
		</div>
	</Popover>
{/if}

<style>
	.search {
		flex: 1 1 100%;
		display: grid;
		gap: var(--space-1);
	}
	/* Room for the longest source name, never wider than the row. */
	.source {
		width: 17rem;
		max-width: 100%;
	}
	.trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
		border: var(--control-border);
		border-radius: var(--card-radius);
		background: var(--choice-background);
		color: var(--choice-color);
		font: inherit;
		font-family: var(--font-control);
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	.trigger[aria-expanded='true'] {
		border-color: var(--choice-selected-border);
	}
	.trigger:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.summary {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.menu {
		display: grid;
		gap: var(--space-1);
	}
	/* A group's sources sit under its title. */
	.members {
		display: grid;
		padding-inline-start: var(--space-4);
	}
</style>
