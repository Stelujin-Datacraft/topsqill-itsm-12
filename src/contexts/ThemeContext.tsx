import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface AppTheme {
  id: string;
  name: string;
  description: string;
  primary: string;       // HSL values (no hsl() wrapper)
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  // Preview colors (hex) for the selector UI
  previewPrimary: string;
  previewAccent: string;
}

export const themes: AppTheme[] = [
  {
    id: 'deep-blue-orange',
    name: 'Deep Blue & Orange',
    description: 'Professional & Enterprise',
    primary: '217 71% 40%',
    primaryForeground: '210 40% 98%',
    accent: '37 92% 50%',
    accentForeground: '37 92% 14%',
    background: '210 20% 98%',
    foreground: '215 25% 12%',
    card: '0 0% 100%',
    cardForeground: '215 25% 12%',
    secondary: '210 25% 93%',
    secondaryForeground: '215 25% 12%',
    muted: '210 20% 95%',
    mutedForeground: '215 14% 46%',
    border: '214 20% 88%',
    input: '214 20% 88%',
    ring: '217 71% 40%',
    sidebarBackground: '217 71% 20%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '217 71% 40%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '217 60% 28%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '217 50% 25%',
    sidebarRing: '217 91.2% 59.8%',
    previewPrimary: '#1a5cb5',
    previewAccent: '#f5a623',
  },
  {
    id: 'charcoal-emerald',
    name: 'Charcoal & Emerald',
    description: 'Modern & Premium',
    primary: '145 63% 42%',
    primaryForeground: '0 0% 100%',
    accent: '145 63% 49%',
    accentForeground: '0 0% 10%',
    background: '0 0% 97%',
    foreground: '0 0% 11%',
    card: '0 0% 100%',
    cardForeground: '0 0% 11%',
    secondary: '0 0% 92%',
    secondaryForeground: '0 0% 11%',
    muted: '0 0% 94%',
    mutedForeground: '0 0% 40%',
    border: '0 0% 87%',
    input: '0 0% 87%',
    ring: '145 63% 42%',
    sidebarBackground: '0 0% 11%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '145 63% 49%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '0 0% 18%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '0 0% 20%',
    sidebarRing: '145 63% 49%',
    previewPrimary: '#1C1C1C',
    previewAccent: '#2ECC71',
  },
  {
    id: 'navy-gold',
    name: 'Navy & Gold',
    description: 'Luxury & Corporate',
    primary: '215 72% 14%',
    primaryForeground: '0 0% 98%',
    accent: '45 58% 52%',
    accentForeground: '215 72% 14%',
    background: '220 20% 97%',
    foreground: '215 60% 12%',
    card: '0 0% 100%',
    cardForeground: '215 60% 12%',
    secondary: '220 20% 92%',
    secondaryForeground: '215 60% 12%',
    muted: '220 18% 94%',
    mutedForeground: '215 15% 45%',
    border: '220 18% 87%',
    input: '220 18% 87%',
    ring: '215 72% 14%',
    sidebarBackground: '215 72% 10%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '45 58% 52%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '215 60% 18%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '215 50% 20%',
    sidebarRing: '45 58% 52%',
    previewPrimary: '#0B1F3A',
    previewAccent: '#D4AF37',
  },
  {
    id: 'purple-peach',
    name: 'Purple & Peach',
    description: 'Creative & Elegant',
    primary: '282 43% 20%',
    primaryForeground: '0 0% 98%',
    accent: '15 100% 83%',
    accentForeground: '282 43% 15%',
    background: '300 15% 97%',
    foreground: '282 30% 15%',
    card: '0 0% 100%',
    cardForeground: '282 30% 15%',
    secondary: '300 15% 92%',
    secondaryForeground: '282 30% 15%',
    muted: '300 12% 94%',
    mutedForeground: '282 12% 45%',
    border: '300 12% 87%',
    input: '300 12% 87%',
    ring: '282 43% 20%',
    sidebarBackground: '282 43% 15%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '15 100% 83%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '282 35% 22%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '282 30% 25%',
    sidebarRing: '15 100% 83%',
    previewPrimary: '#3B1C4A',
    previewAccent: '#FFB7A5',
  },
  {
    id: 'forest-beige',
    name: 'Forest & Beige',
    description: 'Clean & Sophisticated',
    primary: '153 42% 18%',
    primaryForeground: '0 0% 98%',
    accent: '36 52% 87%',
    accentForeground: '153 42% 12%',
    background: '40 30% 97%',
    foreground: '153 30% 12%',
    card: '0 0% 100%',
    cardForeground: '153 30% 12%',
    secondary: '40 25% 92%',
    secondaryForeground: '153 30% 12%',
    muted: '40 20% 94%',
    mutedForeground: '153 12% 42%',
    border: '40 18% 86%',
    input: '40 18% 86%',
    ring: '153 42% 18%',
    sidebarBackground: '153 42% 13%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '36 52% 87%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '153 35% 20%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '153 30% 22%',
    sidebarRing: '36 52% 87%',
    previewPrimary: '#1B4332',
    previewAccent: '#F5E6CA',
  },
  {
    id: 'gray-cyan',
    name: 'Gray & Cyan',
    description: 'Modern & Tech',
    primary: '0 0% 18%',
    primaryForeground: '0 0% 98%',
    accent: '195 100% 50%',
    accentForeground: '0 0% 10%',
    background: '0 0% 97%',
    foreground: '0 0% 12%',
    card: '0 0% 100%',
    cardForeground: '0 0% 12%',
    secondary: '0 0% 92%',
    secondaryForeground: '0 0% 12%',
    muted: '0 0% 94%',
    mutedForeground: '0 0% 42%',
    border: '0 0% 87%',
    input: '0 0% 87%',
    ring: '195 100% 50%',
    sidebarBackground: '0 0% 12%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '195 100% 50%',
    sidebarPrimaryForeground: '0 0% 10%',
    sidebarAccent: '0 0% 18%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '0 0% 22%',
    sidebarRing: '195 100% 50%',
    previewPrimary: '#2E2E2E',
    previewAccent: '#00C2FF',
  },
  {
    id: 'sage-terracotta',
    name: 'Sage & Terracotta',
    description: 'Fresh & Trendy',
    primary: '105 18% 61%',
    primaryForeground: '0 0% 100%',
    accent: '16 58% 59%',
    accentForeground: '0 0% 100%',
    background: '90 15% 97%',
    foreground: '105 12% 15%',
    card: '0 0% 100%',
    cardForeground: '105 12% 15%',
    secondary: '90 12% 92%',
    secondaryForeground: '105 12% 15%',
    muted: '90 10% 94%',
    mutedForeground: '105 8% 42%',
    border: '90 10% 86%',
    input: '90 10% 86%',
    ring: '105 18% 61%',
    sidebarBackground: '105 18% 20%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '16 58% 59%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '105 15% 26%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '105 12% 28%',
    sidebarRing: '16 58% 59%',
    previewPrimary: '#9CAF88',
    previewAccent: '#D17A5C',
  },
  {
    id: 'midnight-mint',
    name: 'Midnight & Mint',
    description: 'Clean & Refreshing',
    primary: '220 37% 19%',
    primaryForeground: '0 0% 98%',
    accent: '152 56% 78%',
    accentForeground: '220 37% 14%',
    background: '210 18% 97%',
    foreground: '220 30% 14%',
    card: '0 0% 100%',
    cardForeground: '220 30% 14%',
    secondary: '210 15% 92%',
    secondaryForeground: '220 30% 14%',
    muted: '210 12% 94%',
    mutedForeground: '220 12% 44%',
    border: '210 12% 87%',
    input: '210 12% 87%',
    ring: '220 37% 19%',
    sidebarBackground: '220 37% 14%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '152 56% 78%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '220 30% 22%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '220 25% 24%',
    sidebarRing: '152 56% 78%',
    previewPrimary: '#1F2A44',
    previewAccent: '#A8E6CF',
  },
  {
    id: 'lavender-plum',
    name: 'Lavender & Plum',
    description: 'Soft but Rich',
    primary: '290 30% 78%',
    primaryForeground: '0 0% 98%',
    accent: '274 75% 35%',
    accentForeground: '290 30% 92%',
    background: '290 18% 97%',
    foreground: '274 40% 18%',
    card: '0 0% 100%',
    cardForeground: '274 40% 18%',
    secondary: '290 15% 92%',
    secondaryForeground: '274 40% 18%',
    muted: '290 12% 94%',
    mutedForeground: '274 12% 44%',
    border: '290 12% 87%',
    input: '290 12% 87%',
    ring: '274 75% 35%',
    sidebarBackground: '274 75% 22%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '290 30% 78%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '274 60% 30%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '274 50% 32%',
    sidebarRing: '290 30% 78%',
    previewPrimary: '#CDB4DB',
    previewAccent: '#5A189A',
  },
  {
    id: 'taupe-softblue',
    name: 'Taupe & Soft Blue',
    description: 'Calm & Premium',
    primary: '25 14% 48%',
    primaryForeground: '0 0% 100%',
    accent: '199 47% 69%',
    accentForeground: '25 14% 15%',
    background: '30 12% 97%',
    foreground: '25 12% 15%',
    card: '0 0% 100%',
    cardForeground: '25 12% 15%',
    secondary: '30 10% 92%',
    secondaryForeground: '25 12% 15%',
    muted: '30 8% 94%',
    mutedForeground: '25 8% 42%',
    border: '30 8% 86%',
    input: '30 8% 86%',
    ring: '25 14% 48%',
    sidebarBackground: '25 14% 18%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '199 47% 69%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '25 12% 24%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '25 10% 26%',
    sidebarRing: '199 47% 69%',
    previewPrimary: '#8D7B68',
    previewAccent: '#89C2D9',
  },
  {
    id: 'charcoal-lime',
    name: 'Charcoal & Lime',
    description: 'Bold & Contemporary',
    primary: '0 0% 17%',
    primaryForeground: '0 0% 98%',
    accent: '76 100% 47%',
    accentForeground: '0 0% 10%',
    background: '0 0% 97%',
    foreground: '0 0% 12%',
    card: '0 0% 100%',
    cardForeground: '0 0% 12%',
    secondary: '0 0% 92%',
    secondaryForeground: '0 0% 12%',
    muted: '0 0% 94%',
    mutedForeground: '0 0% 42%',
    border: '0 0% 87%',
    input: '0 0% 87%',
    ring: '76 100% 47%',
    sidebarBackground: '0 0% 12%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '76 100% 47%',
    sidebarPrimaryForeground: '0 0% 10%',
    sidebarAccent: '0 0% 18%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '0 0% 22%',
    sidebarRing: '76 100% 47%',
    previewPrimary: '#2B2B2B',
    previewAccent: '#A4F000',
  },
  {
    id: 'royal-purple-gold',
    name: 'Royal Purple & Gold',
    description: 'Ultimate Royal Feel',
    primary: '275 100% 25%',
    primaryForeground: '0 0% 98%',
    accent: '43 42% 57%',
    accentForeground: '275 100% 15%',
    background: '270 15% 97%',
    foreground: '275 50% 14%',
    card: '0 0% 100%',
    cardForeground: '275 50% 14%',
    secondary: '270 12% 92%',
    secondaryForeground: '275 50% 14%',
    muted: '270 10% 94%',
    mutedForeground: '275 15% 44%',
    border: '270 10% 87%',
    input: '270 10% 87%',
    ring: '275 100% 25%',
    sidebarBackground: '275 100% 18%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '43 42% 57%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '275 80% 24%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '275 60% 26%',
    sidebarRing: '43 42% 57%',
    previewPrimary: '#4B0082',
    previewAccent: '#C6A75E',
  },
  {
    id: 'emerald-champagne',
    name: 'Emerald & Champagne',
    description: 'Rich & Sophisticated',
    primary: '181 61% 15%',
    primaryForeground: '0 0% 98%',
    accent: '37 69% 88%',
    accentForeground: '181 61% 12%',
    background: '40 25% 97%',
    foreground: '181 40% 12%',
    card: '0 0% 100%',
    cardForeground: '181 40% 12%',
    secondary: '40 20% 92%',
    secondaryForeground: '181 40% 12%',
    muted: '40 15% 94%',
    mutedForeground: '181 12% 42%',
    border: '40 12% 86%',
    input: '40 12% 86%',
    ring: '181 61% 15%',
    sidebarBackground: '181 61% 11%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '37 69% 88%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '181 50% 18%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '181 40% 20%',
    sidebarRing: '37 69% 88%',
    previewPrimary: '#0F3D3E',
    previewAccent: '#F7E7CE',
  },
  {
    id: 'burgundy-gold',
    name: 'Burgundy & Gold',
    description: 'Old-Money Luxury',
    primary: '350 77% 24%',
    primaryForeground: '0 0% 98%',
    accent: '45 58% 52%',
    accentForeground: '350 77% 14%',
    background: '350 12% 97%',
    foreground: '350 40% 14%',
    card: '0 0% 100%',
    cardForeground: '350 40% 14%',
    secondary: '350 10% 92%',
    secondaryForeground: '350 40% 14%',
    muted: '350 8% 94%',
    mutedForeground: '350 12% 44%',
    border: '350 8% 87%',
    input: '350 8% 87%',
    ring: '350 77% 24%',
    sidebarBackground: '350 77% 16%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '45 58% 52%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '350 60% 22%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '350 50% 24%',
    sidebarRing: '45 58% 52%',
    previewPrimary: '#6A0F1E',
    previewAccent: '#D4AF37',
  },
  {
    id: 'navy-bronze',
    name: 'Navy & Bronze',
    description: 'Corporate Royal',
    primary: '218 75% 15%',
    primaryForeground: '0 0% 98%',
    accent: '35 36% 52%',
    accentForeground: '218 75% 12%',
    background: '220 15% 97%',
    foreground: '218 50% 14%',
    card: '0 0% 100%',
    cardForeground: '218 50% 14%',
    secondary: '220 12% 92%',
    secondaryForeground: '218 50% 14%',
    muted: '220 10% 94%',
    mutedForeground: '218 12% 44%',
    border: '220 10% 87%',
    input: '220 10% 87%',
    ring: '218 75% 15%',
    sidebarBackground: '218 75% 11%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '35 36% 52%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '218 60% 20%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '218 50% 22%',
    sidebarRing: '35 36% 52%',
    previewPrimary: '#0A1F44',
    previewAccent: '#B08D57',
  },
  {
    id: 'charcoal-rosegold',
    name: 'Charcoal & Rose Gold',
    description: 'Modern Royal',
    primary: '0 0% 11%',
    primaryForeground: '0 0% 98%',
    accent: '350 28% 59%',
    accentForeground: '0 0% 100%',
    background: '0 0% 97%',
    foreground: '0 0% 12%',
    card: '0 0% 100%',
    cardForeground: '0 0% 12%',
    secondary: '0 0% 92%',
    secondaryForeground: '0 0% 12%',
    muted: '0 0% 94%',
    mutedForeground: '0 0% 42%',
    border: '0 0% 87%',
    input: '0 0% 87%',
    ring: '350 28% 59%',
    sidebarBackground: '0 0% 11%',
    sidebarForeground: '0 0% 90%',
    sidebarPrimary: '350 28% 59%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '0 0% 18%',
    sidebarAccentForeground: '0 0% 90%',
    sidebarBorder: '0 0% 20%',
    sidebarRing: '350 28% 59%',
    previewPrimary: '#1C1C1C',
    previewAccent: '#B76E79',
  },
];

