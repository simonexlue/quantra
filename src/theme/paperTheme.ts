import { MD3LightTheme as Base, type MD3Theme } from "react-native-paper";

export const brand = {
  background:  "#f9f9f9",
  surface:     "#ffffff",
  textPrimary: "#1A237E",
  textSecondary:"#616161",
  accent:  "#18B6B2", // teal accent
  primary: "#1A237E", // navy
};

export const paperTheme: MD3Theme = {
  ...Base,
  roundness: 4,
  colors: {
    ...Base.colors,

    // Surfaces
    background: brand.background,
    surface:    brand.surface,

    // Text mapping
    onSurfaceVariant: brand.textPrimary,   // primary text
    onSurface:        brand.textSecondary, // secondary/placeholder

    // Brand roles
    primary:   brand.primary,   // headings etc.
    secondary: brand.accent,    // accents

    // Keep icon pads/elevation neutral
    secondaryContainer: brand.surface,
    elevation: {
      level0: "transparent",
      level1: brand.surface,
      level2: brand.surface,
      level3: brand.surface,
      level4: brand.surface,
      level5: brand.surface,
    },
  },
};
