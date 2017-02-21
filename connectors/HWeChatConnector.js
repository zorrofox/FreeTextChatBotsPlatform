/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 * 
 * HWeChatConnector.js - for wechat. 
 * 
 * Date: Jan, 2017
 * Author: Hysun He
 */

var Constants = require('../utils/Constants');
var request = require('request');
//var crypto = require('crypto');
//var bodyParser = require('body-parser');
var _ = require('underscore');
var Promise = require('bluebird');
var wechat = require('wechat');
var logger = require('../utils/Logger');
var fs = require('fs');

var mainMenu = require('../schemas/menu.json');

var HWeChatConnector = function(app, _config) {
    this.app = app;
    this.config = _config;
    this.moduleName = 'HWeChatConnector - ' + this.config.BOT_NAME;
};

HWeChatConnector.prototype.start = function() {
    var self = this;
    logger.info(self.moduleName, 'started...');

    // Add main menu
    self.getAccessToken().then(function(accessToken) {
        var options = {
            url: Constants.WECHAT_CREATE_MENU,
            qs: {
                access_token: accessToken.access_token
            },
            json: true,
            body: mainMenu
        };
        request.post(options, function(error, response, body) {
            logger.info(self.moduleName, "*** Create Main Menu, body returned: " + JSON.stringify(body));
            if (response && (response.statusCode === 200 || response.statusCode === 201)) {
                logger.info(self.moduleName, "*** Main menu created.");
            } else {
                logger.error(self.moduleName, "Create Menu ERROR: " + JSON.stringify(error));
            }
        });
    });

    var service = function(req, res) {
        var message = req.weixin;
        var userId = message.FromUserName;
        logger.info(self.moduleName, 'Received wechat message:' + JSON.stringify(message));
        self.sendMessageToBot(userId, message).then(function(botMessage) {
            var messagesToWechat = self.transformMessageToWechatFormat(botMessage.userId, botMessage.payload);
            if (messagesToWechat !== null) {
                if (messagesToWechat.type === "text") {
                    res.reply(messagesToWechat.content);
                } else if (messagesToWechat.type === "news") {
                    res.reply(messagesToWechat.articles);
                }
            }
        });
    };

    self.app.use('/wechat/' + self.config.BOT_NAME, wechat(self.config.WECHAT_VERIFY_TOKEN, service));
};

HWeChatConnector.prototype.sendMessageToBot = function(userId, msg) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.transformMessageToBotFormat(userId, msg).then(function(botMessage) {
            logger.info(self.moduleName, 'Sending message to BotEngine...', botMessage);
            var message = {
                userId: userId,
                replyBackTo: Constants.EVENT_SEND_TO_WECHAT,
                payload: botMessage
            };
            var options = {
                url: Constants.MCS_URL + Constants.MCS_BOT_ENDPOINT + self.config.BOT_NAME,
                headers: {
                    'oracle-mobile-backend-id': Constants.MCS_MBE_ID,
                    'Authorization': Constants.MCS_MBE_AUTH
                },
                json: true,
                body: message.payload
            };
            request.post(options, function(error, response, body) {
                if (response && response.statusCode === 200) {
                    var msg = {
                        userId: message.userId,
                        payload: body
                    };
                    resolve(msg);
                } else {
                    logger.error(self.moduleName, "ERROR: " + JSON.stringify(error));
                    reject(error);
                }
            });
        });
    });
};

/*
 Transforms message received from facebook to BOT Engine format
 @param userId: user ID
 @param body: wechat JSON message received.
 @return formatted message
 */
HWeChatConnector.prototype.transformMessageToBotFormat = function(userId, body) {
    var self = this;
    logger.info(self.moduleName, 'transforming wechat message to BOT Engine format...', body);
    return new Promise(function(resolve, reject) {
        self.getUserProfile(userId).then(function(userProfile) {
            logger.info(self.moduleName, 'user profile is ', JSON.stringify(body));
            var metadata = {};
            metadata.client = Constants.CLIENT_WECHAT;
            metadata.user = userId;
            if (userProfile.nickname) {
                metadata.firstName = userProfile.nickname;
                metadata.lastName = userProfile.nickname;
            } else {
                metadata.firstName = "Unkown";
                metadata.lastName = "NA";
            }

            var msgToBot = {};
            // user input
            if (body.Content) {
                var input = body.Content.toLowerCase();
                if (input === Constants.KEYWORD_MENU || input === Constants.BOT_EVENTID_START) {
                    msgToBot.event = Constants.BOT_EVENTID_START;
                }
            }
            // menu click event
            if (body.MsgType === 'event') {
                if (body.Event === 'subscribe') {
                    // display main menu automatically
                    msgToBot.event = Constants.BOT_EVENTID_START;
                }
                if (body.Event === 'CLICK') {
                    msgToBot.event = Constants.BOT_EVENTID_START;
                    if (body.EventKey !== Constants.KEYWORD_MENU) {
                        metadata.language = body.EventKey;
                    }
                }
            }
            if (!msgToBot.event) {
                msgToBot.event = Constants.BOT_EVENTID_FREE_TEXT;
                msgToBot.value = body.Content;
            }
            if (!metadata.language) {
                if (userProfile.language && (userProfile.language.toLowerCase().indexOf(Constants.DEFAULT_LANGUAGE) < 0)) {
                    metadata.language = userProfile.language.toLowerCase();
                } else {
                    metadata.language = Constants.DEFAULT_LANGUAGE;
                }
            }
            msgToBot.metadata = metadata;
            resolve(msgToBot);
        });
    });
};

