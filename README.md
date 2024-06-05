## Voicenotes Sync
Plugin offers the ability to sync down your thoughts an ideas from the voicenotes.com online service. The service
uses an API key which the plugin can grab post login and we do not save anything but the username in the settings file.

Through the plugin settings one can customize the sync directory and frequency, download the audio file used in the 
transcript and any AI generated summaries or actions become sections in the note text.

### Features
- Sync data from VoiceNotes.com including any AI generated summaries or actions
- Customize the sync directory and frequency
- Downloads the audio file (default is off)
- Optional mode to delete synced notes from the voicenotes.com server
  - Destructive action which requires double opt-in toggles

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
