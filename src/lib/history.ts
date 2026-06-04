/**
 * The educational layer — real, citable history, woven in as discoverable
 * "intercept" notes (one per night) plus accurate cipher explainers and an
 * end-of-game "about" panel. Sourced from Bletchley Park, IWM, Hodges, and the
 * 2025 Turing-test studies. Tone: factual, quiet, period. The 1952 prosecution
 * and 1954 death are stated plainly and never sensationalised; the cause of
 * death is left unresolved, as the inquest did. (Research-checked 2026-06-04.)
 */

/** What each cipher actually is — you learn how it works while you solve it. */
export const CIPHER_LEARN: Record<string, string> = {
  caesar: 'Caesar cipher: every letter shifts by the same fixed amount. Crack one letter and you have cracked them all.',
  substitution: 'Substitution cipher: each letter maps to one other letter. English letter frequencies (e, t, a, o) are the way in.',
  vigenere: 'Vigenère cipher: a keyword repeats over the message, each letter shifting by a different amount. Unbreakable-seeming until you find the key length, then it is just stacked Caesars.',
};

/** One discoverable history note per night. Diegetic, short, accurate. */
export const INTERCEPTS: string[] = [
  '1936. A mathematician describes a single machine that could compute anything any machine could. He calls it universal. No such machine exists yet.',
  'Enigma was first broken by Polish mathematicians in the 1930s. They handed Britain the method weeks before the war.',
  'At Bletchley Park they built the Bombe: a machine to undo a machine. It did not decrypt. It ruled out the millions of settings that could not be right.',
  '1950. A paper asks whether machines can think, and proposes a test. A hidden interrogator must decide who is human from written words alone.',
  'The test had an older form: a man, in writing, trying to pass as a woman. Passing was always part of it.',
  'Enigma re-set itself every keypress. 17,576 wirings before a rotor pattern repeated. Frequency analysis alone could never touch it.',
  '1952. He reported a burglary. The police asked who else had been in the house. He answered honestly, and was prosecuted for who he loved.',
  '1954. He died that June. The inquest said cyanide. His mother believed it an accident. It was never truly settled.',
];

export const interceptFor = (turn: number) => INTERCEPTS[(turn - 1) % INTERCEPTS.length];

export interface AboutLink {
  label: string;
  url: string;
}

export const ABOUT = {
  body: [
    'Alan Turing imagined the computer before one existed, helped break Enigma at Bletchley Park, and in 1950 asked a simple, enormous question: can machines think?',
    'In 1952 he was prosecuted for being a gay man and forced to undergo chemical castration. He died in June 1954. In 2009 the British government apologised; in 2013 he was pardoned; in 2017 the "Turing law" pardoned thousands more men convicted under the same statutes; in 2021 his face appeared on the Bank of England £50 note.',
    'The test he proposed as a thought experiment in 1950 was, by some measures, passed by a large language model in 2025. The question he actually cared about, whether a machine can think, is no closer to an answer.',
    'This game is a small, sincere tribute. It is an allegory, not his story.',
  ],
  links: [
    { label: 'Bletchley Park', url: 'https://bletchleypark.org.uk' },
    { label: 'Andrew Hodges, Alan Turing: The Enigma', url: 'https://www.turing.org.uk' },
    { label: 'LLMs and the Turing test (2025)', url: 'https://arxiv.org/abs/2503.23674' },
    { label: 'Stonewall', url: 'https://www.stonewall.org.uk' },
  ] as AboutLink[],
};
