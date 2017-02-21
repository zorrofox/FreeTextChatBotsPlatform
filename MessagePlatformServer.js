/******************************************************************************
 Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved.
 $revision_history$
 13-Nov-2016   Tamer Qumhieh, Oracle A-Team
 1.0           initial creation
 ******************************************************************************/


var moduleName = 'MessagePlatformServer';

// Modules Import
var Constants = require('./utils/Constants');
var fs = require('fs');
var http = require('http');
var express = require('express');
var Promise = require('bluebird');
var request = require('request');
var emitter = require('events').EventEmitter;
var logger = require('./utils/Logger');
var FacebookConnector = require('./connectors/FacebookConnector');
var WebsocketConnector = require('./connectors/WebsocketConnector');
var LineConnector = require('./connectors/LineConnector');
var HWeChatConnector = require('./connectors/HWeChatConnector');

// initialize express
var app = express();
// This line is commented out here however added again in the FacebookConnector, as a now we added some extra security verification steps.
//app.use(bodyParser.json());
var server = http.createServer(app);


server.listen(Constants.HTTP_PORT, function () {
    logger.info(moduleName, 'Listening on ' + server.address().port);
});


// Initialize Events Emitter
var eventsEmitter = new emitter();

// Initialize & start BotEngine Connector
var botEngineConnector = require('./connectors/BotEngineConnector');
botEngineConnector.start(app, eventsEmitter);

// Initialize & start Websocket Connector
var wsConnector = new WebsocketConnector(server, eventsEmitter);
wsConnector.start();

// Initialize & start Facebook/Line/Wechat Connector
getBotClientConfigs().then(function (configs) {
    configs.forEach(function (config) {
        if(config.client === 'FB')
        {
            logger.info(moduleName,"Got client: " + config.config.botName);
            var botConfig = {};
            botConfig.FACEBOOK_ACCESS_TOKEN = config.config.accessToken;
            botConfig.FACEBOOK_VERIFY_TOKEN = config.config.verifyToken;
            botConfig.BOT_NAME = config.config.botName;
            botConfig.FACEBOOK_PAGE_ID = config.config.pageId;
            botConfig.FACEBOOK_APP_SECRET = config.config.appSecret;

            new FacebookConnector(app, eventsEmitter, botConfig).start();
        }
        if(config.client === 'LINE')
        {
            logger.info(moduleName,"Got client: " + config.config.botName);
            var botConfig = {};
            botConfig.LINE_CHANNEL_ID = config.config.channelID;
            botConfig.LINE_CHANNEL_SECRET = config.config.appSecret;
            botConfig.LINE_CHANNEL_ACCESS_CODE = config.config.accessToken;
            botConfig.BOT_NAME = config.config.botName;

            new LineConnector(app, eventsEmitter, server, botConfig).start();
        }
        if(config.client === 'WECHAT')
        {
            logger.info(moduleName,"Got client: " + config.config.botName);
            var botConfig = {};
            botConfig.WECHAT_VERIFY_TOKEN = config.config.verifyToken;
            botConfig.BOT_NAME = config.config.botName;
            botConfig.WECHAT_APPID = config.config.appId;
            botConfig.WECHAT_SECRET = config.config.appSecret;

            new HWeChatConnector(app, botConfig).start();
        }
    });

});

function getBotClientConfigs() {
    return new Promise(function (resolve, reject) {
        logger.info(moduleName, 'Fetching Bot Client configs...');

        var options = {
            url: Constants.MCS_URL + Constants.MCS_BOT_CONFIG,
            headers: {
                'oracle-mobile-backend-id': Constants.MCS_MBE_ID,
                'Authorization': Constants.MCS_MBE_AUTH
            },
            json: true
        };

        logger.info(moduleName, "options: " + JSON.stringify(options));
        
        request.get(options, function (error, response, body) {

            if (response.statusCode === 200) {
                resolve(body);
            }
            else if (response.statusCode === 500) {
                reject(error)
            }

        });
    });
};
