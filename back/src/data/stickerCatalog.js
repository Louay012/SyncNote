// ─── Sticker Catalog ──────────────────────────────────────────────────────────
// Emoji-based & themed sticker packs for diary pages.
// Each sticker has: id, group, label, emoji/src, tags for search

const EMOJI_STICKERS = [
  // ── Nature & Animals ──
  ...["🌸","🌺","🌻","🌷","🌹","🌿","🍀","🌵","🌴","🌲","🍁","🌾","🌸","🌼","🌻","🌷"].map((e,i) => ({
    id: `emoji-nature-${i}`, group: "nature", label: e, emoji: e, tags: ["nature","flower","plant","cute"]
  })),
  ...["🐱","🐶","🐰","🦊","🐼","🐨","🦁","🐯","🐸","🐵","🦄","🐴","🐝","🦋","🐌","🐞","🐧","🦉","🐺","🦌"].map((e,i) => ({
    id: `emoji-animal-${i}`, group: "animals", label: e, emoji: e, tags: ["animal","pet","cute","kawaii"]
  })),
  ...["🌟","⭐","🌙","☀️","🌈","☁️","❄️","🌊","🔥","🌪️","🌍","🌕","🌛","✨","💫","⭐"].map((e,i) => ({
    id: `emoji-sky-${i}`, group: "sky", label: e, emoji: e, tags: ["sky","star","moon","sun","weather","nature"]
  })),

  // ── Hearts & Emotions ──
  ...["❤️","💕","💗","💖","💓","🩷","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💝","💘","💞"].map((e,i) => ({
    id: `emoji-heart-${i}`, group: "hearts", label: e, emoji: e, tags: ["heart","love","emotion","romance","kawaii"]
  })),
  ...["😊","🥰","😍","🤩","😌","😇","🥹","😢","😭","😤","😡","🥳","🤗","😴","🥺","😅","😂","🤣","🙂","😏"].map((e,i) => ({
    id: `emoji-face-${i}`, group: "faces", label: e, emoji: e, tags: ["face","emotion","mood","expression"]
  })),

  // ── Food & Drink ──
  ...["🍎","🍊","🍋","🍇","🍓","🍑","🍒","🥝","🍕","🍔","🌮","🍦","🍩","🍪","🧁","🍫","🍿","🥐","☕","🧋","🍵","🧃"].map((e,i) => ({
    id: `emoji-food-${i}`, group: "food", label: e, emoji: e, tags: ["food","drink","sweet","cute","snack"]
  })),

  // ── Objects & Stationery ──
  ...["📕","📗","📘","📙","📚","📖","✏️","🖊️","🖋️","✒️","🖌️","📝","📎","📌","✂️","🔖","🏷️","🎨","🧵","🪡"].map((e,i) => ({
    id: `emoji-object-${i}`, group: "objects", label: e, emoji: e, tags: ["stationery","book","write","art","craft"]
  })),

  // ── Symbols & Decorations ──
  ...["✦","✧","◆","◇","♡","♥","♤","♧","♢","♣","♦","★","☆","✶","✹","❀","✿","❁","✾","🌱","🌿","☘️","🍃","🎀","✨","💫","🎈","🎉","🎊","🎁","🏆","🥇","🕊️","🪶","🎵","🎶","🎤","🎧","🎼","🎹","🌈","⚡","💎","🔮","🪄","🧿","🎯","🧩","🎲","♟️","🃏","🀄"].map((e,i) => ({
    id: `emoji-symbol-${i}`, group: "symbols", label: e, emoji: e, tags: ["symbol","decoration","star","diamond","sparkle"]
  })),
];

