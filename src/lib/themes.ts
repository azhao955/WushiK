export interface Theme {
  name: string;
  background: string;
  cardBg: string;
  cardBorder: string;
  cardTextColor: string;
  panelBg: string;
  panelBorder: string;
  primaryColor: string;
  secondaryColor: string;
}

export const themes: Record<string, Theme> = {
  default: {
    name: 'Classic',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    cardBg: '#ffffff',
    cardBorder: '#2c3e50',
    cardTextColor: '#000',
    panelBg: '#ffffff',
    panelBorder: '#000',
    primaryColor: '#4ecdc4',
    secondaryColor: '#ff6b6b',
  },
  tennis: {
    name: 'Tennis Court',
    background: 'linear-gradient(135deg, #2d5016 0%, #3d7521 100%)',
    cardBg: '#fffacd',
    cardBorder: '#fff',
    cardTextColor: '#000',
    panelBg: '#f0f0f0',
    panelBorder: '#fff',
    primaryColor: '#9fc949',
    secondaryColor: '#e8d21d',
  },
  space: {
    name: 'Space Odyssey',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    cardBg: '#1a1a2e',
    cardBorder: '#00d9ff',
    cardTextColor: '#eee',
    panelBg: 'rgba(26, 26, 46, 0.85)',
    panelBorder: '#00d9ff',
    primaryColor: '#00d9ff',
    secondaryColor: '#ff6b9d',
  },
  ocean: {
    name: 'Ocean Waves',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    cardBg: '#e0f7fa',
    cardBorder: '#006064',
    cardTextColor: '#004d40',
    panelBg: '#b2ebf2',
    panelBorder: '#00838f',
    primaryColor: '#00acc1',
    secondaryColor: '#ff6f00',
  },
  sunset: {
    name: 'Desert Sunset',
    background: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)',
    cardBg: '#fff3e0',
    cardBorder: '#d84315',
    cardTextColor: '#bf360c',
    panelBg: '#ffe0b2',
    panelBorder: '#e64a19',
    primaryColor: '#ff6f00',
    secondaryColor: '#ffd54f',
  },
  neon: {
    name: 'Cyberpunk Neon',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    cardBg: '#0a0e27',
    cardBorder: '#00ff41',
    cardTextColor: '#00ff41',
    panelBg: '#16213e',
    panelBorder: '#ff006e',
    primaryColor: '#00ff41',
    secondaryColor: '#ff006e',
  },
};

export const getTheme = (themeName: string): Theme => {
  return themes[themeName] || themes.default;
};
