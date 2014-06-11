var oauth = require('cloud/oauth.js');
var sha = require('cloud/sha1.js');
var hasOwnProperty = Object.prototype.hasOwnProperty;
var _ = require('underscore');

function isEmpty(obj) {
  if (obj == null) return true;
  if (obj.length > 0)    return false;
  if (obj.length === 0)  return true;
  for (var key in obj) {
    if (hasOwnProperty.call(obj, key)) return false
  }
  return true;
}

function generateTwitterFeed(user) {
  var promise = new Parse.Promise();
  var Media = Parse.Object.extend("Media");
  var query = new Parse.Query(Media)
  query.equalTo("user", user);
  query.equalTo("type", 1);
  query.descending("sinceId");
  query.first({
    success: function(fetchedMedia) {
      var TwitterOAuth = Parse.Object.extend("TwitterOAuth");
      var query = new Parse.Query(TwitterOAuth);
      query.equalTo("user", user);
      query.find({
        success: function(results) {
          if (isEmpty(results)) {
            promise.resolve([]);
          } else {
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
            if (!isEmpty(fetchedMedia)) {
              params["since_id"] = fetchedMedia.get("sinceId");
            }
            var message = {
              "method": "GET",
              "action": urlLink,
              "parameters": params
            };
            oauth.SignatureMethod.sign(message, accessor);
            var normPar = oauth.SignatureMethod.normalizeParameters(message.parameters);
            var baseString = oauth.SignatureMethod.getBaseString(message);
            var sig = oauth.getParameter(message.parameters, "oauth_signature") + "=";
            var encodedSig = oauth.percentEncode(sig);
            var header = 'OAuth oauth_consumer_key="' + oauth_consumer_key + '", oauth_nonce="' + nonce + '", oauth_signature="' + encodedSig + '", oauth_signature_method="HMAC-SHA1", oauth_timestamp="' + timestamp + '", oauth_token="' + oauth_token + '", oauth_version="1.0"';
            var requestParams = {
              count: 200,
              exclude_replies: true,
              contributor_details: false
            };
            if (!isEmpty(fetchedMedia)) {
              requestParams["since_id"] = fetchedMedia.get("sinceId");
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
                var objs = [];
                httpResponse.data.forEach(function(tweet) {
                  if (!isEmpty(fetchedMedia)) {
                    if (tweet["id"] == fetchedMedia.get("sinceId")) {
                      return;
                    }
                  }
                  var tweetUser = tweet["user"];
                  var entities = tweet["entities"];
                  if (!isEmpty(entities)) {
                    var media = entities["media"];
                    if (!isEmpty(media)) {
                      media.forEach(function(photo) {
                        var media = new Media();
                        media.set("url", photo["media_url"]);
                        media.set("text", tweet["text"]);
                        media.set("userName", tweetUser["name"]);
                        media.set("sinceId", tweet["id"]);
                        media.set("user", user);
                        media.set("type", 1);
                        var date = new Date(tweet["created_at"]);
                        media.set("mediaDate", date);
                        objs.push(media);
                      });
                    }
                  }
                });
                Parse.Object.saveAll(objs).then(function(objs) {
                  promise.resolve(objs);
                }, function(error) {
                  console.error(error);
                  promise.reject(error);
                });
              },
              error: function(httpResponse) {
                var error = 'Request failed with response ' + httpResponse.status + ' , ' + httpResponse.text;
                console.error(error);
                promise.reject(error);
              }
            });
          }
        },
        error: function(error) {
          console.error(error);
          promise.reject(error);
        }
      });
    },
    error: function(error) {
      console.error(error);
      promise.reject(error);
    }
  });
  return promise;
}

