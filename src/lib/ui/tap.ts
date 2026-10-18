/**
 * Board tokens open on `pointerup`, because browsers drop the `click` of a tap that lands
 * just after a swipe. The same tap's `click` still comes afterwards, and when the tap
 * opened a dialog it can land on whatever now sits under the finger (a character's info
 * button, a glossary term). Call this when a pointerup opens something: the one click that
 * follows outside the tapped element is swallowed. A click on the tapped element is that tap's
 * own (browsers that keep pointer capture send it there) and passes untouched. A new
 * pointerdown ends the wait: that tap's click is gone or never came, and the next tap's own
 * click must not be swallowed (a quick tap on the opened sheet's ⋯ was lost).
 */
const WINDOW_MS = 500;

export function swallowNextClick(tapped: EventTarget | null): void {
	if (typeof window === 'undefined') return;
	const stop = (event: MouseEvent) => {
		if (tapped instanceof Node && event.target instanceof Node && tapped.contains(event.target))
			return;
		done();
		event.preventDefault();
		event.stopImmediatePropagation();
	};
	const timer = setTimeout(() => done(), WINDOW_MS);
	function done() {
		clearTimeout(timer);
		window.removeEventListener('click', stop, true);
		window.removeEventListener('pointerdown', done, true);
	}
	window.addEventListener('click', stop, true);
	window.addEventListener('pointerdown', done, true);
}
