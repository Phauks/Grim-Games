/**
 * Whether a dialog or sheet is open over the page. A moving background behind the board
 * holds still while one is, since it is blurred and dimmed out of sight and would only spend
 * the battery. One watcher serves every background.
 */
const OPEN =
	"[data-scope='dialog'][data-part='backdrop'][data-state='open'], [data-scope='drawer'][data-part='backdrop'][data-state='open']";

let open = $state(false);
let users = 0;
let observer: MutationObserver | undefined;

const check = () => (open = !!document.querySelector(OPEN));

/** Starts watching while the calling component lives (call it in an effect). */
export function watchOverlays(): () => void {
	if (users++ === 0) {
		observer = new MutationObserver(check);
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['data-state']
		});
		check();
	}
	return () => {
		if (--users === 0) {
			observer?.disconnect();
			observer = undefined;
		}
	};
}

export const overlayOpen = (): boolean => open;
