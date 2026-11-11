<!--
	Reminder tokens in a row that wraps, drawn as on the board (BoardReminder), each in an
	`<li>` of the caller's (or, `inline`, a `<span>` row of bare tokens inside a line): anywhere reminders are listed rather than named in a sentence
	(Trevor, 2026-10-30: "in-line makes sense when in a sentence, but besides that, should be
	in this manner").
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { shownReminderSize } from '#lib/ui/seating/last-board.svelte.ts';

	interface Props {
		children: Snippet;
		label?: string;
		testid?: string;
		/** Inside a line of text: a `<span>`, its tokens bare. */
		inline?: boolean;
		/** On one line: tokens that don't fit are cut off at the end. */
		oneLine?: boolean;
	}

	let { children, label, testid, inline = false, oneLine = false }: Props = $props();

	const size = $derived(
		shownReminderSize(preferences.current.tokenAppearance, {
			width: innerWidth.current ?? 0,
			height: innerHeight.current ?? 0
		})
	);
	// Room beside each token for its words, which run wider than it.
	const gap = $derived(Math.round(size * 0.6));
</script>

<svelte:element
	this={inline ? 'span' : 'ul'}
	class="token-row"
	aria-label={label}
	data-testid={testid}
	data-one-line={oneLine || undefined}
	style:--reminder-gap="{gap}px"
	style:--reminder-d="{size}px"
>
	{@render children()}
</svelte:element>

<style>
	/* Room under a row for the words' band, and before the first token for its words. */
	.token-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--reminder-gap);
		margin: 0;
		padding: 0 0 var(--space-2) calc(var(--reminder-gap) / 4);
		list-style: none;
		vertical-align: middle;
	}
	/* As tall as a token even with none, so the first one moves nothing (no reflow). */
	span.token-row {
		display: inline-flex;
		min-height: var(--reminder-d);
		padding-bottom: 0;
	}
	.token-row[data-one-line] {
		flex-wrap: nowrap;
		min-width: 0;
		overflow: hidden;
		padding-block: var(--space-1);
	}
</style>
