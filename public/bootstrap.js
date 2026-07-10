(function restoreCachedAppearance() {
  try {
    const cached = localStorage.getItem('tat_site_settings');
    if (cached) {
      const settings = JSON.parse(cached);
      if (settings.title) {
        document.title = settings.title;
        document.querySelector('meta[property="og:title"]')?.setAttribute('content', settings.title);
        document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', settings.title);
      }
      if (settings.iconUrl) {
        document.getElementById('favicon')?.setAttribute('href', settings.iconUrl);
      }
      if (/^#[0-9a-fA-F]{6}$/.test(settings.themeColor || '')) {
        const hex = settings.themeColor;
        const red = parseInt(hex.slice(1, 3), 16);
        const green = parseInt(hex.slice(3, 5), 16);
        const blue = parseInt(hex.slice(5, 7), 16);
        const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
        const darkRed = clamp(red + (255 - red) * 0.28);
        const darkGreen = clamp(green + (255 - green) * 0.28);
        const darkBlue = clamp(blue + (255 - blue) * 0.28);
        const toHex = (value) => clamp(value).toString(16).padStart(2, '0');
        const style = document.documentElement.style;
        style.setProperty('--accent-light', hex);
        style.setProperty('--accent-soft-light', `rgba(${red}, ${green}, ${blue}, 0.16)`);
        style.setProperty('--accent-dark', `#${toHex(darkRed)}${toHex(darkGreen)}${toHex(darkBlue)}`);
        style.setProperty('--accent-soft-dark', `rgba(${darkRed}, ${darkGreen}, ${darkBlue}, 0.18)`);
      }
    }

    const theme = localStorage.getItem('tat_theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle(
      'dark',
      theme === 'dark' || (!theme && systemDark) || (theme === 'system' && systemDark)
    );
  } catch (error) {
    console.error('Failed to restore cached appearance', error);
  }
})();
