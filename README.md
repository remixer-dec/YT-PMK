
#  YouTube Playlist Metadata Keeper

This app, based on [Google Apps Script](https://developers.google.com/apps-script/) can 
- Export YouTube playlist details to a Google Spreadsheet  
- Compare playlists with previously exported data  
- Find removed, privacy and region restricted videos  
- Attempt to restore missing videos from search results, based on original video title and duration  
- Notify about changes via Telegram and Firebase Push Notifications  
- Let you configure desired behavior right in the spreadsheet  
- Log every performed action to the spreadsheet  
  
![demo](https://i.imgur.com/6Yg5clu.gif)
    
This app is currently in a open beta test phase, click [here](https://remixer-dec.github.io/YT-PMK/) to join. Bug reports are welcome. After the first run you can go to your [Google Spreadsheets](https://docs.google.com/spreadsheets/u/0/) and configure the app. By default it only exports your own playlists and reports found changes to the spreadsheet without any modifications to original playlists.

#### Configuration options explained
 - tryToRestoreVideosAutomatically - add a restored video to the table and the playlist if one can be found with Search API
 - replaceOldVideosInPlaylist - remove unavailable video from the playlist before adding a new one
 - regionRestrictionCountryCode - 2 letter code to check if video is restricted in a certain country

#### Limitations: 
Due to API Limits you cannot save viewing history, saved playlists and "Watch Later".  
Currently playlist is linked to a sheet with its name, so renaming the playlist will create a new sheet for it.

Unless you have multiple playlists with tens of thousands of videos, you should be able to run it at no cost with Google's infrastructure using free quotas, otherwise you might face execution time limit or YouTube API rate limits.


