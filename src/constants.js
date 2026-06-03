window.NT = window.NT || {};

NT.constants = {
  ACTIVATION_MIN_OCCURRENCES: 5,
  FALLBACK_MIN_OCCURRENCES: 3,
  // News-path: lowest surname-reuse count that still warrants promoting a
  // single-mention full name (e.g. "Zach Kahler" intro + 2 "Mr. Kahler").
  NEWS_SURNAME_MIN_OCCURRENCES: 2,
  // Single-token-path: surname must appear at least this often standalone
  // to be promoted as its own entity when no multi-token full name exists
  // (e.g. articles that only say "Trump").
  SINGLE_TOKEN_MIN_OCCURRENCES: 5,
  // Common-noun filter: if a token appears as a lowercase word this many
  // times in the body, it's a common noun, not a name.
  LOWER_COMMON_NOUN_MIN: 2,
  // News-path spurious-token filter: drop ngrams where a non-last token
  // appears standalone more than this multiple of the ngram's own count.
  SPURIOUS_NON_LAST_RATIO: 2,
  MAX_NGRAM: 3,
  TOOLTIP_SHOW_DELAY_MS: 80,
  TOOLTIP_HIDE_DELAY_MS: 120,
  // MutationObserver re-wrap pacing.
  REWRAP_DEBOUNCE_MS: 300,
  REWRAP_SAFETY_DELAYS_MS: [500, 2000, 5000],
  REWRAP_MAX_PASSES: 30,
  SECTION_HEADING_RE: /cast|characters|voice cast|principal cast/i,
  // Universal noise + a few Wikipedia-flavor section words ("Plot", "Cast", ...).
  // The latter are harmless on news sites, kept here for simplicity.
  STOPWORDS: new Set([
    "The", "A", "An", "And", "Or", "But", "If", "As", "At", "By", "For", "In", "Of", "On", "To", "Up", "Is",
    "It", "He", "She", "They", "We", "I", "You", "His", "Her", "Their", "Our", "My", "Your", "Its",
    "This", "That", "These", "Those", "There", "Here", "Then", "Now", "When", "Where", "What", "Why", "How", "Who",
    "After", "Before", "During", "While", "Since", "Until", "Although", "Though", "Because", "However",
    "Meanwhile", "Later", "Soon", "Suddenly", "Eventually", "Finally", "First", "Next", "Once",
    // Title-case connectors (common in headlines, never proper nouns).
    "With", "Without", "Within", "From", "Into", "Onto", "Through", "Throughout",
    "Across", "Against", "Among", "Between", "About", "Around", "Above", "Below",
    "Beyond", "Past", "Toward", "Towards", "Over", "Under",
    // Modal / auxiliary verbs.
    "Was", "Were", "Will", "Can", "Could", "Would", "Should", "Might", "Must", "Shall",
    "Has", "Have", "Had", "Do", "Does", "Did",
    // High-frequency headline verbs.
    "Broke", "Says", "Calls", "Tells", "Plans", "Faces", "Names", "Makes", "Made",
    "Takes", "Took", "Gets", "Got", "Gives", "Gave", "Sees", "Saw", "Goes", "Went",
    "Wins", "Loses", "Hits", "Sets", "Adds", "Cuts", "Picks", "Drops", "Backs",
    "Sells", "Buys", "Targets", "Hires", "Fires", "Holds", "Keeps", "Leads",
    "Moves", "Pays", "Puts", "Sends", "Shows", "Stays", "Tries", "Turns", "Uses",
    "Wants", "Talks", "Speaks", "Spoke", "Joins",
    "January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December",
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    "Wikipedia", "English", "American", "British", "French", "German", "Russian", "Chinese",
    "Japanese", "Italian", "Spanish", "European", "African", "Asian",
    "United", "States", "America", "Britain", "England", "Europe", "Asia", "Africa",
    "London", "Paris", "York", "Hollywood", "California",
    "Plot", "Cast", "Synopsis", "Story", "Summary", "Characters",
    "Production", "Reception", "Release", "Music", "Soundtrack", "References", "Notes",
    "Mr", "Mrs", "Ms", "Dr", "Sir", "Lord", "Lady", "King", "Queen", "Prince", "Princess",
    "Don", "Father", "Mother", "Sister", "Brother", "Uncle", "Aunt", "Cousin",
    "Captain", "Lieutenant", "Sergeant", "Colonel", "Major", "General", "Admiral",
    "President", "Senator", "Officer", "Detective", "Inspector", "Agent",
    "Professor", "Reverend", "Saint", "God", "Doctor", "Mister",
    // Political bodies and institutional terms.
    "Senate", "Congress", "Republicans", "Democrats", "Republican", "Democrat",
    "Senators", "Lawmakers", "Officials", "Government", "Administration",
    "Department", "Justice", "Bureau", "Agency", "Court", "Council", "Committee",
    "Cabinet", "Pentagon", "Capitol",
    "National", "Federal", "Intelligence", "Defense", "Security", "Treasury",
    "Foreign", "Domestic",
    "Jr", "Sr",
    "Day", "Night", "Morning", "Evening", "Afternoon",
    "Christmas", "Halloween", "Easter", "Thanksgiving",
    "Earth", "Mars", "Sun", "Moon",
  ])
};
