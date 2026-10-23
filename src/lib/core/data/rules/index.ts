/**
 * Our rules blocks for official characters, one file per character (see
 * `../character-rules.ts`). A new file is one more import line here; a test checks that every
 * file in this folder is listed and agrees with `roles.json`.
 */
import type { CharacterId } from '../types.ts';
import { parseCharacterRules, type CharacterRules } from '../character-rules.ts';
import { Issues } from '../validate.ts';
import acrobat from './acrobat.json' with { type: 'json' };
import alchemist from './alchemist.json' with { type: 'json' };
import alhadikhia from './alhadikhia.json' with { type: 'json' };
import alsaahir from './alsaahir.json' with { type: 'json' };
import amnesiac from './amnesiac.json' with { type: 'json' };
import angel from './angel.json' with { type: 'json' };
import apprentice from './apprentice.json' with { type: 'json' };
import artist from './artist.json' with { type: 'json' };
import assassin from './assassin.json' with { type: 'json' };
import atheist from './atheist.json' with { type: 'json' };
import balloonist from './balloonist.json' with { type: 'json' };
import banshee from './banshee.json' with { type: 'json' };
import barber from './barber.json' with { type: 'json' };
import barista from './barista.json' with { type: 'json' };
import bishop from './bishop.json' with { type: 'json' };
import bonecollector from './bonecollector.json' with { type: 'json' };
import bootlegger from './bootlegger.json' with { type: 'json' };
import bountyhunter from './bountyhunter.json' with { type: 'json' };
import bureaucrat from './bureaucrat.json' with { type: 'json' };
import butler from './butler.json' with { type: 'json' };
import cacklejack from './cacklejack.json' with { type: 'json' };
import cannibal from './cannibal.json' with { type: 'json' };
import cerenovus from './cerenovus.json' with { type: 'json' };
import chef from './chef.json' with { type: 'json' };
import clockmaker from './clockmaker.json' with { type: 'json' };
import courtier from './courtier.json' with { type: 'json' };
import cultleader from './cultleader.json' with { type: 'json' };
import damsel from './damsel.json' with { type: 'json' };
import deusexfiasco from './deusexfiasco.json' with { type: 'json' };
import devilsadvocate from './devilsadvocate.json' with { type: 'json' };
import drunk from './drunk.json' with { type: 'json' };
import duchess from './duchess.json' with { type: 'json' };
import empath from './empath.json' with { type: 'json' };
import engineer from './engineer.json' with { type: 'json' };
import eviltwin from './eviltwin.json' with { type: 'json' };
import exorcist from './exorcist.json' with { type: 'json' };
import fanggu from './fanggu.json' with { type: 'json' };
import farmer from './farmer.json' with { type: 'json' };
import fearmonger from './fearmonger.json' with { type: 'json' };
import fibbin from './fibbin.json' with { type: 'json' };
import fiddler from './fiddler.json' with { type: 'json' };
import fisherman from './fisherman.json' with { type: 'json' };
import flowergirl from './flowergirl.json' with { type: 'json' };
import fool from './fool.json' with { type: 'json' };
import fortuneteller from './fortuneteller.json' with { type: 'json' };
import gambler from './gambler.json' with { type: 'json' };
import gnome from './gnome.json' with { type: 'json' };
import goblin from './goblin.json' with { type: 'json' };
import godfather from './godfather.json' with { type: 'json' };
import godofug from './godofug.json' with { type: 'json' };
import golem from './golem.json' with { type: 'json' };
import goon from './goon.json' with { type: 'json' };
import gossip from './gossip.json' with { type: 'json' };
import grandmother from './grandmother.json' with { type: 'json' };
import harlot from './harlot.json' with { type: 'json' };
import harpy from './harpy.json' with { type: 'json' };
import hatter from './hatter.json' with { type: 'json' };
import hellslibrarian from './hellslibrarian.json' with { type: 'json' };
import heretic from './heretic.json' with { type: 'json' };
import hermit from './hermit.json' with { type: 'json' };
import huntsman from './huntsman.json' with { type: 'json' };
import imp from './imp.json' with { type: 'json' };
import innkeeper from './innkeeper.json' with { type: 'json' };
import investigator from './investigator.json' with { type: 'json' };
import judge from './judge.json' with { type: 'json' };
import juggler from './juggler.json' with { type: 'json' };
import kazali from './kazali.json' with { type: 'json' };
import klutz from './klutz.json' with { type: 'json' };
import knight from './knight.json' with { type: 'json' };
import legion from './legion.json' with { type: 'json' };
import leviathan from './leviathan.json' with { type: 'json' };
import librarian from './librarian.json' with { type: 'json' };
import lilmonsta from './lilmonsta.json' with { type: 'json' };
import lleech from './lleech.json' with { type: 'json' };
import lordoftyphon from './lordoftyphon.json' with { type: 'json' };
import lunatic from './lunatic.json' with { type: 'json' };
import lycanthrope from './lycanthrope.json' with { type: 'json' };
import marionette from './marionette.json' with { type: 'json' };
import mastermind from './mastermind.json' with { type: 'json' };
import mathematician from './mathematician.json' with { type: 'json' };
import mayor from './mayor.json' with { type: 'json' };
import mezepheles from './mezepheles.json' with { type: 'json' };
import minstrel from './minstrel.json' with { type: 'json' };
import monk from './monk.json' with { type: 'json' };
import moonchild from './moonchild.json' with { type: 'json' };
import nightwatchman from './nightwatchman.json' with { type: 'json' };
import noble from './noble.json' with { type: 'json' };
import nodashii from './nodashii.json' with { type: 'json' };
import ogre from './ogre.json' with { type: 'json' };
import ojo from './ojo.json' with { type: 'json' };
import oracle from './oracle.json' with { type: 'json' };
import organgrinder from './organgrinder.json' with { type: 'json' };
import philosopher from './philosopher.json' with { type: 'json' };
import pixie from './pixie.json' with { type: 'json' };
import plaguedoctor from './plaguedoctor.json' with { type: 'json' };
import po from './po.json' with { type: 'json' };
import poisoner from './poisoner.json' with { type: 'json' };
import politician from './politician.json' with { type: 'json' };
import poppygrower from './poppygrower.json' with { type: 'json' };
import preacher from './preacher.json' with { type: 'json' };
import princess from './princess.json' with { type: 'json' };
import professor from './professor.json' with { type: 'json' };
import pukka from './pukka.json' with { type: 'json' };
import puzzlemaster from './puzzlemaster.json' with { type: 'json' };
import ravenkeeper from './ravenkeeper.json' with { type: 'json' };
import recluse from './recluse.json' with { type: 'json' };
import revolutionary from './revolutionary.json' with { type: 'json' };
import riot from './riot.json' with { type: 'json' };
import sage from './sage.json' with { type: 'json' };
import sailor from './sailor.json' with { type: 'json' };
import saint from './saint.json' with { type: 'json' };
import savant from './savant.json' with { type: 'json' };
import scarletwoman from './scarletwoman.json' with { type: 'json' };
import seamstress from './seamstress.json' with { type: 'json' };
import shabaloth from './shabaloth.json' with { type: 'json' };
import slayer from './slayer.json' with { type: 'json' };
import snakecharmer from './snakecharmer.json' with { type: 'json' };
import soldier from './soldier.json' with { type: 'json' };
import spiritofivory from './spiritofivory.json' with { type: 'json' };
import spy from './spy.json' with { type: 'json' };
import steward from './steward.json' with { type: 'json' };
import stormcatcher from './stormcatcher.json' with { type: 'json' };
import summoner from './summoner.json' with { type: 'json' };
import sweetheart from './sweetheart.json' with { type: 'json' };
import tealady from './tealady.json' with { type: 'json' };
import thief from './thief.json' with { type: 'json' };
import tinker from './tinker.json' with { type: 'json' };
import towncrier from './towncrier.json' with { type: 'json' };
import toymaker from './toymaker.json' with { type: 'json' };
import undertaker from './undertaker.json' with { type: 'json' };
import ventriloquist from './ventriloquist.json' with { type: 'json' };
import vigormortis from './vigormortis.json' with { type: 'json' };
import villageidiot from './villageidiot.json' with { type: 'json' };
import virgin from './virgin.json' with { type: 'json' };
import vortox from './vortox.json' with { type: 'json' };
import washerwoman from './washerwoman.json' with { type: 'json' };
import widow from './widow.json' with { type: 'json' };
import witch from './witch.json' with { type: 'json' };
import wizard from './wizard.json' with { type: 'json' };
import xaan from './xaan.json' with { type: 'json' };
import yaggababble from './yaggababble.json' with { type: 'json' };
import zenomancer from './zenomancer.json' with { type: 'json' };
import zombuul from './zombuul.json' with { type: 'json' };

