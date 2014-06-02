var oauth = require('cloud/oauth.js');
var sha = require('cloud/sha1.js');
var hasOwnProperty = Object.prototype.hasOwnProperty;

function isEmpty(obj) {
    if (obj == null) return true;
    if (obj.length > 0)    return false;
    if (obj.length === 0)  return true;
    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) return false;
    }
    return true;
}

Parse.Cloud.define("generateFeedsForUser", function(request, response) {
  Parse.Cloud.useMasterKey();
  var username = request.params.username;
  var query = new Parse.Query(Parse.User);
  query.equalTo("username", username);
  query.first(function(user) {
    var TwitterMedia = Parse.Object.extend("TwitterMedia");
    var query = new Parse.Query(TwitterMedia)
    query.equalTo("user", user);
    query.descending("tweetID");
    query.first({
      success: function(fetchedTwitterMedia) {
        if (!isEmpty(fetchedTwitterMedia)) {
          console.log(fetchedTwitterMedia);
        }
        var TwitterOAuth = Parse.Object.extend("TwitterOAuth");
        var query = new Parse.Query(TwitterOAuth);
        query.equalTo("user", user);
        query.find({
          success: function(results) {
            //console.log(results);
            var OAuth = results[0];
            var urlLink = 'https://api.twitter.com/1.1/statuses/home_timeline.json';

            var consumerSecret = "kNyT6OtLzNYB9uspygHnhWx11nXXs0oDDf9rD5E2RkzlW6EFPo";
            var tokenSecret = OAuth.get("secret");
            var oauth_consumer_key = "K7G3qi30RXciGattuJ1cBdoNG";
            var oauth_token = OAuth.get("token");

            var nonce = oauth.nonce(32);
            var ts = Math.floor(new Date().getTime() / 1000);
            var timestamp = ts.toString();

            var accessor = {
              "consumerSecret": consumerSecret,
              "tokenSecret": tokenSecret
            };

            var params = {
              "count": 200,
              "exclude_replies": true,
              "contributor_details": false,
              "oauth_version": "1.0",
              "oauth_consumer_key": oauth_consumer_key,
              "oauth_token": oauth_token,
              "oauth_timestamp": timestamp,
              "oauth_nonce": nonce,
              "oauth_signature_method": "HMAC-SHA1"
            };
            if (!isEmpty(fetchedTwitterMedia)) {
              params["since_id"] = fetchedTwitterMedia.get("tweetID");
            }
            var message = {
              "method": "GET",
              "action": urlLink,
              "parameters": params
            };

            oauth.SignatureMethod.sign(message, accessor);
            var normPar = oauth.SignatureMethod.normalizeParameters(message.parameters);
            //console.log("Normalized Parameters: " + normPar);
            var baseString = oauth.SignatureMethod.getBaseString(message);
            //console.log("BaseString: " + baseString);
            var sig = oauth.getParameter(message.parameters, "oauth_signature") + "=";
            //console.log("Non-Encode Signature: " + sig);
            var encodedSig = oauth.percentEncode(sig);
            //console.log("Encoded Signature: " + encodedSig);

            var header = 'OAuth oauth_consumer_key="' + oauth_consumer_key + '", oauth_nonce="' + nonce + '", oauth_signature="' + encodedSig + '", oauth_signature_method="HMAC-SHA1", oauth_timestamp="' + timestamp + '", oauth_token="' + oauth_token + '", oauth_version="1.0"';
            //console.log("Header: " + header);

            var requestParams = {
              count: 200,
              exclude_replies: true,
              contributor_details: false
            };
            if (!isEmpty(fetchedTwitterMedia)) {
              requestParams["since_id"] = fetchedTwitterMedia.get("tweetID");
            }

            Parse.Cloud.httpRequest({
              method: 'GET',
              url: urlLink,
              headers: {
                "Authorization": header
              },
              params: requestParams,
              body: {
              },
              success: function(httpResponse) {
                //console.log(httpResponse.text);
                var objs = [];
                httpResponse.data.forEach(function(tweet) {
                  if (!isEmpty(fetchedTwitterMedia)) {
                    console.log(tweet["id"]);
                    console.log(fetchedTwitterMedia.get("tweetID"));
                    if (tweet["id"] == fetchedTwitterMedia.get("tweetID")) {
                      return;
                    }
                  }
                  var tweetUser = tweet["user"];
                  var entities = tweet["entities"];
                  if (!isEmpty(entities)) {
                    var media = entities["media"];
                    if (!isEmpty(media)) {
                      media.forEach(function(photo) {
                        // console.log(tweet["id"]);
                        // console.log(photo["media_url"]);
                        // console.log(tweetUser["name"]);
                        // console.log(tweet["text"]);

                        var twitterMedia = new TwitterMedia();
                        twitterMedia.set("url", photo["media_url"]);
                        twitterMedia.set("text", tweet["text"]);
                        twitterMedia.set("userName", tweetUser["name"]);
                        twitterMedia.set("tweetID", tweet["id"]);
                        twitterMedia.set("user", user);
                        var date = new Date(tweet["created_at"]);
                        twitterMedia.set("mediaDate", date);

                        objs.push(twitterMedia);

                      });
                    }
                  }
                });
                Parse.Object.saveAll(objs).then(function(objs) {
                  response.success(objs);
                }, function(error) {
                  console.log(error);
                  response.error("Uh oh, something went wrong.");
                });
              },
              error: function(httpResponse) {
                console.log('Request failed with response ' + httpResponse.status + ' , ' + httpResponse.text);
                response.error("Uh oh, something went wrong.");
              }
            });
          },
          error: function(error) {
            console.log(error);
            response.error("Uh oh, something went wrong.");
          }
        });
      },
      error: function(object) {
        console.log(error);
        sresponse.error("Uh oh, something went wrong.");
      }
    })
  });
});

