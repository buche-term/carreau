// Names made up on the spot, for what needs one at once (a new group: its name can be
// edited right away).

const ADJECTIVES = "amber brisk calm dusky eager fuzzy gentle hazy icy jolly keen lucid mellow nimble olive plucky quiet rusty sunny tidy vivid witty".split(" ");
const NOUNS = "badger comet delta ember falcon grove harbor island lantern meadow nebula otter pebble quartz river sparrow thicket willow yarrow zephyr".split(" ");

/** A name, quickly: two words at random ("brisk-otter"). */
export function randomName(): string {
  const pick = (words: string[]) => words[Math.floor(Math.random() * words.length)];
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}`;
}
