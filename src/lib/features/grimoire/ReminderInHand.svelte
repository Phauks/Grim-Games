<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Menu from '#lib/ui/primitives/Menu.svelte';

	/**
	 * The reminder in hand (Trevor, 2026-10-30): a tapped token from the Storyteller's bank or a
	 * player's bin, waiting for the seat tapped next. Centred over the foot of what holds it
	 * (`--hand-bottom` above it), the token, its ⋯
	 * when it has actions (Duplicate, About, ...), and × to put it down. No words: the token
	 * says what is held.
	 */
	interface MenuItem {
		value: string;
		label: string;
		disabled?: boolean;
		onSelect: () => void;
	}

	interface Props {
		/** The held token, drawn as the board draws it. */
		token: Snippet;
		/** Its ⋯ rows; none, no ⋯. */
		actions?: MenuItem[];
		/** Its ⋯ open (a right-click on the token opens it too). */
		menuOpen?: boolean;
		/** A tap on the token: its own dialog (Trevor, 2026-10-30: not a ⋯ row). */
		onAbout?: () => void;
		onPutDown: () => void;
	}

	let { token, actions = [], menuOpen = $bindable(false), onAbout, onPutDown }: Props = $props();
</script>

<div class="in-hand" role="status" data-testid="reminder-in-hand">
	{#if onAbout}<button
			type="button"
			class="token"
			aria-label={t('common.aboutReminder')}
			onclick={onAbout}>{@render token()}</button
		>{:else}<span class="token">{@render token()}</span>{/if}
	{#if actions.length > 0}
		<Menu
			label={t('common.moreReminderActions')}
			items={actions}
			placement="top"
			bind:open={menuOpen}
		/>
	{/if}
	<IconButton icon="close" label={t('common.putDown')} onclick={onPutDown} />
</div>

<style>
	.in-hand {
		position: absolute;
		left: 50%;
		bottom: var(--hand-bottom, var(--space-2));
		z-index: 4;
		translate: -50% 0;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1);
		padding-inline-start: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		box-shadow: var(--shadow);
		white-space: nowrap;
	}
	/* Room for the label band under the token, which is wider than it. */
	.token {
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
		touch-action: manipulation;
		display: grid;
		place-items: center;
		padding: 0 var(--space-2) calc(0.375 * var(--u));
	}
</style>
