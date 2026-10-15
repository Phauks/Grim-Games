/** A run of info-token text, bold or plain. */
export interface TextRun {
	text: string;
	bold: boolean;
}

/**
 * Splits custom info-token text on `**bold**` markers, the way Pocket Grimoire's custom
 * cards work (01-pocket-grimoire-analysis.md). Rendered as text nodes, never as HTML. An
 * unclosed `**` is kept as typed.
 */
export function parseBold(source: string): TextRun[] {
	const runs: TextRun[] = [];
	const push = (text: string, bold: boolean) => {
		if (!text) return;
		const last = runs.at(-1);
		if (last && last.bold === bold) last.text += text;
		else runs.push({ text, bold });
	};
	let rest = source;
	for (;;) {
		const open = rest.indexOf('**');
		const close = open < 0 ? -1 : rest.indexOf('**', open + 2);
		if (close < 0) {
			push(rest, false);
			return runs;
		}
		push(rest.slice(0, open), false);
		push(rest.slice(open + 2, close), true);
		rest = rest.slice(close + 2);
	}
}

/** The text without its `**` markers, for labels and accessible names. */
export function plainText(source: string): string {
	return parseBold(source)
		.map((run) => run.text)
		.join('');
}