function updateFacebookMediaURL(OAuth, facebookMedia) {
  var promise = new Parse.Promise();
  var URL = 'https://graph.facebook.com/' + facebookMedia.get('url') + '/?fields=source&?access_token=' + OAuth.get("token");
  Parse.Cloud.httpRequest({
    method: 'GET',
    url: URL,
    success: function(httpResponse) {
      var error = httpResponse.data['error'];
      if (isEmpty(error)) {
        var source = httpResponse.data['source'];
        facebookMedia.save({
          url: source
        }, {
          success: function(facebookMedia) {
            promise.resolve(facebookMedia);
          },
          error: function(facebookMedia, error) {
            promise.reject(error);
          }
        });
      }
    },
    error: function(httpResponse) {
      var error = 'Request failed with response ' + httpResponse.status + ' , ' + httpResponse.text;
      console.error(error);
      facebookMedia.destroy({
        success: function(facebookMedia) {
          promise.resolve(facebookMedia);
        },
        error: function(myObject, error) {
          console.error(error);
          promise.reject(error);
        }
      });
    }
  });
  return promise;
}

function generateFacebookFeed(user) {
  var promise = new Parse.Promise();
  var Media = Parse.Object.extend("Media");
  var query = new Parse.Query(Media)
  query.equalTo("user", user);
  query.equalTo("type", 2);
  query.descending("sinceId");
  query.first({
    success: function(fetchedMedia) {
      var FacebookOAuth = Parse.Object.extend("FacebookOAuth");
      var query = new Parse.Query(FacebookOAuth);
      query.equalTo("user", user);
      query.find({
        success: function(results) {
          if (isEmpty(results)) {
            promise.resolve([]);
          } else {
            var OAuth = results[0];
            var oauth_token = OAuth.get("token");
            var URL = 'https://graph.facebook.com/v2.0/me/photos?';
            if (!isEmpty(fetchedMedia)) {
              URL = URL + encodeURIComponent('fields=source,from,name,created_time') + '&since=' + fetchedMedia.get('sinceId');
            } else {
              URL = URL + encodeURIComponent('fields=source,from,name,created_time');
            }
            URL = URL + '&access_token=' + oauth_token;
            console.log(URL);
            Parse.Cloud.httpRequest({
              method: 'GET',
              url: URL,
              success: function(httpResponse) {
                var data = httpResponse.data['data'];
                var objs = [];
                data.forEach(function(photo) {
                  var media = new Media();
                  media.set("url", photo['source']);
                  media.set("text", photo['name']);
                  media.set("userName", photo['from']['name']);
                  media.set("user", user);
                  media.set("type", 2);
                  var created_time = photo["created_time"];
                  var date = new Date(created_time);
                  media.set("mediaDate", date);
                  media.set("sinceId", date.getTime() / 1000);
                  objs.push(media);
                });
                Parse.Object.saveAll(objs).then(function(objs) {
                  promise.resolve(objs);
                }, function(error) {
                  console.error(error);
                  promise.reject(error);
                });
              },
              error: function(httpResponse) {
                var error = 'Request failed with response ' + httpResponse.status + ' , ' + httpResponse.text;
                console.error(error);
                promise.reject(error);
              }
            });
          }
        },
        error: function(error) {
          console.error(error);
          promise.reject(error);
        }
      });
    },
    error: function(error) {
      console.error(error);
      promise.reject(error);
    }
  });
  return promise;
}

Parse.Cloud.define("disconnectTwitterForUser", function(request, response) {
  Parse.Cloud.useMasterKey();
  var username = request.params.username;
  var query = new Parse.Query(Parse.User);
  query.equalTo("username", username);
  query.first(function(user) {
    var Media = Parse.Object.extend("Media");
    var query = new Parse.Query(Media)
    query.equalTo("user", user);
    query.equalTo("type", 1);
    query.find({
      success: function(results) {
        var promises = [];
        _.each(results, function(media) {
          promises.push(media.destroy());
        });
        Parse.Promise.when(promises).then(function() {
          var TwitterOAuth = Parse.Object.extend("TwitterOAuth");
          var query = new Parse.Query(TwitterOAuth);
          query.equalTo("user", user);
          query.find({
            success: function(results) {
              var OAuth = results[0];
              OAuth.destroy({
                success: function(OAuth) {
                  user.save({
                    isTwitterServiceConnected: false
                  }, {
                    success: function(user) {
                      response.success();
                    },
                    error: function(user, error) {
                      console.error(error);
                      response.error(error);
                    }
                  });
                },
                error: function(OAuth, error) {
                  console.error(error);
                  response.error(error);
                }
              });
            },
            error: function(error) {
              console.error(error);
              response.error(error);
            }
          });
        }, function(error) {
          console.error(error);
          response.error(error);
        });
      },
      error: function(error) {
        console.error(error);
        response.error(error);
      }
    });
  });
});

