function getStatsSpreadsheet(spreadsheet) {
  return spreadsheet.getSheetByName('[STATS]') || createStatsTable(spreadsheet)
}

function createStatsTable(spreadsheet) {
  const table = spreadsheet.insertSheet('[STATS]')
  const header = ["NAME", "ID", "ROWS", "PUBLIC", "UNLISTED", "RESTRICTED", "PRIVATE", "DELETED", "RESTORED", "AVAILABILITY"]
  table.appendRow(header)
  table.getRange(1, 1, 1, header.length).setFontWeight("bold");
  return table
}

class Stats {
  constructor(spreadsheet) {
    this.table = getStatsSpreadsheet(spreadsheet)
    this.lookupTable = new PlaylistLookupTable(this.table)
  }
  _getCountIF(name, search, range='F2:F') {
    return `=COUNTIF('${name}'!${range};"${search}")`
  }
  _getAvailavility(R) {
    return `=100-(F${R}+G${R}+H${R}-I${R})/C${R}*100`
  }
  getSheetNameByPlaylistId(id, currentName) {
    const found = this.lookupTable.getByID(id)
    if (found) {
      return found.NAME
    } else {
      const name = currentName.replace(/'/g, '')
      this.addPlaylist(id, name)
      return name
    }
  }
  addPlaylist(id, name) {
    const getCountIf = this._getCountIF.bind(this, name)
    const row = [
      name,
      id,
      `=COUNTA('${name}'!F2:F)`, 
      ...this.lookupTable._headers.slice(3, 7).map(x => getCountIf(x.toLowerCase())), 
      getCountIf("privacyStatusUnspecified", "F2:F"),
      getCountIf("replaced", "G2:G"),
      this._getAvailavility(this.table.getLastRow() + 1)
    ]
    this.table.appendRow(row)
  }
}