interface ThemeContextType {
  currentTheme: AppTheme;
  setTheme: (themeId: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  currentTheme: themes[0],
  setTheme: () => {},
});

const THEME_STORAGE_KEY = 'app-theme-id';

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--primary-foreground', theme.primaryForeground);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-foreground', theme.accentForeground);
  root.style.setProperty('--background', theme.background);
  root.style.setProperty('--foreground', theme.foreground);
  root.style.setProperty('--card', theme.card);
  root.style.setProperty('--card-foreground', theme.cardForeground);
  root.style.setProperty('--secondary', theme.secondary);
  root.style.setProperty('--secondary-foreground', theme.secondaryForeground);
  root.style.setProperty('--muted', theme.muted);
  root.style.setProperty('--muted-foreground', theme.mutedForeground);
  root.style.setProperty('--border', theme.border);
  root.style.setProperty('--input', theme.input);
  root.style.setProperty('--ring', theme.ring);
  root.style.setProperty('--sidebar-background', theme.sidebarBackground);
  root.style.setProperty('--sidebar-foreground', theme.sidebarForeground);
  root.style.setProperty('--sidebar-primary', theme.sidebarPrimary);
  root.style.setProperty('--sidebar-primary-foreground', theme.sidebarPrimaryForeground);
  root.style.setProperty('--sidebar-accent', theme.sidebarAccent);
  root.style.setProperty('--sidebar-accent-foreground', theme.sidebarAccentForeground);
  root.style.setProperty('--sidebar-border', theme.sidebarBorder);
  root.style.setProperty('--sidebar-ring', theme.sidebarRing);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    const savedId = localStorage.getItem(THEME_STORAGE_KEY);
    return themes.find(t => t.id === savedId) || themes[0];
  });

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  const setTheme = useCallback((themeId: string) => {
    const theme = themes.find(t => t.id === themeId);
    if (theme) {
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
      setCurrentTheme(theme);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