/*
 Transforms message received from BOT Engine to wechat format
 @param userId: user ID
 @param body: JSON message to send to facebook.
 @return and array of formatted messages ready to be sent to wechat
 */
HWeChatConnector.prototype.transformMessageToWechatFormat = function(userId, body) {
    var self = this;
    logger.info(self.moduleName, 'transforming message to wechat format...', body);

    var wechatMsg = {};
    wechatMsg.type = 'text';
    wechatMsg.content = '';

    // Check if response received form Bot Engine contains any 'prompts' i.e. textMessage message. if yes, then create
    // a corresponding facebook textMessage message (message bubble)) for each 'prompts'.
    if (!_.isUndefined(body.items)) {
        body.items.forEach(function(item) {
            if (item.type === 'attachment' || item.type === 'cards') {
                wechatMsg.type = "news";
                return;
            }
        });

        if (wechatMsg.type === 'news') {
            var articles = [];
            body.items.forEach(function(item) {
                if (item.type === 'prompt') {
                    var article = {};
                    article.title = item.prompt;
                    articles.push(article);
                }
                if (item.type === 'attachment') {
                    var article = {};
                    article.title = "";
                    article.url = item.url;
                    article.picurl = item.url;
                    articles.push(article);
                }
                if (item.type === 'cards') {
                    var article;
                    item.cards.forEach(function(card) {
                        article = {};
                        article.title = card.title;
                        articles.push(article);

                        article = {};
                        article.title = card.subTitle;
                        if (card.imageUrl) {
                            article.picurl = card.imageUrl;
                        }
                        if (card.cardUrl) {
                            article.url = card.cardUrl;
                        }
                        articles.push(article);
                        if (card.options) {
                            card.options.forEach(function(option) {
                                article = {};
                                article.title = option.prompt;
                                if (option.url) {
                                    article.url = option.url;
                                }
                                if (option.picurl) {
                                    article.picurl = option.picurl;
                                }
                                articles.push(article);
                            });
                        }
                    });
                }
            });
            wechatMsg.articles = articles;
        }

        if (wechatMsg.type === 'text') {
            body.items.forEach(function(item) {
                if (!_.isUndefined(item.prompt)) {
                    wechatMsg.content = wechatMsg.content + (wechatMsg.content ? '\n' : '') + item.prompt;
                }
                // Check if response received form Bot Engine contains any 'options' i.e. buttons. if yes, then create
                // a corresponding facebook postbak button/quick_reply button for each and every 'option' and add to buttons array
                if (!_.isUndefined(item.options) && !_.isEmpty(item.options)) {
                    item.options.forEach(function(option) {
                        wechatMsg.content = wechatMsg.content + (wechatMsg.content ? '\n' : '') + option.prompt + '\n'; //+ option.payload.event;
                    });
                }
            });
        }
    }
    logger.info(self.moduleName, 'To webchat message: ' + JSON.stringify(wechatMsg));
    return wechatMsg;
};

HWeChatConnector.prototype.getAccessToken = function() {
    var self = this;
    var accessTokenFile = './utils/' + self.config.BOT_NAME;
    return new Promise(function(resolve, reject) {
        logger.info(self.moduleName, '***get wechat access token');

        // wechat needs acces token to be update before two hours is reached, here I check one hour
        fs.exists(accessTokenFile, function(exists) {
            var needUpdate = false;
            if (exists) {
                var fileStat = fs.statSync(accessTokenFile);
                if ((new Date().getTime() - fileStat.mtime.getTime()) / 1000 > 3600) {
                    needUpdate = true;
                }
            } else {
                needUpdate = true;
            }

            if (!needUpdate) {
                var access_token = fs.readFileSync(accessTokenFile, "utf-8");
                logger.info(self.moduleName, "access_token is from file: " + access_token);
                resolve({
                    "access_token": access_token
                });

            } else {
                // update access token
                var options = {
                    url: Constants.WECHAT_API_TOKEN,
                    qs: {
                        grant_type: 'client_credential',
                        appid: self.config.WECHAT_APPID,
                        secret: self.config.WECHAT_SECRET
                    },
                    json: true
                };

                request.get(options, function(error, response, body) {
                    if (error) {
                        logger.error(self.moduleName, "!ERROR: " + JSON.stringify(error));
                        reject(error);
                    } else if (response.statusCode === 200) {
                        fs.writeFile(accessTokenFile, body.access_token, function(err) {
                            if (err)
                                throw err;
                            logger.info(self.moduleName, "access_token is updated");
                        });
                        resolve(body);
                    } else if (response.statusCode === 500) {
                        logger.error(self.moduleName, "ERROR: " + JSON.stringify(error));
                        reject(error);
                    }
                });
            }
        });
    });
};

HWeChatConnector.prototype.getUserProfile = function(userId) {
    var self = this;
    return new Promise(function(resolve, reject) {
        logger.info(self.moduleName, 'fetching user [' + userId + '] profile from wechat...');
        self.getAccessToken().then(function(accessToken) {
            logger.info(self.moduleName, 'access token is ' + JSON.stringify(accessToken));
            var options = {
                url: Constants.WECHAT_API_USER_INFO,
                qs: {
                    access_token: accessToken.access_token,
                    openid: userId
                },
                json: true
            };
            logger.info(self.moduleName, "options: " + JSON.stringify(options));
            request.get(options, function(error, response, body) {
                if (response.statusCode === 200) {
                    resolve(body);
                } else {
                    logger.error(self.moduleName, "ERROR: " + JSON.stringify(error));
                    reject(error);
                }
            });
        });
    });
};

module.exports = HWeChatConnector;