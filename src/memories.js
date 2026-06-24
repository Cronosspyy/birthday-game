// Playable Cozy Lily Garden Wishes State Handler

// Default starting wishes positioned spread out on land
const DEFAULT_WISHES = [
  {
    id: "wish-1",
    sender: "Sarah",
    message: "Happy Birthday! Wishing you a year ahead full of love, laughter, and endless adventure! 🎂✨ You deserve all the happiness in the world.",
    color: "pink",
    date: "June 24, 2026",
    collected: false,
    planted: false,
    read: false,
    // Spaced coordinates on the grassy land of the sphere (radius ~9.9)
    landPosition: { x: -8.0, y: 3.5, z: 4.8 },
    // Coordinates inside the pond cap
    pondPosition: { x: -1.16, y: 9.45, z: 1.74 }
  },
  {
    id: "wish-2",
    sender: "Mom & Dad",
    message: "Watching you grow into such a beautiful, kind, and brilliant person is our life's greatest joy. Have a truly magical birthday! 💖🎈",
    color: "white",
    date: "June 24, 2026",
    collected: false,
    planted: false,
    read: false,
    landPosition: { x: 7.2, y: -4.5, z: 5.2 },
    pondPosition: { x: 2.04, y: 9.43, z: -0.78 }
  },
  {
    id: "wish-3",
    sender: "Emma",
    message: "To my best friend: thank you for being the one who makes me laugh when I want to cry. Cheers to another trip around the sun! 🥂🎉",
    color: "purple",
    date: "June 24, 2026",
    collected: false,
    planted: false,
    read: false,
    landPosition: { x: -6.5, y: -5.5, z: -5.2 },
    pondPosition: { x: -0.48, y: 9.47, z: -1.93 }
  },
  {
    id: "wish-4",
    sender: "David",
    message: "Happy Birthday! May this year bring you closer to your dream horizons. Keep shining bright! 🌟",
    color: "gold",
    date: "June 24, 2026",
    collected: false,
    planted: false,
    read: false,
    landPosition: { x: 5.8, y: 4.5, z: -6.8 },
    pondPosition: { x: 1.74, y: 9.41, z: 1.45 }
  }
];

const LOCAL_STORAGE_KEYS = {
  WISHES: "lily_game_wishes"
};

/**
 * Get all wishes from localStorage or defaults
 */
export function getWishes() {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.WISHES);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Error parsing stored wishes, resetting to defaults", e);
    }
  }
  // Initialize with defaults
  saveWishes(DEFAULT_WISHES);
  return DEFAULT_WISHES;
}

/**
 * Save wishes
 */
export function saveWishes(wishes) {
  localStorage.setItem(LOCAL_STORAGE_KEYS.WISHES, JSON.stringify(wishes));
}

/**
 * Reset wishes state to defaults (all uncollected/unplanted)
 */
export function resetWishes() {
  localStorage.removeItem(LOCAL_STORAGE_KEYS.WISHES);
  return getWishes();
}

/**
 * Update wish collect state
 */
export function collectWish(id) {
  const wishes = getWishes();
  const index = wishes.findIndex(w => w.id === id);
  if (index !== -1) {
    wishes[index].collected = true;
    saveWishes(wishes);
    return wishes[index];
  }
  return null;
}

/**
 * Update wish plant state
 */
export function plantWish(id) {
  const wishes = getWishes();
  const index = wishes.findIndex(w => w.id === id);
  if (index !== -1) {
    wishes[index].planted = true;
    saveWishes(wishes);
    return wishes[index];
  }
  return null;
}

/**
 * Update wish read state
 */
export function readWish(id) {
  const wishes = getWishes();
  const index = wishes.findIndex(w => w.id === id);
  if (index !== -1) {
    wishes[index].read = true;
    saveWishes(wishes);
    return wishes[index];
  }
  return null;
}
