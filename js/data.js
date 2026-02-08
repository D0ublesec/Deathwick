/* Shared game data — used by both manual and game */
window.CLASSES = [
    { name: "THE CLOWN", desc: "Ghosts you Haunt cannot be Banished by Numbers, only Face or Cleanse (7)." },
    { name: "THE CRYPTKEEPER", desc: "Play a card face-down in your Shadow as a Wall (costs your whole turn—your one action). When someone Haunts you, you may discard one Wall: that ghost and the Wall both go to The Dark (the ghost never lands on your Shadow)." },
    { name: "THE CROW", desc: "If a neighbour Burns a Face card (to the top of The Dark), you may add it to your hand instead." },
    { name: "THE DOOMREADER", desc: "Up to once per turn, you may discard 1 card to The Dark to change the suit of a Ghost in your Shadow." },
    { name: "THE EXORCIST", desc: "Your 7 (Cleanse) destroys 2 Ghosts from your Shadow. You may Siphon only one (to the bottom of your Candle); the other goes to the top of The Dark." },
    { name: "THE EXTORTIONER", desc: "When you play a 6 (Claim), steal 2 cards from that neighbour to your hand instead of 1." },
    { name: "THE FUNERAL BELL", desc: "When a player dies, each other remaining player Burns 1 card. You are not affected." },
    { name: "THE GATEKEEPER", desc: "You are immune to Ghosts being moved into your Shadow (Mirror/Possess)." },
    { name: "THE GRAVEDIGGER", desc: "When a neighbour dies, add their remaining Candle to the bottom of yours." },
    { name: "THE GRIMOIRE OF REJECTION", desc: "Once per turn, you may write down the name of a card and keep it hidden. When a player plays that card, reveal it and cancel the play. Cannot write down the same card each turn. Does not count as an action." },
    { name: "THE HEX", desc: "Once per turn, when a neighbour plays a number card to Haunt you, you may reveal a matching rank from hand to cancel it (both cards go to The Dark)." },
    { name: "THE HOARDER", desc: "Hand Limit is 8 (instead of 5)." },
    { name: "THE INQUISITOR", desc: "As your action, you may discard 1 card to the top of The Dark to choose a neighbour; they reveal their hand. If they reveal a Face Card, they must Burn 2 (to the top of The Dark)." },
    { name: "THE LEECH", desc: "When you Banish a Ghost, you always Siphon it. (Spades are still destroyed)." },
    { name: "THE LICH", desc: "The first time you die, steal the top 2 cards from each living player's Candle to your hand to revive." },
    { name: "THE MEDDLER", desc: "When you Haunt a neighbour, you may put the top card of their Candle on the bottom of their Candle (you see it; they don't)." },
    { name: "THE MIME", desc: "When a neighbour Haunts you, you may discard 1 to The Dark to redirect that Ghost to your other neighbour's Shadow." },
    { name: "THE MIMIC", desc: "Once per game, choose a neighbour; swap your Candle with theirs." },
    { name: "THE OCCULTIST", desc: "Your 9 (Possess) can choose any player, not just neighbours. When you Possess to a non-neighbour, add 1 card from the top of The Dark to the bottom of your Candle." },
    { name: "THE ORACLE", desc: "Precognition: Once per turn at the start of your turn (before Burning), you may look at the top card of your Candle and put it on top or on the bottom." },
    { name: "THE PLAGUE", desc: "If a Ghost you Haunted is Banished, it moves to your other neighbour's Shadow instead of The Dark. You cannot receive Ghosts from this effect (they go to The Dark instead)." },
    { name: "THE PRIEST", desc: "When you Banish a Ghost, you may draw 1 card. (Does not trigger on Siphon)." },
    { name: "THE PYROMANIAC", desc: "Discard a Red card to the top of The Dark to choose a neighbour; they Burn 2 cards (to the top of The Dark). Once per turn; counts as your action." },
    { name: "THE RAVENOUS", desc: "When you play a 2 (Greed), you may choose a neighbour and steal 1 card from their hand to yours instead of drawing." },
    { name: "THE REAPER", desc: "When a neighbour Banishes a Ghost from their Shadow without Siphoning (Ghost goes to The Dark), you may add that Ghost to the bottom of your Candle instead." },
    { name: "THE SADIST", desc: "When you play a 3 (Scare), your chosen neighbour discards 2 cards to The Dark (you blindly pick which; they do not choose)." },
    { name: "THE SEALBINDER", desc: "Ghosts you Haunt cannot be moved (Possess) or returned (Recall)." },
    { name: "THE SILENCE", desc: "Your actions cannot be interrupted by Salt (5)." },
    { name: "THE SKEPTIC", desc: "Immune to 4s (Drain)." },
    { name: "THE SUFFERER", desc: "When taking Damage during The Haunting, you may Draw 1 Card." },
    { name: "THE UNSEEN", desc: "Once per turn, when a neighbour would Haunt you, you may discard 1 card to the top of The Dark to cancel the Haunt (both cards to the top of The Dark)." },
    { name: "THE USERER", desc: "Discard 1 to The Dark to choose a neighbour; look at their hand and swap 1 card with theirs (one to your hand, one to theirs). Once per turn; counts as your action." },
    { name: "THE VESSEL", desc: "The first Ghost in your Shadow does not cause you to Burn (you still Burn for the rest)." },
    { name: "THE VOODOO DOLL", desc: "When you are forced to Burn cards by a Haunt, the attacker must Burn the same amount." },
    { name: "THE VULTURE", desc: "When a neighbour dies, add up to 5 random cards from The Dark to the bottom of your Candle." },
    { name: "THE WARLOCK", desc: "You can use Face Cards to Haunt (Strength 10) instead of Summon. *Note: 10♠ can banish a J♠, Q♠ and K♠ haunted by you.*" },
    { name: "THE WATCHER", desc: "When you cast an Ace (Sight), you see both neighbours' hands (instead of choosing one)." },
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
