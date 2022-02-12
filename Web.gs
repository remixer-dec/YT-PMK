function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function getTriggerCount() {
  return ScriptApp.getProjectTriggers().length
}

function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers()
  for (let trigger of triggers) {
    ScriptApp.deleteTrigger(trigger)
  }
}

function addTrigger(weekly) {
  let trigger = ScriptApp.newTrigger('main').timeBased()
  if (weekly) {
    trigger = trigger.everyWeeks(1).onWeekDay(ScriptApp.WeekDay.MONDAY)
  } else {
    trigger = trigger.onMonthDay(1);
  }
  trigger.atHour(0).create();
}

function getUsedSpreadsheetID() {
  return new DB().spreadsheetID || false
}

function configureAndRun(cfg) {
  customConfig = cfg.custom
  if (!cfg.once) addTrigger(cfg.weekly)
  return mainWrapper()
}