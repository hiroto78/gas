/*
 * This is a script that posts a tweet to Twitter. The tweet source is a spreadsheet.
 *
 * 1. Set up a new script project and add library
 *    In the "Find a Library" text box, enter the script ID. `1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF`
 *    https://github.com/googleworkspace/apps-script-oauth2
 * 2. Run firstLogin() for authorization which is enough to do once.
 * 3. Run main() to post a tweet.
 */

const endpoint = "https://api.twitter.com/2/tweets";

/**
 * This is main function to post a tweet.
 * This script is trrigered by time-driven trigger in Google Apps Script.
 * https://developers.google.com/apps-script/guides/triggers/installable#time-driven_triggers
 * You can set up the trigger in Google Apps Script editor.
 */
function main() {
  const targetRow = _fetchTweetContentRow();
  _putDate(targetRow);
  console.log(targetRow);

  const originalTweet = targetRow[1]
  const replyTweet = targetRow[2]
  const result = _postTwitter(originalTweet);
  if (replyTweet != '') {
    _postTwitter(replyTweet, result.data.id);
  }
}

/**
 * This is only one time function to login Twitter via Application which is registered in Twitter Developer Portal.
 * You can get clientId and clientSecret from Twitter Developer Portal. Please set them to script properties in google script editor.
 * clientId and clientSecret are not included in this repository.
 * https://developer.twitter.com/en/portal/dashboard
 *
 * @return {null}
 */
function firstLogin() {
  const service = _getService();
  if (service.hasAccess()) {
    Logger.log("Already authorized");
  } else {
    const authorizationUrl = service.getAuthorizationUrl();
    Logger.log('Open the following URL: %s', authorizationUrl);
  }
}

/* ---------------------------- */

/**
 * Returns array - [row, originalTweet, replyTweet, status, date]
 *
 * @return array
 */
function _fetchTweetContentRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("tweetlist");
  const rows = sheet.getDataRange().getValues();
  var targetRow = null;

  // loop through rows
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][4] == '' && rows[i][3] == 'ok') {
      targetRow = rows[i]
      break;
    }
  }
  return targetRow;
}

/**
 * Returns null(void)
 *
 * @param {array} targetRow - [row, originalTweet, replyTweet, status, date]
 * @return {null}
 */
function _putDate(targetRow) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("tweetlist");
  const today = new Date();
  const todayStr = Utilities.formatDate(today, 'JST', 'yyyy-MM-dd');
  sheet.getRange(targetRow[0] + 1, 5).setValue(todayStr);

  return;
}

function _postTwitter(tweetText, replyTweetId){
  let service = _getService();
  if (service.hasAccess()) {
    let message = {
      text: tweetText
    }
    if (replyTweetId) {
      message.reply = {in_reply_to_tweet_id: replyTweetId};
    }

    let header = {
      Authorization: 'Bearer ' + service.getAccessToken()
    }
    const response = UrlFetchApp.fetch(endpoint, {
      method: "post",
      headers: {
        Authorization: 'Bearer ' + service.getAccessToken()
      },
      muteHttpExceptions: true,
      payload: JSON.stringify(message),
      contentType: "application/json"
    });

    const result = JSON.parse(response.getContentText());

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } else {
    Logger.log("Not Authorized");
    return null;
  }
}

function _getService() {
  _pkceChallengeVerifier();
  const userProps = PropertiesService.getUserProperties();
  const scriptProps = PropertiesService.getScriptProperties();
  const clientId = scriptProps.getProperty("clientId");
  const clientSecret = scriptProps.getProperty("clientSecret");

  return OAuth2.createService('twitter')
    .setAuthorizationBaseUrl('https://twitter.com/i/oauth2/authorize')
    .setTokenUrl('https://api.twitter.com/2/oauth2/token?code_verifier=' + userProps.getProperty("code_verifier"))
    .setClientId(clientId)
    .setClientSecret(clientSecret)
    .setCallbackFunction('_authCallback')
    .setPropertyStore(userProps)
    .setScope('users.read tweet.read tweet.write offline.access')
    .setParam('response_type', 'code')
    .setParam('code_challenge_method', 'S256')
    .setParam('code_challenge', userProps.getProperty("code_challenge"))
    .setTokenHeaders({
      'Authorization': 'Basic ' + Utilities.base64Encode(clientId + ':' + clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded'
    })
}

// https://script.google.com/home/projects/********/edit
// -> https://script.google.com/macros/d/********/usercallback (Set in Twitter App)
function _authCallback(request) {
  const service = _getService();
  const authorized = service.handleCallback(request);
  if (authorized) {
    return HtmlService.createHtmlOutput('Success!');
  } else {
    return HtmlService.createHtmlOutput('Denied.');
  }
}

function _pkceChallengeVerifier() {
  var userProps = PropertiesService.getUserProperties();
  if (!userProps.getProperty("code_verifier")) {
    var verifier = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

    for (var i = 0; i < 128; i++) {
      verifier += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    const sha256Hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, verifier)

    const challenge = Utilities.base64Encode(sha256Hash)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    userProps.setProperty("code_verifier", verifier)
    userProps.setProperty("code_challenge", challenge)
  }
}

function logRedirectUri() {
  const service = _getService();
  Logger.log(service.getRedirectUri());
}

/**
 * Example response from Twitter API
 */

/*
{
  "data": {
    "edit_history_tweet_ids": [
      "1647401034078212096"
    ],
    "id": "1647401034078212096",
    "text": "Teeet!!!"
  }
}
*/

/*
{
  "data": {
    "edit_history_tweet_ids": [
      "1647401883567357952"
    ],
    "id": "1647401883567357952",
    "text": "Reply to tweet"
  }
}
*/
