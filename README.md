## Voicenotes Sync
Plugin offers the ability to sync down your thoughts an ideas from the voicenotes.com online service. The service
uses an API key which the plugin can grab post login (if using email and password or use the Login via Apple, Google, Twitter (X) instructions below) and we do not save anything but the username in the settings file.

Through the plugin settings one can customize the sync directory and frequency, download the audio file used in the 
transcript and any AI generated summaries or actions become sections in the note text.

### Features
- Automatically sync data based on configurable minutes from VoiceNotes.com
  - Includes any AI generated summaries or actions
  - Includes TODOs which are turned into markdown todos (can append a tag to every TODO as well)
- Customize the sync directory and frequency
- Downloads the audio file (default is off)
- Prepend the date to the title / filename
- Optional mode to delete synced notes from the voicenotes.com server
  - Destructive action which requires double opt-in toggles

### Login via Apple, Google, Twitter (X)
Steps to login with the above services (quite manual but doable).

1. Open up voicenotes.com in a browser like Chrome
2. After logging in open up Developer Tools
3. Navigate to the "Network" tab
4. Click on Fetch/XHR to see those calls specifically
5. Hit refresh on the voicenotes.com page
6. One of the entries should say "me" click on it and navigate to the Headers section
7. Scroll down to "Request Headers" and find the line that says "Authorization"
8. The right side of this entry will say "Bearer x" where x is a longish string of text. This is your authorization / login key
9. Copy that value for the next step

## Back in Obsidian
1. Enter the token into the "Auth Token" field in settings
4. Click Login with Token


### Installation
The VoiceNotes.com Sync Plugin is available in the Obsidian Community Plugins area.

1. Turn off restricted mode if it's on
2. Click 'Browse' under Community pllugins and search for "Voicenotes"
3. Install and enable the plugin
4. Click the gear icon for settings to login to voicenotes.com and sync

### Manual Installation
Two methods and the first one is easier:

#### Method 1
- Enable community plugins and install Obsidian42 - BRAT
- Go to settings and under Beta Plugin List click "Add Beta plugin" and type mysticcoders/voicenotes-sync

#### Method 2
- Create an `voicenotes-sync` folder under `.obsidian/plugins` in your vault. Add the
  `main.js`, `manifest.json`, and the `styles.css` files from the
  [latest release](https://github.com/kinabalu/voicenotes-sync/releases) to the folder.

## Say Thanks 🙏

If you like this plugin and would like to buy me a coffee, you can!

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-violet.png" alt="BuyMeACoffee" width="100">](https://www.buymeacoffee.com/andrewlombardi)
