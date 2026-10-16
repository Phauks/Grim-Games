<script lang="ts">
	import { Drawer } from '@ark-ui/svelte/drawer';
	import { Portal } from '@ark-ui/svelte/portal';
	import type { Snippet } from 'svelte';

	/** A snap point: a fraction of the viewport (0-1), or a size like `'20rem'` / `'300px'`. */
	type SnapPoint = number | string;

	interface Props {
		open?: boolean;
		title: string;
		description?: string;
		/** Heights the sheet rests at; the largest is the fully open sheet. */
		snapPoints?: SnapPoint[];
		/** Where the sheet opens; defaults to the largest snap point. */
		initialSnapPoint?: SnapPoint;
		/** Fires with the snap point the sheet settles on. */
		onSnap?: (snapPoint: SnapPoint | null) => void;
		/** Fixed height of the fully open sheet (e.g. `'85dvh'`); defaults to its content. */
		height?: string;
		/** Buttons at the end of the header, such as a "…" menu. */
		actions?: Snippet;
		/** Shown left of the title and description, spanning both lines (an icon). */
		lead?: Snippet;
		/** Replaces the title's text, for a title that can be edited in place. */
		heading?: Snippet;
		/** Right after the title on its line, such as an edit button. */
		titleEnd?: Snippet;
		children: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		description,
		snapPoints = [1],
		initialSnapPoint,
		onSnap,
		height,
		actions,
		lead,
		heading,
		titleEnd,
		children
	}: Props = $props();
</script>

<!--
	Bottom sheets, not modals (04-architecture.md §5): swipe down or tap outside to dismiss.
	Closing only hides the sheet; callers keep their own state.
-->
<Drawer.Root
	bind:open
	{snapPoints}
	defaultSnapPoint={initialSnapPoint ?? snapPoints[snapPoints.length - 1]}
	onSnapPointChange={(details) => onSnap?.(details.snapPoint)}
	lazyMount
	unmountOnExit
>
	<Portal>
		<Drawer.Backdrop />
		<Drawer.Positioner>
			<Drawer.Content style={height ? `height: ${height}` : undefined}>
				<Drawer.Grabber>
					<Drawer.GrabberIndicator />
				</Drawer.Grabber>
				<header>
					{#if lead}<div class="lead">{@render lead()}</div>{/if}
					<div class="titles">
						{#if heading || titleEnd}
							<div class="title-line">
								<Drawer.Title
									>{#if heading}{@render heading()}{:else}{title}{/if}</Drawer.Title
								>
								{#if titleEnd}{@render titleEnd()}{/if}
							</div>
						{:else}
							<Drawer.Title>{title}</Drawer.Title>
						{/if}
						{#if description}<Drawer.Description>{description}</Drawer.Description>{/if}
					</div>
					{#if actions}{@render actions()}{/if}
				</header>
				<div class="body">{@render children()}</div>
			</Drawer.Content>
		</Drawer.Positioner>
	</Portal>
</Drawer.Root>

<style>
	/* Ark renders these parts inside a portal, so they are styled by their data attributes. */
	:global([data-scope='drawer'][data-part='backdrop']) {
		position: fixed;
		inset: 0;
		z-index: var(--z-backdrop);
		background: var(--backdrop);
		opacity: calc(1 - var(--drawer-swipe-progress, 0));
		transition: opacity var(--duration-normal) var(--ease-out);
	}
	:global([data-scope='drawer'][data-part='backdrop'][data-swiping]) {
		transition: none;
	}
	:global([data-scope='drawer'][data-part='backdrop'][data-state='open']) {
		animation: sheet-fade-in var(--duration-normal) var(--ease-out);
	}
	:global([data-scope='drawer'][data-part='backdrop'][data-state='closed']) {
		animation: sheet-fade-out var(--duration-normal) var(--ease-in) forwards;
	}

	:global([data-scope='drawer'][data-part='positioner']) {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		pointer-events: none;
	}

	:global([data-scope='drawer'][data-part='content']) {
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		width: min(100%, calc(40 * var(--u)));
		max-height: 92dvh;
		padding: 0 var(--space-4) calc(var(--space-5) + env(safe-area-inset-bottom));
		border-radius: var(--sheet-radius) var(--sheet-radius) 0 0;
		background: var(--sheet-background);
		color: var(--sheet-color);
		box-shadow: var(--shadow);
		outline: none;
		transition: transform var(--duration-normal) var(--ease-out);
	}
	:global([data-scope='drawer'][data-part='content'][data-state='open']) {
		animation: sheet-slide-in var(--duration-slow) var(--ease-out);
	}
	:global([data-scope='drawer'][data-part='content'][data-state='closed']) {
		animation: sheet-slide-out var(--duration-normal) var(--ease-in) forwards;
	}

	:global([data-scope='drawer'][data-part='grabber']) {
		display: grid;
		place-items: center;
		min-height: var(--tap-target);
		cursor: grab;
	}
	:global([data-scope='drawer'][data-part='grabber-indicator']) {
		width: calc(2.75 * var(--u));
		height: calc(0.3 * var(--u));
		border-radius: var(--radius-full);
		background: var(--sheet-grabber);
		opacity: 0.6;
	}

	:global([data-scope='drawer'][data-part='title']) {
		margin: 0;
		color: inherit;
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 1.3rem;
		letter-spacing: 0.04em;
	}
	:global([data-scope='drawer'][data-part='description']) {
		margin: var(--space-1) 0 0;
		color: var(--on-sheet-muted);
	}

	header {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding-bottom: var(--space-3);
		/* Dragging the header moves the sheet instead of scrolling the page. */
		touch-action: none;
	}
	.titles {
		flex: 1;
		min-width: 0;
	}
	.lead {
		flex: none;
		align-self: center;
	}
	/* A fixed height, so an input swapped in for the title moves nothing. */
	.title-line {
		display: flex;
		align-items: center;
		height: var(--tap-target);
		min-width: 0;
	}
	.title-line > :global([data-part='title']) {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.body {
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	@keyframes -global-sheet-slide-in {
		from {
			transform: translate3d(0, 100%, 0);
		}
	}
	@keyframes -global-sheet-slide-out {
		to {
			transform: translate3d(0, 100%, 0);
		}
	}
	@keyframes -global-sheet-fade-in {
		from {
			opacity: 0;
		}
	}
	@keyframes -global-sheet-fade-out {
		to {
			opacity: 0;
		}
	}
</style>