const FILES: Readonly<Record<CharacterId, unknown>> = {
	acrobat,
	alchemist,
	alhadikhia,
	alsaahir,
	amnesiac,
	angel,
	apprentice,
	artist,
	assassin,
	atheist,
	balloonist,
	banshee,
	barber,
	barista,
	bishop,
	bonecollector,
	bootlegger,
	bountyhunter,
	bureaucrat,
	butler,
	cacklejack,
	cannibal,
	cerenovus,
	chef,
	clockmaker,
	courtier,
	cultleader,
	damsel,
	deusexfiasco,
	devilsadvocate,
	drunk,
	duchess,
	empath,
	engineer,
	eviltwin,
	exorcist,
	fanggu,
	farmer,
	fearmonger,
	fibbin,
	fiddler,
	fisherman,
	flowergirl,
	fool,
	fortuneteller,
	gambler,
	gnome,
	goblin,
	godfather,
	godofug,
	golem,
	goon,
	gossip,
	grandmother,
	harlot,
	harpy,
	hatter,
	hellslibrarian,
	heretic,
	hermit,
	huntsman,
	imp,
	innkeeper,
	investigator,
	judge,
	juggler,
	kazali,
	klutz,
	knight,
	legion,
	leviathan,
	librarian,
	lilmonsta,
	lleech,
	lordoftyphon,
	lunatic,
	lycanthrope,
	marionette,
	mastermind,
	mathematician,
	mayor,
	mezepheles,
	minstrel,
	monk,
	moonchild,
	nightwatchman,
	noble,
	nodashii,
	ogre,
	ojo,
	oracle,
	organgrinder,
	philosopher,
	pixie,
	plaguedoctor,
	po,
	poisoner,
	politician,
	poppygrower,
	preacher,
	princess,
	professor,
	pukka,
	puzzlemaster,
	ravenkeeper,
	recluse,
	revolutionary,
	riot,
	sage,
	sailor,
	saint,
	savant,
	scarletwoman,
	seamstress,
	shabaloth,
	slayer,
	snakecharmer,
	soldier,
	spiritofivory,
	spy,
	steward,
	stormcatcher,
	summoner,
	sweetheart,
	tealady,
	thief,
	tinker,
	towncrier,
	toymaker,
	undertaker,
	ventriloquist,
	vigormortis,
	villageidiot,
	virgin,
	vortox,
	washerwoman,
	widow,
	witch,
	wizard,
	xaan,
	yaggababble,
	zenomancer,
	zombuul
};

function load(): ReadonlyMap<CharacterId, CharacterRules> {
	const issues = new Issues();
	const out = new Map<CharacterId, CharacterRules>();
	for (const [id, raw] of Object.entries(FILES)) {
		const rules = parseCharacterRules(raw, `rules/${id}.json`, issues);
		if (rules) out.set(id, rules);
	}
	issues.throwIfAny('character rules');
	return out;
}

/** Each official character's rules block, by id; characters with no file have none. */
export const OFFICIAL_RULES: ReadonlyMap<CharacterId, CharacterRules> = load();

/**
 * A character's rules block: a custom character's own `rules`, else our overlay file. A custom
 * character that reuses an official id without `rules` keeps the official block.
 */
export function rulesOf(
	characterId: CharacterId,
	characters?: ReadonlyMap<CharacterId, { rules?: CharacterRules }>
): CharacterRules | undefined {
	return characters?.get(characterId)?.rules ?? OFFICIAL_RULES.get(characterId);
}
