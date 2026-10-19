/**
 * Splits one line of JSON into coloured pieces for FileView (Trevor, 2026-10-19: "since mode
 * files are json, please color appropriate fields"). Our own small tokenizer: JSON has five
 * kinds of piece, so a highlighting library would add weight for nothing. Lines are coloured
 * one at a time, which is safe because a JSON string can't hold a raw line break. Anything it
 * doesn't recognise stays plain, so broken JSON still shows as written.
 */
export type JsonTokenKind = 'key' | 'string' | 'number' | 'literal' | 'punctuation' | 'plain';

export interface JsonToken {
	kind: JsonTokenKind;
	text: string;
}

const PIECE =
	/("(?:[^"\\]|\\.)*")(?=\s*:)|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g;

export function jsonLineTokens(line: string): JsonToken[] {
	const out: JsonToken[] = [];
	const push = (kind: JsonTokenKind, text: string) => {
		const last = out.at(-1);
		if (last?.kind === kind) last.text += text;
		else out.push({ kind, text });
	};
	let at = 0;
	for (const match of line.matchAll(PIECE)) {
		if (match.index > at) push('plain', line.slice(at, match.index));
		const [text, key, string, number, literal] = match;
		push(
			key ? 'key' : string ? 'string' : number ? 'number' : literal ? 'literal' : 'punctuation',
			text
		);
		at = match.index + text.length;
	}
	if (at < line.length) push('plain', line.slice(at));
	return out;
}