Parse.Cloud.job("generateFeeds", function(request, status) {
  Parse.Cloud.useMasterKey();
  var query = new Parse.Query(Parse.User);
  query.each(function(user) {
    var TwitterMedia = Parse.Object.extend("TwitterMedia");
    var query = new Parse.Query(TwitterMedia)
    query.equalTo("user", user);
    query.descending("tweetID");
    query.first({
      success: function(fetchedTwitterMedia) {
        if (!isEmpty(fetchedTwitterMedia)) {
          console.log(fetchedTwitterMedia);
        }
        var TwitterOAuth = Parse.Object.extend("TwitterOAuth");
        var query = new Parse.Query(TwitterOAuth);
        query.equalTo("user", user);
        query.find({
          success: function(results) {
            //console.log(results);
            var OAuth = results[0];
            var urlLink = 'https://api.twitter.com/1.1/statuses/home_timeline.json';

            var consumerSecret = "kNyT6OtLzNYB9uspygHnhWx11nXXs0oDDf9rD5E2RkzlW6EFPo";
            var tokenSecret = OAuth.get("secret");
            var oauth_consumer_key = "K7G3qi30RXciGattuJ1cBdoNG";
            var oauth_token = OAuth.get("token");

            var nonce = oauth.nonce(32);
            var ts = Math.floor(new Date().getTime() / 1000);
            var timestamp = ts.toString();

            var accessor = {
              "consumerSecret": consumerSecret,
              "tokenSecret": tokenSecret
            };

            var params = {
              "count": 200,
              "exclude_replies": true,
              "contributor_details": false,
              "oauth_version": "1.0",
              "oauth_consumer_key": oauth_consumer_key,
              "oauth_token": oauth_token,
              "oauth_timestamp": timestamp,
              "oauth_nonce": nonce,
              "oauth_signature_method": "HMAC-SHA1"
            };
            if (!isEmpty(fetchedTwitterMedia)) {
              params["since_id"] = fetchedTwitterMedia.get("tweetID");
            }
            var message = {
              "method": "GET",
              "action": urlLink,
              "parameters": params
            };

            oauth.SignatureMethod.sign(message, accessor);
            var normPar = oauth.SignatureMethod.normalizeParameters(message.parameters);
            //console.log("Normalized Parameters: " + normPar);
            var baseString = oauth.SignatureMethod.getBaseString(message);
            //console.log("BaseString: " + baseString);
            var sig = oauth.getParameter(message.parameters, "oauth_signature") + "=";
            //console.log("Non-Encode Signature: " + sig);
            var encodedSig = oauth.percentEncode(sig);
            //console.log("Encoded Signature: " + encodedSig);

            var header = 'OAuth oauth_consumer_key="' + oauth_consumer_key + '", oauth_nonce="' + nonce + '", oauth_signature="' + encodedSig + '", oauth_signature_method="HMAC-SHA1", oauth_timestamp="' + timestamp + '", oauth_token="' + oauth_token + '", oauth_version="1.0"';
            //console.log("Header: " + header);

            var requestParams = {
              count: 200,
              exclude_replies: true,
              contributor_details: false
            };
            if (!isEmpty(fetchedTwitterMedia)) {
              requestParams["since_id"] = fetchedTwitterMedia.get("tweetID");
            }

            Parse.Cloud.httpRequest({
              method: 'GET',
              url: urlLink,
              headers: {
                "Authorization": header
              },
              params: requestParams,
              body: {
              },
              success: function(httpResponse) {
                //console.log(httpResponse.text);
                var objs = [];
                httpResponse.data.forEach(function(tweet) {
                  if (!isEmpty(fetchedTwitterMedia)) {
                    console.log(tweet["id"]);
                    console.log(fetchedTwitterMedia.get("tweetID"));
                    if (tweet["id"] == fetchedTwitterMedia.get("tweetID")) {
                      return;
                    }
                  }
                  var tweetUser = tweet["user"];
                  var entities = tweet["entities"];
                  if (!isEmpty(entities)) {
                    var media = entities["media"];
                    if (!isEmpty(media)) {
                      media.forEach(function(photo) {
                        // console.log(tweet["id"]);
                        // console.log(photo["media_url"]);
                        // console.log(tweetUser["name"]);
                        // console.log(tweet["text"]);

                        var twitterMedia = new TwitterMedia();
                        twitterMedia.set("url", photo["media_url"]);
                        twitterMedia.set("text", tweet["text"]);
                        twitterMedia.set("userName", tweetUser["name"]);
                        twitterMedia.set("tweetID", tweet["id"]);
                        twitterMedia.set("user", user);
                        var date = new Date(tweet["created_at"]);
                        twitterMedia.set("mediaDate", date);

                        objs.push(twitterMedia);

                      });
                    }
                  }
                });
                Parse.Object.saveAll(objs).then(function(objs) {
                  status.success("Feeds generated successfully.");
                }, function(error) {
                  console.log(error);
                  status.error("Uh oh, something went wrong.");
                });
              },
              error: function(httpResponse) {
                console.log('Request failed with response ' + httpResponse.status + ' , ' + httpResponse.text);
                status.error("Uh oh, something went wrong.");
              }
            });
          },
          error: function(error) {
            console.log(error);
            status.error("Uh oh, something went wrong.");
          }
        });
      },
      error: function(object) {
        console.log(error);
        status.error("Uh oh, something went wrong.");
      }
    })
  });
});
