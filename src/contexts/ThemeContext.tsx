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
    sidebarBackground: '0 0% 98%',
    sidebarForeground: '240 5.3% 26.1%',
    sidebarPrimary: '240 5.9% 10%',
    sidebarPrimaryForeground: '0 0% 98%',
    sidebarAccent: '240 4.8% 95.9%',
    sidebarAccentForeground: '240 5.9% 10%',
    sidebarBorder: '220 13% 91%',
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
    primaryForeground: '45 58% 52%',
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
    sidebarForeground: '45 30% 85%',
    sidebarPrimary: '45 58% 52%',
    sidebarPrimaryForeground: '215 72% 10%',
    sidebarAccent: '215 60% 18%',
    sidebarAccentForeground: '45 30% 85%',
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
    primaryForeground: '15 100% 83%',
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
    sidebarForeground: '15 80% 90%',
    sidebarPrimary: '15 100% 83%',
    sidebarPrimaryForeground: '282 43% 15%',
    sidebarAccent: '282 35% 22%',
    sidebarAccentForeground: '15 80% 90%',
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
    primaryForeground: '36 52% 87%',
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
    sidebarForeground: '36 40% 88%',
    sidebarPrimary: '36 52% 87%',
    sidebarPrimaryForeground: '153 42% 13%',
    sidebarAccent: '153 35% 20%',
    sidebarAccentForeground: '36 40% 88%',
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
    primaryForeground: '195 100% 50%',
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
    sidebarForeground: '195 40% 85%',
    sidebarPrimary: '195 100% 50%',
    sidebarPrimaryForeground: '0 0% 10%',
    sidebarAccent: '0 0% 18%',
    sidebarAccentForeground: '195 40% 85%',
    sidebarBorder: '0 0% 22%',
    sidebarRing: '195 100% 50%',
    previewPrimary: '#2E2E2E',
    previewAccent: '#00C2FF',
  },
];

interface ThemeContextType {
  currentTheme: AppTheme;
  setTheme: (themeId: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
