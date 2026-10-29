/**
 * A character's signature for one night from its ability text (L74): the features
 * `bands.ts` reads, found by the words official abilities use ("choose a player",
 * "poisoned", "they die", "you start knowing"). Setup text in brackets only counts on the
 * first night, for a Demon that sets up its Minions. Homebrew characters have only their
 * text, so it is what places them; `bands.test.ts` measures how often it picks the band
 * the official characters really sit in.
 */
import type { Night } from './bands.ts';

export function textSignature(ability: string, type: string, night: Night): Set<string> {
	const first = night === 'firstNight';
	const setup = (ability.match(/\[(.*?)\]/g) ?? []).join(' ').toLowerCase();
	let sentences = ability
		.replace(/\[.*?\]/g, '')
		.toLowerCase()
		.replace(/even if (you are )?drunk (or|&) poisoned/g, '')
		.split(/(?<=\.)\s+/);
	// The first night: no kills from "each night*", nothing that waited for today or a death.
	if (first)
		sentences = sentences.filter(
			(x) =>
				!/each night\*|today|if you die|when you die|if you died|previously|if the demon kills/.test(
					x
				)
		);
	const t = sentences.join(' ');
	const out = new Set<string>([`type:${type}`]);
	const has = (re: RegExp) => re.test(t);
	if (has(/at night|each night|you start knowing|1st night|tonight/)) out.add('when:night');
	if (has(/if you die|when you die|if you died|when you learn that you died/))
		out.add('when:death');
	if (has(/if the demon (dies|kills)|when (a|the) (minion|demon|player)|if a .* dies/))
		out.add('when:event');
	if (has(/might die at any time/)) out.add('who:kill-self').add('when:always');
	const chooses = has(/choose (a|an|\d+|2|3) ?(alive|living|dead|good|evil)? ?players?/);
	if (chooses) out.add('choose:player');
	if (has(/choose (a|an) (good |evil )?character/)) out.add('choose:character');
	if (has(/poison|drunk/)) out.add('do:impair');
	if (has(/safe from|protect|survives?|(don't|do not) die/)) out.add('do:protect');
	if (has(/: they die|a player (might )?dies|they die tonight/))
		out.add(chooses ? 'who:kill-chosen' : 'who:kill-another-player');
	if (has(/you die/) && has(/at night|tonight|each night/)) out.add('who:kill-self');
	if (has(/learn|start knowing|you know|are told|you see/)) out.add('do:learn');
	if (has(/grimoire/)) out.add('info:grimoire');
	if (has(/bluff/)) out.add('info:bluffs');
	if (has(/minions? (know|learn)/)) out.add('to:each-minion');
	if (has(/(the )?demon (knows|learns)/)) out.add('to:the-demon');
	if (has(/all players (know|learn)|everyone (knows|learns)/)) out.add('to:each-player');
	if (has(/(becomes?|turns?) (evil|good|a |an |the |their )|change(s)? (character|alignment)|swap/))
		out.add('do:become').add(chooses ? 'who:become-chosen' : 'who:become-self');
	if (has(/which (minions|demon)/)) out.add('who:become-the-demon');
	if (has(/(you )?(gain|have|has) (a|an|that|the|their|all) [a-z ]*abilit/) && !has(/no ability/))
		out.add('do:gain-ability');
	if (has(/do not know what your ability/)) out.add('do:gain-ability').add('when:always');
	if (has(/no ability|lose (their|your) ability/)) out.add('do:lose-ability');
	if (has(/does(n't| not) kill|can't kill|no one dies|nobody dies/)) out.add('do:stop-kills');
	if (has(/demon/) && has(/does(n't| not) wake/)) out.add('who:skip-waking-the-demon');
	if (has(/back to life|resurrect/)) out.add('do:resurrect');
	if (has(/\bmad\b/)) out.add('do:madness');
	if (has(/you think you are (a|the) demon/)) out.add('believe:demon').add('do:believe');
	else if (has(/think you are/)) out.add('do:believe');
	if (
		has(/(minions? (&|and) demon|evil) (learn|know)|thinks you are|(do not|don't) know each other/)
	)
		out.add('do:evil-info');
	if (has(/open your eyes/)) out.add('info:watches-night');
	if (has(/storyteller (decides|may|chooses)|\bwish\b/)) out.add('do:storyteller');
	// Setup changes in brackets: a Demon that sets up its Minions does so before anyone wakes.
	if (first && type === 'demon' && /minion/.test(setup)) out.add('do:become').add('when:setup');
	if (first && has(/in play/) && has(/start knowing/)) out.add('when:setup');
	if (first && out.has('to:each-player') && !chooses) out.add('when:setup');
	return out;
}
