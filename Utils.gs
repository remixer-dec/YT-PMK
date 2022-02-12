function mainWrapper() {
  // allow only 1 parallel execution per user
  const lock = LockService.getUserLock();
  const canRun = lock.tryLock(10000);
  if (canRun) {
    main()
    lock.releaseLock()
    return new DB().spreadsheetID
  } else return false
}

function setRow(n, values) {
  this.getRange(n, 1, 1, values.length) // start row, start column, number of rows, number of columns
      .setValues([values]);
}

function addRowAfter(n, values) {
  this.insertRows(n + 1, 1) // shift all rows down
  setRow.call(this, n + 1, values)
}

function getRow(n, length) {
  return this.getRange(n, 1, 1, length)
}

function addMultipleRows(rows) {
  if (!rows || rows.length === 0) return
  this.getRange(this.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows)
}

function setBackgroundForMultipleRows(colors, startRow) {
  if (!colors || colors.length === 0) return
  this.getRange(startRow, 1, colors.length, colors[0].length).setBackgrounds(colors)
}

function setRowColor(n, length,  color) {
  return this.getRange(n, 1, 1, length).setBackgroundRGB(...color)
}

// t + 1s | t | t - 1s
function getDurationRegExp(duration) {
  let {hours, minutes, seconds} = duration.match(/(?<hours>\d{1,3}H)?(?<minutes>\d{1,2}M)?(?<seconds>\d{1,2}S)?/).groups;
  [hours, minutes, seconds] = [hours, minutes, seconds].map(x => parseInt(x || 0))
  
  //generate duration in YT-compatible format
  function generate(H, M, S) {
    return `PT${H?H+'H':''}${M?M+'M':''}${S?S+'S':''}`
  }
  function fixTime(H, M ,S) {
    // can be done with Date, but will require more code for 24h+ videos
    if (S > 59) { S = 0; M++ }
    if (M > 59) { M = 0; H++ }
    if (S < 0) {S = 59; M-- }
    if (M < 0) {M = 59; H-- }
    return [H, M, S]
  }
  let first = generate(...fixTime(hours, minutes, seconds - 1))
  let second = generate(...fixTime(hours, minutes, seconds))
  let third = generate(...fixTime(hours, minutes, seconds + 1))
  return new RegExp(`(${first}|${second}|${third})`)
}