function TelegramNotifier(message) {
  UrlFetchApp.fetch('https://api.telegram.org/bot' + this.botToken + '/', {
    method: "POST",
    payload: {
      method: "sendMessage",
      chat_id: String(this.sendTo),
      text: message
    }
  });
}

function FirebaseNotifier(message) {
  UrlFetchApp.fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      Authorization: 'key=' + this.key
    },
    payload: JSON.stringify({
      notification: {
        title: message
      },
      to: this.deviceToken
    })
  })
}

function getNotifiers(userConfig) {
  const notifiers = []
  if (userConfig.useTelegramNotifications) {
    notifiers.push(TelegramNotifier.bind({botToken : userConfig.telegramBotToken, sendTo: userConfig.telegramSendToID}))
  }
  if (userConfig.useFirebaseNotifications) {
    notifiers.push(FirebaseNotifier.bind({deviceToken: userConfig.firebaseDeviceToken, key: userConfig.firebaseNotifyKey}))
  }
  return notifiers
}