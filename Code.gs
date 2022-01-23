// DOCS:
// https://developers.google.com/youtube/v3/docs/playlistItems
// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/sheets
// https://developers.google.com/sheets/api/guides/concepts
// https://developers.google.com/apps-script/reference/spreadsheet/sheet

const db = new DB()
const deletedStatusSet = new Set(['private', 'privacyStatusUnspecified'])

let logTable = false
let notifiers = []
let userConfig = {}
const readOnlyPlaylists = new Set()

function createActionHistoryTable(spreadsheet) {
  const table = spreadsheet.insertSheet('[LOG]')
  const header = ["DATE", "EVENT", "TARGET ID", "OLD VALUE", "NEW VALUE"]
  table.appendRow(header)
  return table
}

function logAction(event, target = '', oldValue = '', newValue = '', notify = false) {
  if (logTable) {
    logTable.appendRow([new Date(), event, target, oldValue, newValue])
  }
  if (notify) {
    notifiers.forEach(sendMessage => sendMessage(`YouTubePlaylistBot: ${event} ${notify} [${oldValue} -> ${newValue}]`))
  }
}

function getRowFromVideo(video, videoType = "original") {
  const {channelTitle, channelId, title, thumbnails } = video.snippet
    const {duration} = video.contentDetails
    const {privacyStatus} = video.status
    const hasThumbnail = 'default' in thumbnails
    const thumbnail = hasThumbnail ? `=HYPERLINK("${thumbnails.maxres?.url || thumbnails.standard?.url || thumbnails.high?.url}"; IMAGE("${thumbnails.default.url}"; 2))` : 
    '=IMAGE("https://i.ytimg.com/img/no_thumbnail.jpg"; 2)'
    const link = deletedStatusSet.has(privacyStatus) ? `https://web.archive.org/web/https://www.youtube.com/watch?v=${video.id}` : `https://youtu.be/${video.id}`
    const channel = deletedStatusSet.has(privacyStatus) ? '' : `=HYPERLINK("https://www.youtube.com/channel/${channelId}"; "${channelTitle.replace(/"/g,"'")}")`
    return [
      thumbnail,
      `=HYPERLINK("${link}"; "${title.replace(/"/g,"'")}")`,
      channel,
      duration ? duration.slice(2) : '',
      video.id,
      privacyStatus,
      videoType
    ]
}

function processRowsFromVideos(videos, table) {
  const rows = []
  const colors = []
  let rowOffset = table.getLastRow() + 1
  let colorRowOffset = rowOffset
  let colOffset = table.getLastColumn()
  console.log(`Adding rows to the table`)
  for (let r = 0, vl = videos.length; r < vl; r++, rowOffset++) {
    const video = videos[r]
    const row = getRowFromVideo(video)
    rows.push(row)
    colors.push(Array(colOffset).fill(deletedStatusSet.has(video.status.privacyStatus) ? '#ebc7df' : '#ffffff')) 
  }
  addMultipleRows.call(table, rows)
  setBackgroundForMultipleRows.call(table, colors, colorRowOffset)
  SpreadsheetApp.flush()
}

function createPlaylistTable(playlist, spreadsheet) {
  const table = spreadsheet.insertSheet(playlist.snippet.title)
  const header = ["PREVIEW", "TITLE", "CHANNEL", "DURATION", "ID", "STATUS", "TYPE"]
  table.appendRow(header)
  table.getRange(1,1,1, header.length).setFontWeight("bold")
  const playlistVideos = getPlaylistVideos(playlist.id).items
  const videos = getVideosWithFullMetadata(playlistVideos).items
  processRowsFromVideos(videos, table)
  table.autoResizeColumns(1, header.length + 1)
  table.setRowHeights(1, videos.length + 1, 40)
}

