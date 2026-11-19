<script lang="ts">
	import NoneState from '#lib/ui/primitives/NoneState.svelte';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import { roomImagePath } from '#lib/core/sync/room-images.ts';
	import type { PlayersPhase } from '#lib/core/rules/game-phase.ts';
	import { phaseText } from '#lib/features/game/phase-text.ts';
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { roomHost } from './host.svelte.ts';
	import type { InboxItem } from './inbox.svelte.ts';

	/**
	 * One player's messages and reported picture, in their sheet on Players (Trevor,
	 * 2026-10-29: "get rid of messages, and just fully integrate it into Players"). Newest
	 * first, each drawn as a note is (plan M86, Trevor 2026-11-15: player-written notes should
	 * look like the Storyteller's): a row with a line under it, when it was sent on its first
	 * line, the words below in the notes' lighter well. Tapping one opens it on its own; only then is a message read, and it can be marked unread again
	 * ("only marked as read when entered"). A reported picture is judged there: let it stand,
	 * or take that player's picture away until the next game.
	 */
	interface Props {
		memberId: string;
		/** The player's name, for the picture's label. */
		name: PlayerName;
	}

	let { memberId, name }: Props = $props();
	const host = roomHost();
	const inbox = host.inbox;
	const shown = $derived(inbox.items.filter((i) => i.memberId === memberId));
	const removeLabel = $derived(
		// eslint-disable-next-line grim/names-as-badges -- an accessible name, never shown
		t('room.pictureReport.removeNamed', { name })
	);

	/** The box opened on its own, by kind and id. */
	let openKey = $state<string>();
	const opened = $derived(inbox.items.find((i) => key(i) === openKey));
	let itemOpen = $state(false);
	$effect(() => {
		// A picture judged, or a game ended, takes its box away: its own view closes with it.
		if (itemOpen && !opened) itemOpen = false;
	});

	function key(item: InboxItem): string {
		return `${item.kind}:${item.id}`;
	}

	function open(item: InboxItem) {
		openKey = key(item);
		itemOpen = true;
		if (item.kind === 'message') inbox.markRead(item.id);
	}

	/** A message still to read, or a picture still to judge. */
	function isNew(item: InboxItem): boolean {
		return item.kind === 'picture' || !item.read;
	}

	/** When in the game it was sent: "Day 2", or "Message" from a room that didn't say. */
	function when(item: InboxItem): string {
		if (item.kind === 'picture') return t('room.inbox.picture');
		return item.phase ? phaseName(item.phase) : t('room.inbox.message');
	}

	/** The clock time it was sent (Trevor, 2026-11-06), in the device's own 12 or 24 hours. */
	const clock = $derived(new Intl.DateTimeFormat(locale.current, { timeStyle: 'short' }));

	function phaseName(phase: PlayersPhase): string {
		if (phase.kind === 'setup') return phaseText(phase);
		return phaseText({ kind: phase.kind === 'night' ? 'night' : 'day', number: phase.number });
	}
</script>

