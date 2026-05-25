/* Shared game data — used by both manual and game */
window.CLASSES = [
    { name: "THE CLOWN", desc: "Ghosts you Haunt cannot be Banished by Numbers, only Face or Cleanse (7)." },
    { name: "THE CRYPTKEEPER", desc: "Play a card face-down in your Shadow as a Wall (costs your whole turn, your one action). When someone Haunts you, you may discard one Wall: that ghost and the Wall both go to The Dark (the ghost never lands on your Shadow)." },
    { name: "THE CROW", desc: "If a neighbour Burns a Face card (to the top of The Dark), you may add it to your hand instead." },
    { name: "THE DOOMREADER", desc: "Once per turn (Ability; does not use your Ritual action): discard 1 card to The Dark to banish one ghost from your Shadow to The Dark (no Banish check; no Siphon)." },
    { name: "THE EXORCIST", desc: "Your 7 (Cleanse) banishes 2 Ghosts from your Shadow. You always Siphon both to the bottom of your Candle (♠ cannot be Siphoned)." },
    { name: "THE EXTORTIONER", desc: "When you play a 6 (Sight), take 3 cards from that neighbour's hand instead of 2." },
    { name: "THE FUNERAL BELL", desc: "When a player dies, each other remaining player Burns 2 cards. You are not affected." },
    { name: "THE GATEKEEPER", desc: "You are immune to Ghosts being moved into your Shadow (Mirror/Possess)." },
    { name: "THE GRAVEDIGGER", desc: "When a neighbour dies, add their remaining Candle to the bottom of yours." },
    { name: "THE GRIMOIRE OF REJECTION", desc: "Ability (not your Ritual action): Secretly write a card name. Reveal to cancel a neighbour's play of that card only; cannot be Salted. Locked until it triggers, then write anew. Same name cannot follow itself (Ace, 5, Ace is fine)." },
    { name: "THE HEX", desc: "When a neighbour Haunts you with a number card, you may reveal a matching rank from hand. Your card goes to The Dark; their Haunt becomes a ghost in their Shadow instead of yours." },
    { name: "THE HOARDER", desc: "Hand Limit is 8 (instead of 5)." },
    { name: "THE INQUISITOR", desc: "As your action, you may discard 1 card to the top of The Dark to choose a neighbour; they reveal their hand. If they reveal a Face Card, they must Burn 3 (to the top of The Dark)." },
    { name: "THE LEECH", desc: "When you Banish a Ghost, you always Siphon it. (Spades are still banished to The Dark)." },
    { name: "THE LICH", desc: "The first time you die, steal the top 3 cards from each living player's Candle to your hand to revive." },
    { name: "THE MEDDLER", desc: "When you Haunt a neighbour, you may put the top card of their Candle on the bottom of their Candle (you see it; they don't)." },
    { name: "THE MIME", desc: "When a neighbour Haunts you, you may discard 1 to The Dark to redirect that Ghost to your other neighbour's Shadow." },
    { name: "THE MIMIC", desc: "Once per game, use Ability (does not use your Ritual action): choose a neighbour and swap your Candle with theirs. Cannot be prevented by Salt." },
    { name: "THE OCCULTIST", desc: "Your 9 (Possess) can choose any player, not just neighbours. When you Possess to a non-neighbour, add 2 cards from the top of The Dark to the bottom of your Candle (once per turn)." },
    { name: "THE ORACLE", desc: "At the start of your turn (before the Haunting), peek at the top card of your Candle. Leave it on top or move it to the bottom." },
    { name: "THE PLAGUE", desc: "If a Ghost you Haunted is Banished (not Siphoned), it spreads to a neighbour of the Banisher instead of The Dark. Each time it is Banished again, it passes to one of that player's neighbours. A plagued Ghost cannot visit the same player twice; when it cannot spread, it goes to The Dark. You cannot receive your own plagued Ghosts." },
    { name: "THE PRIEST", desc: "When you Banish a Ghost, take the top card of The Dark into your hand before your Banish card and the banished Ghost are added to The Dark." },
    { name: "THE PYROMANIAC", desc: "Discard a Red card to the top of The Dark to choose a neighbour; they Burn 2 cards (to the top of The Dark). Once per turn; counts as your action." },
    { name: "THE RAVENOUS", desc: "When you Cast Greed (2), you may steal 2 cards from the chosen player's hand instead of them drawing from their Candle." },
    { name: "THE REAPER", desc: "When a neighbour Banishes a Ghost from their Shadow without Siphoning (Ghost goes to The Dark), you may add that Ghost to the bottom of your Candle instead." },
    { name: "THE SADIST", desc: "When you play a 3 (Scare), your chosen neighbour discards 3 cards to The Dark (you pick which; they do not choose)." },
    { name: "THE SEALBINDER", desc: "Ghosts you Haunt cannot be moved (Possess, Mirror) or returned (Recall)." },
    { name: "THE SILENCE", desc: "Your actions cannot be interrupted by Salt (5), including when you play BOO! (Joker)." },
    { name: "THE SKEPTIC", desc: "Immune to 4s (Drain)." },
    { name: "THE SUFFERER", desc: "You need 4 ghosts of the same suit in your Shadow to be Possessed (instead of 3)." },
    { name: "THE UNSEEN", desc: "When a neighbour would Haunt you, you may discard 1 card to the top of The Dark to cancel the Haunt (both cards to the top of The Dark)." },
    { name: "THE USURER", desc: "As your action, choose a neighbour; take 2 cards from their hand, then they Draw 1 from their Candle." },
    { name: "THE VESSEL", desc: "The first Ghost in your Shadow does not cause you to Burn (you still Burn for the rest)." },
    { name: "THE VOODOO DOLL", desc: "Each Haunting: for each ♣ or ♦ ghost in your Shadow that was Haunted onto you (tracked haunter), that haunter Burns 1. Spades and Hearts do not reflect. Mirror/Possess keep the original haunter if the ghost returns." },
    { name: "THE VULTURE", desc: "When a neighbour dies, add the top 5 cards from The Dark to the bottom of your Candle." },
    { name: "THE WARLOCK", desc: "You may Haunt with a face card or Joker instead of Summoning it. Each counts as strength 10." },
    { name: "THE WATCHER", desc: "When you cast a 6 (Sight), you see both neighbours' hands and may take up to 2 cards from each (4 total)." },
    { name: "THE WITNESS", desc: "You may not win the game. If you are alive when only one player remains, they also lose." }
];

