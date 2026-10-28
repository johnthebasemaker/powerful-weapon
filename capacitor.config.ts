import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.andrewjohnson.powerfulweapon',
  appName: 'Powerful Weapon',
  webDir: 'dist',
  backgroundColor: '#0b2421',
  plugins: {
    LocalNotifications: {
      // White silhouette in android/app/src/main/res/drawable/ic_stat_verse.xml
      smallIcon: 'ic_stat_verse',
      iconColor: '#1F6158',
    },
  },
};

// Live-reload (DEV ONLY): when CAP_SERVER_URL is set, the app loads from the Vite
// dev server on your Mac instead of the bundled assets, giving instant HMR.
// A normal `npx cap sync android` (no env var) clears this, so release builds are
// never pointed at your laptop. See `npm run cap:live`.
if (process.env.CAP_SERVER_URL) {
  config.server = { url: process.env.CAP_SERVER_URL, cleartext: true };
}

export default config;