// ─── Themed Sticker Packs ──────────────────────────────────────────────────────
const THEMED_STICKER_PACKS = {
  kawaii: {
    id: "pack-kawaii",
    label: "Kawaii",
    icon: "♡",
    stickers: [
      { id: "kawaii-cat", label: "Kawaii Cat", emoji: "🐱", tags: ["kawaii","cat","pet"] },
      { id: "kawaii-bunny", label: "Kawaii Bunny", emoji: "🐰", tags: ["kawaii","bunny","pet"] },
      { id: "kawaii-bear", label: "Kawaii Bear", emoji: "🐻", tags: ["kawaii","bear"] },
      { id: "kawaii-panda", label: "Kawaii Panda", emoji: "🐼", tags: ["kawaii","panda"] },
      { id: "kawaii-fox", label: "Kawaii Fox", emoji: "🦊", tags: ["kawaii","fox"] },
      { id: "kawaii-unicorn", label: "Kawaii Unicorn", emoji: "🦄", tags: ["kawaii","unicorn"] },
      { id: "kawaii-heart", label: "Kawaii Heart", emoji: "💖", tags: ["kawaii","heart"] },
      { id: "kawaii-star", label: "Kawaii Star", emoji: "✨", tags: ["kawaii","star"] },
      { id: "kawaii-cupcake", label: "Kawaii Cupcake", emoji: "🧁", tags: ["kawaii","food","sweet"] },
      { id: "kawaii-rainbow", label: "Kawaii Rainbow", emoji: "🌈", tags: ["kawaii","rainbow"] },
    ],
  },
  retro: {
    id: "pack-retro",
    label: "Retro Diner",
    icon: "☕",
    stickers: [
      { id: "retro-record", label: "Vinyl Record", emoji: "💿", tags: ["retro","music","record"] },
      { id: "retro-cassette", label: "Cassette", emoji: "📼", tags: ["retro","music","tape"] },
      { id: "retro-phone", label: "Retro Phone", emoji: "☎️", tags: ["retro","phone"] },
      { id: "retro-camera", label: "Retro Camera", emoji: "📷", tags: ["retro","camera"] },
      { id: "retro-tv", label: "Retro TV", emoji: "📺", tags: ["retro","tv"] },
      { id: "retro-radio", label: "Retro Radio", emoji: "📻", tags: ["retro","radio"] },
      { id: "retro-clock", label: "Retro Alarm", emoji: "⏰", tags: ["retro","clock"] },
      { id: "retro-coin", label: "Retro Coin", emoji: "🪙", tags: ["retro","coin"] },
      { id: "retro-joystick", label: "Retro Game", emoji: "🕹️", tags: ["retro","game"] },
      { id: "retro-film", label: "Film Reel", emoji: "🎞️", tags: ["retro","film","movie"] },
    ],
  },
  nature: {
    id: "pack-nature",
    label: "Nature Walk",
    icon: "🌿",
    stickers: [
      { id: "nature-leaf", label: "Green Leaf", emoji: "🌿", tags: ["nature","leaf","plant"] },
      { id: "nature-tree", label: "Tree", emoji: "🌳", tags: ["nature","tree"] },
      { id: "nature-flower1", label: "Pink Flower", emoji: "🌸", tags: ["nature","flower"] },
      { id: "nature-flower2", label: "Sunflower", emoji: "🌻", tags: ["nature","flower","sun"] },
      { id: "nature-mushroom", label: "Mushroom", emoji: "🍄", tags: ["nature","mushroom"] },
      { id: "nature-butterfly", label: "Butterfly", emoji: "🦋", tags: ["nature","butterfly"] },
      { id: "nature-ladybug", label: "Ladybug", emoji: "🐞", tags: ["nature","bug"] },
      { id: "nature-snail", label: "Snail", emoji: "🐌", tags: ["nature","snail"] },
      { id: "nature-sun", label: "Sun", emoji: "☀️", tags: ["nature","sun","weather"] },
      { id: "nature-rainbow", label: "Rainbow", emoji: "🌈", tags: ["nature","rainbow","sky"] },
    ],
  },
  pixel: {
    id: "pack-pixel",
    label: "Pixel Art",
    icon: "◆",
    stickers: [
      { id: "pixel-star", label: "Pixel Star", emoji: "⭐", tags: ["pixel","star","game"] },
      { id: "pixel-heart", label: "Pixel Heart", emoji: "❤️", tags: ["pixel","heart"] },
      { id: "pixel-coin", label: "Pixel Coin", emoji: "🪙", tags: ["pixel","coin","game"] },
      { id: "pixel-sword", label: "Pixel Sword", emoji: "⚔️", tags: ["pixel","sword","game"] },
      { id: "pixel-key", label: "Pixel Key", emoji: "🗝️", tags: ["pixel","key"] },
      { id: "pixel-crown", label: "Pixel Crown", emoji: "👑", tags: ["pixel","crown"] },
      { id: "pixel-gem", label: "Pixel Gem", emoji: "💎", tags: ["pixel","gem","diamond"] },
      { id: "pixel-fire", label: "Pixel Fire", emoji: "🔥", tags: ["pixel","fire"] },
      { id: "pixel-skull", label: "Pixel Skull", emoji: "💀", tags: ["pixel","skull"] },
      { id: "pixel-flag", label: "Pixel Flag", emoji: "🚩", tags: ["pixel","flag"] },
    ],
  },
  mood: {
    id: "pack-mood",
    label: "Mood Tracker",
    icon: "😊",
    stickers: [
      { id: "mood-happy", label: "Happy", emoji: "😊", tags: ["mood","happy","emotion"] },
      { id: "mood-love", label: "Loved", emoji: "🥰", tags: ["mood","love","emotion"] },
      { id: "mood-cool", label: "Cool", emoji: "😎", tags: ["mood","cool","emotion"] },
      { id: "mood-sad", label: "Sad", emoji: "😢", tags: ["mood","sad","emotion"] },
      { id: "mood-angry", label: "Angry", emoji: "😤", tags: ["mood","angry","emotion"] },
      { id: "mood-tired", label: "Tired", emoji: "😴", tags: ["mood","tired","emotion"] },
      { id: "mood-crazy", label: "Crazy", emoji: "🤪", tags: ["mood","crazy","emotion"] },
      { id: "mood-cute", label: "Cute", emoji: "🥺", tags: ["mood","cute","emotion"] },
      { id: "mood-thanks", label: "Grateful", emoji: "🙏", tags: ["mood","grateful","emotion"] },
      { id: "mood-party", label: "Party", emoji: "🥳", tags: ["mood","party","emotion"] },
    ],
  },
  food: {
    id: "pack-food",
    label: "Food & Drink",
    icon: "🍕",
    stickers: [
      { id: "food-pizza", label: "Pizza", emoji: "🍕", tags: ["food","pizza","snack"] },
      { id: "food-burger", label: "Burger", emoji: "🍔", tags: ["food","burger"] },
      { id: "food-sushi", label: "Sushi", emoji: "🍣", tags: ["food","sushi"] },
      { id: "food-cake", label: "Cake", emoji: "🎂", tags: ["food","cake","celebrate"] },
      { id: "food-icecream", label: "Ice Cream", emoji: "🍦", tags: ["food","icecream","sweet"] },
      { id: "food-donut", label: "Donut", emoji: "🍩", tags: ["food","donut","sweet"] },
      { id: "food-cookie", label: "Cookie", emoji: "🍪", tags: ["food","cookie","sweet"] },
      { id: "food-coffee", label: "Coffee", emoji: "☕", tags: ["food","coffee","drink"] },
      { id: "food-tea", label: "Tea", emoji: "🍵", tags: ["food","tea","drink"] },
      { id: "food-boba", label: "Boba Tea", emoji: "🧋", tags: ["food","boba","drink"] },
    ],
  },
  travel: {
    id: "pack-travel",
    label: "Travel & Adventure",
    icon: "✈️",
    stickers: [
      { id: "travel-plane", label: "Airplane", emoji: "✈️", tags: ["travel","plane","flight"] },
      { id: "travel-globe", label: "Globe", emoji: "🌍", tags: ["travel","globe","world"] },
      { id: "travel-compass", label: "Compass", emoji: "🧭", tags: ["travel","compass","direction"] },
      { id: "travel-map", label: "Map", emoji: "🗺️", tags: ["travel","map","adventure"] },
      { id: "travel-camera", label: "Camera", emoji: "📸", tags: ["travel","camera","photo"] },
      { id: "travel-sunset", label: "Sunset", emoji: "🌅", tags: ["travel","sunset","beach"] },
      { id: "travel-palm", label: "Palm Tree", emoji: "🌴", tags: ["travel","palm","beach"] },
      { id: "travel-mountain", label: "Mountain", emoji: "⛰️", tags: ["travel","mountain","nature"] },
      { id: "travel-tent", label: "Camping", emoji: "⛺", tags: ["travel","camp","nature"] },
      { id: "travel-luggage", label: "Suitcase", emoji: "🧳", tags: ["travel","luggage","bag"] },
    ],
  },
  celebration: {
    id: "pack-celebration",
    label: "Celebration",
    icon: "🎉",
    stickers: [
      { id: "celebration-party", label: "Party Popper", emoji: "🎉", tags: ["celebration","party"] },
      { id: "celebration-confetti", label: "Confetti", emoji: "🎊", tags: ["celebration","confetti"] },
      { id: "celebration-balloon", label: "Balloon", emoji: "🎈", tags: ["celebration","balloon"] },
      { id: "celebration-gift", label: "Gift", emoji: "🎁", tags: ["celebration","gift","present"] },
      { id: "celebration-cake", label: "Celebration Cake", emoji: "🎂", tags: ["celebration","cake","birthday"] },
      { id: "celebration-sparkle", label: "Sparkles", emoji: "✨", tags: ["celebration","sparkle","magic"] },
      { id: "celebration-trophy", label: "Trophy", emoji: "🏆", tags: ["celebration","trophy","win"] },
      { id: "celebration-medal", label: "Medal", emoji: "🥇", tags: ["celebration","medal","gold"] },
      { id: "celebration-firework", label: "Fireworks", emoji: "🎆", tags: ["celebration","firework"] },
      { id: "celebration-star", label: "Star", emoji: "🌟", tags: ["celebration","star"] },
    ],
  },
  art: {
    id: "pack-art",
    label: "Art & Creativity",
    icon: "🎨",
    stickers: [
      { id: "art-palette", label: "Palette", emoji: "🎨", tags: ["art","palette","paint"] },
      { id: "art-pencil", label: "Pencil", emoji: "✏️", tags: ["art","pencil","write"] },
      { id: "art-pen", label: "Pen", emoji: "🖊️", tags: ["art","pen","write"] },
      { id: "art-brush", label: "Paint Brush", emoji: "🖌️", tags: ["art","brush","paint"] },
      { id: "art-camera", label: "Camera", emoji: "📷", tags: ["art","camera","photo"] },
      { id: "art-music", label: "Music Note", emoji: "🎵", tags: ["art","music","note"] },
      { id: "art-microphone", label: "Microphone", emoji: "🎤", tags: ["art","mic","music"] },
      { id: "art-film", label: "Film", emoji: "🎬", tags: ["art","film","movie"] },
      { id: "art-scissors", label: "Scissors", emoji: "✂️", tags: ["art","scissors","craft"] },
      { id: "art-glasses", label: "Art Glasses", emoji: "👓", tags: ["art","glasses","creative"] },
    ],
  },
  space: {
    id: "pack-space",
    label: "Space & Galaxy",
    icon: "🌙",
    stickers: [
      { id: "space-moon", label: "Crescent Moon", emoji: "🌙", tags: ["space","moon","night"] },
      { id: "space-star", label: "Glowing Star", emoji: "⭐", tags: ["space","star"] },
      { id: "space-planet", label: "Ringed Planet", emoji: "🪐", tags: ["space","planet","saturn"] },
      { id: "space-rocket", label: "Rocket", emoji: "🚀", tags: ["space","rocket","launch"] },
      { id: "space-satellite", label: "Satellite", emoji: "🛰️", tags: ["space","satellite"] },
      { id: "space-comet", label: "Comet", emoji: "☄️", tags: ["space","comet"] },
      { id: "space-ufo", label: "UFO", emoji: "🛸", tags: ["space","ufo","alien"] },
      { id: "space-astronaut", label: "Astronaut", emoji: "🧑‍🚀", tags: ["space","astronaut"] },
      { id: "space-star2", label: "Diamond Star", emoji: "💫", tags: ["space","star","dizzy"] },
      { id: "space-galaxy", label: "Milky Way", emoji: "🌌", tags: ["space","galaxy","night"] },
    ],
  },
  ocean: {
    id: "pack-ocean",
    label: "Ocean & Beach",
    icon: "🌊",
    stickers: [
      { id: "ocean-wave", label: "Wave", emoji: "🌊", tags: ["ocean","wave","sea"] },
      { id: "ocean-fish", label: "Fish", emoji: "🐟", tags: ["ocean","fish","sea"] },
      { id: "ocean-dolphin", label: "Dolphin", emoji: "🐬", tags: ["ocean","dolphin","sea"] },
      { id: "ocean-whale", label: "Whale", emoji: "🐳", tags: ["ocean","whale","sea"] },
      { id: "ocean-octopus", label: "Octopus", emoji: "🐙", tags: ["ocean","octopus","sea"] },
      { id: "ocean-seashell", label: "Seashell", emoji: "🐚", tags: ["ocean","seashell","beach"] },
      { id: "ocean-coral", label: "Coral", emoji: "🪸", tags: ["ocean","coral","reef"] },
      { id: "ocean-starfish", label: "Starfish", emoji: "⭐", tags: ["ocean","starfish","beach"] },
      { id: "ocean-umbrella", label: "Beach Umbrella", emoji: "🏖️", tags: ["ocean","beach","umbrella"] },
      { id: "ocean-sunset", label: "Ocean Sunset", emoji: "🌅", tags: ["ocean","sunset","beach"] },
    ],
  },
};

const STICKER_PACKS = Object.values(THEMED_STICKER_PACKS);

// Combine all stickers into a flat catalog
const ALL_CATALOG_STICKERS = EMOJI_STICKERS;

// Groups for filtering
const EMOJI_GROUPS = [
  { id: "all", label: "All", icon: "🌀" },
  { id: "nature", label: "Nature", icon: "🌸" },
  { id: "animals", label: "Animals", icon: "🐱" },
  { id: "hearts", label: "Hearts", icon: "❤️" },
  { id: "faces", label: "Faces", icon: "😊" },
  { id: "food", label: "Food", icon: "🍕" },
  { id: "objects", label: "Objects", icon: "📖" },
  { id: "symbols", label: "Symbols", icon: "✦" },
  { id: "sky", label: "Sky", icon: "🌙" },
];

export {
  ALL_CATALOG_STICKERS,
  EMOJI_GROUPS,
  EMOJI_STICKERS,
  STICKER_PACKS,
  THEMED_STICKER_PACKS,
};