function checkPlaylistTable(playlist, table) {
  const playlistVideos = getPlaylistVideos(playlist.id).items
  const videos = getVideosWithFullMetadata(playlistVideos).items
  const savedData = new PlaylistLookupTable(table)
  let indexOffset = 0
  let videosToAdd = []
  for (let i = 0, l = videos.length; i < l; i++) {
    const video = videos[i]
    const {privacyStatus} = video.status
    const savedItem = savedData.getByID(video.id)
    const nextSavedItem = savedData.getByID(videos[i + 1]?.id)
    if (savedItem) {
      const videoRestricted = isRegionRestricted(video, userConfig.regionRestrictionCountryCode)
      if ((savedItem.STATUS !== privacyStatus) || videoRestricted) {
        if (savedItem.STATUS === 'restricted' && !deletedStatusSet.has(privacyStatus)) {
          continue
        }
        let cell = table.getRange(savedItem.rowIndex + indexOffset, 6)
        cell.setValue(videoRestricted ? 'restricted' : privacyStatus)
        const setColor = setRowColor.bind(table, savedItem.rowIndex + indexOffset, table.getLastColumn())
        if (deletedStatusSet.has(privacyStatus) || videoRestricted) {
          if (!videoRestricted) {
            setColor([255, 235, 238])
            table.getRange(savedItem.rowIndex + indexOffset, 2)
                 .setValue(`=HYPERLINK("https://web.archive.org/web/https://www.youtube.com/watch?v=${savedItem.ID}"; "${savedItem.TITLE}")`)
            logAction(`Video ${savedItem.TITLE} has been removed (playlist ${playlist.snippet.title})`, video.id, savedItem.STATUS, privacyStatus, `https://youtu.be/${video.id}`)
          } else {
            setColor([255, 226, 183])
            logAction(`Video ${savedItem.TITLE} has been region restricted (playlist ${playlist.snippet.title})`, video.id, savedItem.STATUS, 'restricted', `https://youtu.be/${video.id}`)
          }
          if (userConfig.tryToRestoreVideosAutomatically && !readOnlyPlaylists.has(playlist.id)) {
            const searchResults = getVideosFromSearch(savedItem.TITLE)
            // try the same duration
            const exactDuration = new RegExp(savedItem.DURATION)
            let found = searchResults.find(v => v.contentDetails.duration.match(exactDuration) && !isRegionRestricted(v, userConfig.regionRestrictionCountryCode))
            if (!found) {
              // try the same duration +- 1 second
              let durationPlusMinus1Second = getDurationRegExp(savedItem.DURATION)
              found = searchResults.find(v => v.contentDetails.duration.match(durationPlusMinus1Second) && !isRegionRestricted(v, userConfig.regionRestrictionCountryCode))
            }
            // add replacement video to the table and the playlist and send a notification
            if (found) {
              const row = getRowFromVideo(found, "replaced")
              if (userConfig.replaceOldVideosInPlaylist) {
                deleteVideoFromPlaylist(playlistVideos[i].id)
                logAction('Removed old video from the playlist', savedItem.ID, savedItem.TITLE,)
              }
              if ((nextSavedItem && nextSavedItem.TYPE !== 'replaced') || !nextSavedItem) {
                addVideoToPlaylist(found.id, playlist.id, i + indexOffset)
                logAction('Restored missing video from a search result', found.id, savedItem.TITLE, found.snippet.title, `https://youtu.be/${found.id}`)
                addRowAfter.call(table, savedItem.rowIndex + indexOffset, row)
                indexOffset++
                setRowColor.call(table, savedItem.rowIndex + indexOffset, table.getLastColumn(), [226, 247, 223])
              }
            } else {
              if (videoRestricted) setColor([255, 146, 24])
              else setColor([244, 102, 102])
              logAction('Unable to find a replacement for the video', savedItem.ID, '', '', savedItem.TITLE)
            }
          }
        } else {
          setColor([245, 245, 245])
          logAction('Privacy status changed', video.id, savedItem.STATUS, privacyStatus)
        }
      }
    } else {
      // a new video has been added to the playlist
      videosToAdd.push(video)
    }
  }
  if (videosToAdd.length > 0) {
    processRowsFromVideos(videosToAdd, table)
    logAction(`Imported new videos (${videosToAdd.length}) from the playlist ${playlist.snippet.title}`, playlist.id)
  }
  if (videosToAdd.length > 0 || indexOffset > 0) table.setRowHeights(1, table.getLastRow(), 40)

}

function main() {
  let spreadsheet = getSpreadsheet()
  userConfig = new UserConfigDB(spreadsheet)
  notifiers = getNotifiers(userConfig)
  logTable = spreadsheet.getSheetByName('[LOG]') || createActionHistoryTable(spreadsheet)
  logAction('Script execution started')
  let tableNames = new Set(spreadsheet.getSheets().map(sheet => sheet.getSheetName()))
  let myPlaylists =  []
  if (userConfig.saveMyPlaylists) {
    myPlaylists = getMyPlaylists().items
  } 
  
  if (userConfig.saveLikedVideosPlaylist) {
    myPlaylists.push({snippet: {title: 'Liked'}, id: 'LL'})
    readOnlyPlaylists.add('LL')
  }

  if (userConfig.excludePlaylistIdsCommaSeparated) {
    const excluded = new Set(userConfig.excludePlaylistIdsCommaSeparated.split(','))
    myPlaylists = myPlaylists.filter(p => !excluded.has(p.id))
  }

  if (userConfig.includePlaylistIdsCommaSeparated) {
    let included = userConfig.includePlaylistIdsCommaSeparated.split(',')
    included = included.filter(p => p.startsWith('PL'))
    included = getPlaylists(included.join(',')).items
    myPlaylists.push(...included)
  }

  myPlaylists.forEach((playlist, index) => {
    if (tableNames.has(playlist.snippet.title)) {
      console.log('Checking playlist', (index + 1) + '/' + myPlaylists.length)
      checkPlaylistTable(playlist, spreadsheet.getSheetByName(playlist.snippet.title))
    } else {
      console.log('Adding playlist', (index + 1) + '/' + myPlaylists.length)
      logAction('Adding new playlist to the table', playlist.id, '', playlist.snippet.title)
      createPlaylistTable(playlist, spreadsheet)
    }
  })
  logAction('Script execution ended')
}

function getSpreadsheet() {
  if (db.spreadsheetID) {
    try {
      let s = SpreadsheetApp.openById(db.spreadsheetID)
      if (s) return s
    } catch(e) {
      console.error(e)
    }
  }
  let sheet = Sheets.newSpreadsheet()
  sheet.properties = Sheets.newSpreadsheetProperties()
  sheet.properties.title = 'YoutubePlaylistMetadata'
  let file = Sheets.Spreadsheets.create(sheet)
  db.spreadsheetID = file.spreadsheetId
  console.log('Created new spreadsheet', 'https://docs.google.com/spreadsheets/d/' + file.spreadsheetId)
  return SpreadsheetApp.openById(file.spreadsheetId)
}