class DB {
  constructor() {
    this._db = PropertiesService.getUserProperties();
    return new Proxy(this, {
      get: (target, prop) => this._db.getProperty(prop),
      set: (target, prop, value) => this._db.setProperty(prop, value)
    })
  }
}

class PlaylistLookupTable {
  constructor(table) {
    this._arrTable = table.getRange(1, 1, table.getLastRow(), table.getLastColumn()).getValues();
    this._headers = this._arrTable.splice(0, 1)[0]
    this._indexes = {}
    this._headers.forEach((h, i) => this._indexes[h] = i)
    this._ids = {}
    this._arrTable.forEach((item, index) => {
      item.rowIndex = index + 2;
      this._ids[item[this._indexes['ID']]] = item
    })
  }
  _asObject(row) {
    if (!row) return
    let obj = Object.create(null)
    for (let i = 0, l = row.length; i<l; i++) {
      obj[this._headers[i]] = row[i] 
    }
    obj.rowIndex = row.rowIndex
    return obj
  }
  find(key, value) {
    let index = this._indexes[key]
    if (!index) return
    return this._asObject(this._arrTable.find(item => item[index] === value));
  }
  getByID(id) {
    return this._asObject(this._ids[id]);
  }
}

const defaultConfig = {
  saveMyPlaylists: true,
  saveLikedVideosPlaylist: false,
  useFirebaseNotifications: false,
  firebaseNotifyKey: '',
  firebaseDeviceToken: '',
  useTelegramNotifications: false,
  telegramBotToken: '',
  telegramSendToID: '',
  tryToRestoreVideosAutomatically: false,
  replaceOldVideosInPlaylist: false,
  regionRestrictionCountryCode: '',
  excludePlaylistIdsCommaSeparated: '',
  includePlaylistIdsCommaSeparated: ''
}

class UserConfigDB {
  constructor(spreadsheet) {
    let sheet = spreadsheet.getSheets()[0];
    if (sheet.getSheetName() != '[CONFIG]') {
      sheet.setName('[CONFIG]')
      sheet.appendRow(['KEY', 'VALUE']);
      sheet.getRange(1, 1, 1, 2).setFontWeight("bold");
      for (let key in defaultConfig) {
        // true and false values get localized and can lead to unexpected input
        sheet.appendRow([key, (typeof defaultConfig[key] === "boolean")? defaultConfig[key] ? 'yes' : 'no' : defaultConfig[key]])
      }
      sheet.autoResizeColumns(1, 2);
      return defaultConfig
    } else {
      const range = sheet.getRange(2, 1, 14, 2).getValues()
      range.forEach(el => {el[1] = String(el[1]).match(/yes|no/) ? el[1] === 'yes' : el[1]})
      return Object.fromEntries(range)
    }
  }
}