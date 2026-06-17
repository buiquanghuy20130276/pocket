// =============================================
// SNAPLEDGER DESIGN SYSTEM (THEME TOKENS)
// =============================================

export const THEME = {
  // Brand & Neutrals
  backgroundPrimary: "#F4F3EE",    // Warm off-white
  backgroundSecondary: "#EAE8E1",  // Light warm gray
  textPrimary: "#2C2C2A",          // Dark charcoal
  textSecondary: "#5F5E5A",        // Muted gray-brown
  textTertiary: "#888780",         // Faded gray-brown
  borderPrimary: "#D3D1C7",        // Solid light sand border
  borderSecondary: "#E1DFD7",      // Soft light sand border
  
  // Interactive / Primary action
  buttonPrimary: "#2C2C2A",
  buttonText: "#F1EFE8",
  
  // Semantic / Categorized Palettes
  green: {
    bg: "#E1F5EE",
    text: "#0F6E56",
    solid: "#1D9E75"
  },
  orange: {
    bg: "#FAEEDA",
    text: "#854F0B",
    solid: "#EF9F27"
  },
  purple: {
    bg: "#EEEDFE",
    text: "#534AB7",
    solid: "#7F77DD"
  },
  red: {
    bg: "#FCEBEB",
    text: "#A32D2D",
    solid: "#E24B4A"
  },
  blue: {
    bg: "#E6F1FB",
    text: "#185FA5",
    solid: "#378ADD"
  },
  gray: {
    bg: "#F1EFE8",
    text: "#5F5E5A",
    solid: "#B4B2A9"
  }
};

const ICON_MAP: Record<string, string> = {
  "fork.knife": "restaurant",
  "car.fill": "car",
  "cart.fill": "bag-handle",
  "heart.text.square.fill": "heart",
  "gamecontroller.fill": "game-controller",
  "ellipsis.circle.fill": "ellipsis-horizontal-circle",
  "book.fill": "book",
  "house.fill": "home",
  "airplane": "airplane",
  "cup.and.saucer.fill": "cafe",
  "dumbbell.fill": "barbell",
  "pawprint.fill": "paw",
  "gift.fill": "gift",
};

export const mapIconToIonicons = (icon: string | null): string => {
  if (!icon) return "pricetag";
  return ICON_MAP[icon] || icon;
};