<!-- When it was sent and whether a consult was asked for, on the line above the words, where a
     note's title sits (Trevor, 2026-11-06, "A"; 2026-11-15): the same in the list and opened. -->
{#snippet meta(item: InboxItem, dot: boolean)}
	<span class="meta" data-testid="inbox-meta">
		{#if dot}
			<!-- The dot's place is kept when it is off, so nothing shifts as boxes are read. -->
			<span class="dot" class:on={isNew(item)}>
				{#if isNew(item)}<span class="visually-hidden">{t('room.inbox.new')}</span>{/if}
			</span>
		{/if}
		<span class="when" data-testid="inbox-when">{when(item)}</span>
		{#if item.at !== undefined}<time
				class="clock"
				data-testid="inbox-time"
				datetime={new Date(item.at).toISOString()}>{clock.format(item.at)}</time
			>{/if}
		{#if item.kind === 'message'}
			<!-- Always said, either way (Trevor, 2026-11-06: "if they requested a consult or not"). -->
			{#if item.consult}<span class="pill asked" data-testid="inbox-consult"
					><Icon name="messages" />{t('room.inbox.consult')}</span
				>{:else}<span class="pill" data-testid="inbox-no-consult">{t('room.inbox.noConsult')}</span
				>{/if}
		{/if}
	</span>
{/snippet}

{#if shown.length === 0}
	<NoneState />
{:else}
	<ul class="items" data-testid="inbox" aria-label={t('room.inbox.title')}>
		{#each shown as item (key(item))}
			<li>
				<button
					type="button"
					class="item"
					data-kind={item.kind}
					data-new={isNew(item) ? '' : undefined}
					data-testid="inbox-item"
					onclick={() => open(item)}
				>
					{@render meta(item, true)}
					{#if item.kind === 'message'}
						{#if item.text}<span class="preview">{item.text}</span>{:else}<span
								class="preview empty">{t('room.inbox.noWords')}</span
							>{/if}
					{:else}
						<span class="preview">{t('room.inbox.reported', { count: item.count })}</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
{/if}

<!-- One message or reported picture on its own (Trevor, 2026-10-28: "allow ability to enter
     each individual message"). -->
<Dialog
	bind:open={itemOpen}
	title={opened?.kind === 'picture' ? t('room.inbox.picture') : t('room.inbox.message')}
>
	{#if opened}
		<div class="opened" data-testid="inbox-opened">
			{@render meta(opened, false)}
			<div class="body">
				{#if opened.kind === 'message'}
					{#if opened.text}<p class="text">{opened.text}</p>{:else}<p class="text empty">
							{t('room.inbox.noWords')}
						</p>{/if}
				{:else}
					{#if host.code}
						<img
							class="picture"
							src={roomImagePath(host.code, opened.hash)}
							alt={t('room.pictureReport.picture', { name })}
						/>
					{/if}
					<p class="text">{t('room.inbox.reported', { count: opened.count })}</p>
				{/if}
			</div>
		</div>
	{/if}
	{#snippet headActions()}
		<!-- Beside ✕ (Trevor, 2026-10-28: "make it an eyeball next to the x"). -->
		{#if opened?.kind === 'message'}
			{@const message = opened}
			<IconButton
				icon="markUnread"
				label={t('room.inbox.markUnread')}
				onclick={() => {
					inbox.markRead(message.id, false);
					itemOpen = false;
				}}
			/>
		{/if}
	{/snippet}
	{#snippet actions()}
		{#if opened?.kind === 'picture'}
			{@const picture = opened}
			<div class="actions">
				<Button onclick={() => inbox.judgePicture(picture.hash, true)}
					>{t('room.pictureReport.allow')}</Button
				>
				<DeleteButton label={removeLabel} onclick={() => inbox.judgePicture(picture.hash, false)} />
			</div>
		{/if}
	{/snippet}
</Dialog>

<style>
	.items {
		display: grid;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	/* A row with a line under it, as a note is (NoteRow). */
	li {
		display: grid;
		border-bottom: 1px solid var(--border); /* px-ok: a hairline, as a note's */
	}
	.item {
		display: grid;
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 0 var(--space-2);
		border: 0;
		background: none;
		color: var(--on-surface);
		font: inherit;
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	.opened {
		display: grid;
		color: var(--on-surface);
	}
	/* The note's title line: the same height and font as a title. */
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		min-height: var(--tap-target);
		font-family: var(--font-control);
	}
	.dot {
		flex: none;
		width: 0.6em;
		height: 0.6em;
		border-radius: 50%;
	}
	.dot.on {
		background: var(--accent);
	}
	.when {
		font-weight: 700;
		letter-spacing: 0.03em;
	}
	.clock {
		color: var(--on-surface-muted);
		font-variant-numeric: tabular-nums;
	}
	/* Consult, asked or not, at the band's end. */
	.pill {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin-left: auto;
		padding: 0.1em 0.6em;
		border: 0.0625rem solid var(--border);
		border-radius: 999em;
		color: var(--on-surface-muted);
		font-size: 0.85rem;
		white-space: nowrap;
	}
	/* A request to talk in private stands out from the words of the message. */
	.pill.asked {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 600;
	}
	/* The words in the notes' lighter well (RichTextField's inline field), two lines at most in
	   the list; the whole message shows when it is opened. */
	.preview,
	.body {
		box-sizing: border-box;
		min-height: calc(2lh + 2 * var(--space-2));
		border-radius: var(--radius-md);
		background: var(--surface-selected);
	}
	.item:hover .preview {
		box-shadow: inset 0 0 0 2px var(--border); /* px-ok: the well's ring, as the field's focus */
	}
	.preview {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		overflow-wrap: anywhere;
		padding: var(--space-2) var(--space-3);
	}
	.empty {
		color: var(--on-surface-muted);
		font-style: italic;
	}
	.body {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
	}
	.text {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.picture {
		justify-self: center;
		width: calc(8 * var(--u));
		aspect-ratio: 1;
		border-radius: 50%;
		object-fit: cover;
		background: var(--surface-raised);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
