# Put Tile Runner on your iPhone (Add to Home Screen)

The game is now an installable web app (PWA): a real full-screen icon on your
home screen, works offline once installed. Pick ONE of the two paths below.

------------------------------------------------------------------------
## Option A — Recommended: free host, permanent + offline (~2 min)
Because iPhones only allow "install + offline" over https, drop the folder on
a free static host that gives you an https link.

1. On your Mac, open a browser to:  https://app.netlify.com/drop
2. Drag the WHOLE `tile-runner` folder (this folder) onto that page.
   (Sign in with email/Google/GitHub to keep the link; free.)
3. It gives you an https URL like  https://something.netlify.app
4. On your iPhone, open that URL in **Safari**.
5. Tap the **Share** button (square with an up arrow) -> **Add to Home Screen**
   -> **Add**.
6. Launch it from the new "Tile Runner" icon. It runs full-screen and keeps
   working even with no internet.

(Any static host works the same way: GitHub Pages, Cloudflare Pages, Vercel.)

------------------------------------------------------------------------
## Option B — No account, quick test on your Wi-Fi (server must stay running)
Serves the game from your Mac; your phone opens it over the local network.
Great for a quick try; it is NOT offline (needs the Mac server running).

1. In Terminal on your Mac:
       cd ~/Documents/tile-runner
       python3 -m http.server 8000
2. Find your Mac's Wi-Fi IP address:
       ipconfig getifaddr en0
   (e.g. 192.168.1.42)
3. On your iPhone (same Wi-Fi), open Safari to:
       http://YOUR-MAC-IP:8000
   e.g.  http://192.168.1.42:8000
4. Share -> Add to Home Screen -> Add.
5. Stop the server later with Ctrl-C (the home-screen icon then needs the
   server running again to load, since offline needs Option A's https).

------------------------------------------------------------------------
## Files in this folder
- index.html            the whole game
- manifest.webmanifest  makes it installable (name, icon, full-screen)
- sw.js                 service worker (offline caching over https)
- icon-180/192/512/1024 app icons (1024 is the master, handy for later)

## Later: a real App Store app
You have Xcode + a free Apple ID, so you can wrap this in a native shell with
Capacitor and install straight to your iPhone (free sideload renews weekly; a
$99/yr Apple Developer account makes it permanent / App Store-ready). Ask and
I'll scaffold the whole Xcode project.
