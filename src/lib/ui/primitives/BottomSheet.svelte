<script lang="ts">
	import { Drawer } from '@ark-ui/svelte/drawer';
	import { Portal } from '@ark-ui/svelte/portal';
	import { usePortalTarget } from './portal-target.ts';
	import type { Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { layerStyle, openLayer } from './layers.ts';

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
		/** Replaces the description's text, for one with parts of different sizes. */
		subtitle?: Snippet;
		children: Snippet;
		/**
		 * Off by default: sheets never focus a field when they open, so a phone's keyboard
		 * stays closed until a field is tapped (Trevor, 2026-10-16 and 2026-10-19: "we don't
		 * always need keyboard"). True only where typing is the sheet's whole point.
		 */
		focusFirstField?: boolean;
		/** Room for two columns on a computer, where the sheet opens as a centred panel. */
		wide?: boolean;
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
		subtitle,
		children,
		focusFirstField = false,
		wide = false
	}: Props = $props();
	/** Inside a full-screen view (the grim cover), into it; else the body (portal-target.ts). */
	const portalTarget = usePortalTarget();

	// Drawn above every overlay opened before it (layers.ts); kept after closing so the exit
	// animation stays where it was.
	let layer = $state(1);
	$effect(() => {
		if (!open) return;
		const taken = openLayer();
		layer = taken.layer;
		return taken.close;
	});
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
	initialFocusEl={focusFirstField ? undefined : () => false}
>
	<Portal container={portalTarget()}>
		<Drawer.Backdrop style={layerStyle(layer, 'backdrop')} />
		<Drawer.Positioner style={layerStyle(layer, 'content')}>
			<Drawer.Content
				style={height ? `height: ${height}` : undefined}
				data-wide={wide || undefined}
			>
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
						{#if description}<Drawer.Description
								>{#if subtitle}{@render subtitle()}{:else}{description}{/if}</Drawer.Description
							>{/if}
					</div>
					{#if actions}{@render actions()}{/if}
					<!-- Computers only (see the media query): no swipe there, so a visible way out. -->
					<Drawer.CloseTrigger class="desktop-close" aria-label="Close"
						><Icon name="close" /></Drawer.CloseTrigger
					>
				</header>
				<div class="body">{@render children()}</div>
			</Drawer.Content>
		</Drawer.Positioner>
	</Portal>
</Drawer.Root>

<style>
	/* Over the grimoire board, the board behind is blurred as well as dimmed, so nothing on it
	   can be read while it isn't the main screen (Trevor, 2026-10-23: "for game integrity").
	   GrimoireBoard marks the page while it is shown (board-cover.ts). */
	:global(:root[data-board-shown] [data-scope='drawer'][data-part='backdrop']) {
		-webkit-backdrop-filter: blur(var(--u));
		backdrop-filter: blur(var(--u));
	}
	/* Ark renders these parts inside a portal, so they are styled by their data attributes. */
	:global([data-scope='drawer'][data-part='backdrop']) {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-overlay) + var(--layer, 0));
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
		z-index: calc(var(--z-overlay) + var(--layer, 1));
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
		/* Pinned section headers stop at the sheet's own top, in its colour. */
		--pin-top: 0rem;
		--pin-background: var(--sheet-background);
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
		color: var(--on-surface-muted);
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
	/* Room for focus rings: a scroll box clips anything drawn past its edge. */
	.body {
		min-height: 0;
		margin-inline: calc(-1 * var(--space-2));
		padding: var(--space-1) var(--space-2);
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	:global([data-scope='drawer'][data-part='close-trigger'].desktop-close) {
		display: none;
		place-items: center;
		flex: none;
		border: 0;
		/* Not `background: none`: that would reset the shared hover tint (base.css). */
		background-color: transparent;
		color: inherit;
		cursor: pointer;
	}

	/*
	 * On a computer (a mouse and a wide window) a sheet sliding up from the bottom feels like
	 * a phone app (Trevor, 2026-10-16), so it opens as a centred panel with a Close button.
	 * Touch screens of any size keep the swipeable sheet.
	 */
	@media (hover: hover) and (pointer: fine) and (min-width: 48rem) {
		:global([data-scope='drawer'][data-part='positioner']) {
			align-items: center;
			padding: var(--space-5);
		}
		:global([data-scope='drawer'][data-part='content']) {
			width: min(100%, calc(36 * var(--u)));
			max-height: min(85dvh, 100%);
			padding: var(--space-4) var(--space-5) var(--space-5);
			border: var(--card-border);
			border-radius: var(--card-radius);
		}
		:global([data-scope='drawer'][data-part='content'][data-wide]) {
			width: min(100%, calc(60 * var(--u)));
		}
		:global([data-scope='drawer'][data-part='content'][data-state='open']) {
			animation: sheet-pop-in var(--duration-normal) var(--ease-out);
		}
		:global([data-scope='drawer'][data-part='content'][data-state='closed']) {
			animation: sheet-fade-out var(--duration-fast) var(--ease-in) forwards;
		}
		:global([data-scope='drawer'][data-part='grabber']) {
			display: none;
		}
		:global([data-scope='drawer'][data-part='close-trigger'].desktop-close) {
			display: grid;
		}
		header {
			align-items: center;
			touch-action: auto;
		}
	}

	@keyframes -global-sheet-pop-in {
		from {
			opacity: 0;
			transform: scale(0.97);
		}
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
