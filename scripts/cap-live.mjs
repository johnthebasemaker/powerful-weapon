// Point the Android project at the Vite dev server for live reload, then sync.
// Usage:  npm run dev:web      (terminal 1 — starts Vite on your LAN)
//         npm run cap:live     (terminal 2 — syncs, then Run ▶ in Android Studio)
//
// Override the detected IP with CAP_HOST=192.168.x.y npm run cap:live
import { networkInterfaces } from 'node:os';
import { execSync } from 'node:child_process';

function lanIp() {
  for (const iface of Object.values(networkInterfaces())) {
    for (const net of iface ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

const ip = process.env.CAP_HOST || lanIp();
const url = `http://${ip}:5173`;

console.log(`\n▶ Live-reload target: ${url}`);
console.log('  • Make sure `npm run dev:web` is running.');
console.log('  • Your phone (or emulator) must be on the same Wi-Fi as this Mac.\n');

execSync('npx cap sync android', {
  stdio: 'inherit',
  env: { ...process.env, CAP_SERVER_URL: url },
});

console.log('\n✅ Synced to the dev server. Now press Run ▶ in Android Studio.');
console.log('   Edit anything in src/ → the app hot-reloads on the device.');
console.log('\n↩︎  To return to a normal bundled build (and before any release):');
console.log('     npm run build:renderer && npx cap sync android\n');