Parse.Cloud.define("disconnectFacebookForUser", function(request, response) {
  Parse.Cloud.useMasterKey();
  var username = request.params.username;
  var query = new Parse.Query(Parse.User);
  query.equalTo("username", username);
  query.first(function(user) {
    var Media = Parse.Object.extend("Media");
    var query = new Parse.Query(Media)
    query.equalTo("user", user);
    query.equalTo("type", 2);
    query.find({
      success: function(results) {
        var promises = [];
        _.each(results, function(media) {
          promises.push(media.destroy());
        });
        Parse.Promise.when(promises).then(function() {
          var FacebookOAuth = Parse.Object.extend("FacebookOAuth");
          var query = new Parse.Query(FacebookOAuth);
          query.equalTo("user", user);
          query.find({
            success: function(results) {
              var OAuth = results[0];
              OAuth.destroy({
                success: function(OAuth) {
                  user.save({
                    isFacebookServiceConnected: false
                  }, {
                    success: function(user) {
                      response.success();
                    },
                    error: function(user, error) {
                      console.error(error);
                      response.error(error);
                    }
                  });
                },
                error: function(OAuth, error) {
                  console.error(error);
                  response.error(error);
                }
              });
            },
            error: function(error) {
              console.error(error);
              response.error(error);
            }
          });
        }, function(error) {
          console.error(error);
          response.error(error);
        });
      },
      error: function(error) {
        console.error(error);
        response.error(error);
      }
    });
  });
});

Parse.Cloud.define("generateFeedsForUser", function(request, response) {
  Parse.Cloud.useMasterKey();
  var username = request.params.username;
  var query = new Parse.Query(Parse.User);
  query.equalTo("username", username);
  query.first(function(user) {
    var promises = [];
    var feeds = [];
    var facebookFeed = generateFacebookFeed(user);
    facebookFeed.then(function(objs) {
      feeds = feeds.concat(objs);
    }, function(error) {
      console.error(error);
      response.error(error);
    });
    promises.push(facebookFeed);
    var twitterFeed = generateTwitterFeed(user);
    twitterFeed.then(function(objs) {
      feeds = feeds.concat(objs);
    }, function(error) {
      console.error(error);
      response.error(error);
    });
    promises.push(twitterFeed);
    Parse.Promise.when(promises).then(function() {
      feeds.sort(function(a,b) {
        var date1 = a.get('mediaDate');
        var date2 = b.get('mediaDate');
        if (date1 > date2) return -1;
        if (date1 < date2) return 1;
        return 0;
      });
      response.success(feeds);
    }, function(error) {
      console.error(error);
      response.error(error);
    });
  });
});

Parse.Cloud.job("generateFeeds", function(request, status) {
  Parse.Cloud.useMasterKey();
  var query = new Parse.Query(Parse.User);
  query.find().then(function(users) {
    var promises = [];
    _.each(users, function(user) {
      promises.push(generateFacebookFeed(user));
    });
    return Parse.Promise.when(promises);
  }, function(error) {
    console.error(error);
    status.error(error);
  }).then(function() {
    status.success("Feeds generated successfully.");
  }, function(error) {
    console.error(error);
    status.error(error);
  });
});
