<script lang="ts" module>
	export interface SearchSourceOption<Id extends string> {
		id: Id;
		label: string;
		/** Listed but switched off when it can't be searched now, e.g. Profile when signed out. */
		available: boolean;
	}
</script>

<script lang="ts" generics="Id extends string">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';

	/**
	 * Where the search box looks (Trevor, 2026-10-16): one line naming every source being
	 * searched, opening switches for each. A new provider in `script-providers.ts` only adds
	 * an option here, so the line stays one line however many sources there are.
	 */
	interface Props {
		options: readonly SearchSourceOption<Id>[];
		selected: Id[];
		onChange: (selected: Id[]) => void;
	}

	let { options, selected, onChange }: Props = $props();
	let open = $state(false);
	let anchor: HTMLElement | undefined = $state();

	const searched = $derived(
		options.filter((o) => o.available && selected.includes(o.id)).map((o) => o.label)
	);

	function toggle(id: Id, on: boolean) {
		onChange(on ? [...selected, id] : selected.filter((s) => s !== id));
	}
</script>

<button
	type="button"
	class="line"
	bind:this={anchor}
	aria-haspopup="dialog"
	data-testid="search-sources"
	onclick={() => (open = true)}
>
	<span class="label">{t('scripts.sources.label')}</span>
	<span class="list">{searched.length > 0 ? searched.join(', ') : t('common.none')}</span>
	<Icon name="expand" />
</button>

<Popover bind:open title={t('scripts.sources.title')} {anchor}>
	<div class="options">
		{#each options as option (option.id)}
			<Toggle
				label={option.label}
				checked={option.available && selected.includes(option.id)}
				disabled={!option.available}
				onChange={(on) => toggle(option.id, on)}
			/>
		{/each}
	</div>
</Popover>

<style>
	.line {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-width: 0;
		min-height: var(--tap-target);
		padding: 0 var(--space-1);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.label {
		color: var(--on-surface-muted);
		white-space: nowrap;
	}
	.list {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.options {
		display: grid;
		margin-top: var(--space-2);
	}
</style>
