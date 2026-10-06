# DiskWala → TeraBox mobile web app

## What this first version does

1. Opens a mobile-friendly web page.
2. Accepts a DiskWala URL.
3. Resolves the DiskWala page with a headless browser and collects candidate media/download URLs.
4. Has a server-side TeraBox Open Platform connection point.
5. Never asks the user for a TeraBox password.

## Important

The official TeraBox Open Platform requires an application `client_id`, `client_secret`, and `private_secret`, which must be obtained from TeraBox. Do not put these secrets in the browser/frontend.

This starter deliberately does NOT pretend that a normal TeraBox login is an API credential. The final upload/share step should be implemented against the official Open Platform after the application credentials are approved.

## Run on Windows

Install Node.js 20+.

Then in PowerShell:

```powershell
cd diskwala-terabox-webapp
npm install
npx playwright install chromium
copy .env.example .env
npm start
```

Open:

http://localhost:3000

On the same Wi-Fi, to open it from an Android phone, find the PC's LAN IP (for example `192.168.1.20`) and open:

http://192.168.1.20:3000

You may need to allow Node.js through Windows Firewall for Private networks.

## Optional DiskWala API

If you have a legitimate DiskWala extraction API subscription/key, set:

DISKWALA_API_URL=...
DISKWALA_API_KEY=...

The key remains on the server.

## Next implementation step

After testing the resolver with your exact URL, implement the official TeraBox OAuth token exchange and chunked upload/create flow. This should be done server-side because TeraBox's application secrets must not be exposed to the browser.