window.SUITS = ['♠', '♥', '♣', '♦'];
window.RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

window.getVal = function (r) {
    return { 'A': 1, 'J': 11, 'Q': 12, 'K': 13 }[r] || parseInt(r, 10);
};

/** Returns base filename for a class card image (e.g. "THE PRIEST" -> "deathwick_priest"). */
window.getClassImageFilename = function (className) {
    if (!className) return null;
    var slug = className.replace(/^THE\s+/i, '').toLowerCase().replace(/\s+/g, '_');
    return 'deathwick_' + slug;
};

/** Returns subfolder under images/cards/classes/ for a class image filename (a-c, d-f, g-i, j-l, m-o, p-r, s-u, v-z). */
window.getClassSubfolder = function (classImageFilename) {
    if (!classImageFilename || typeof classImageFilename !== 'string') return '';
    var slug = classImageFilename.replace(/^deathwick_/, '');
    var c = slug.charAt(0).toLowerCase();
    if (c >= 'a' && c <= 'c') return 'a-c';
    if (c >= 'd' && c <= 'f') return 'd-f';
    if (c >= 'g' && c <= 'i') return 'g-i';
    if (c >= 'j' && c <= 'l') return 'j-l';
    if (c >= 'm' && c <= 'o') return 'm-o';
    if (c >= 'p' && c <= 'r') return 'p-r';
    if (c >= 's' && c <= 'u') return 's-u';
    if (c >= 'v' && c <= 'z') return 'v-z';
    return '';
};
