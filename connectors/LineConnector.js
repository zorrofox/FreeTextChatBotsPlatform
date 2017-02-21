/******************************************************************************
 Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved.
 $revision_history$
 24-Nov-2016   Chris Choi, APAC Cloud Pursuit
 1.0           initial creation
 ******************************************************************************/

var Constants = require('../utils/Constants');
var _ = require('underscore');
var Promise = require('bluebird');
// LINEBot is a Line Messenger Bot Framework, it makes it easy to read
var LINEBot = require('line-messaging');
// Initialize Logger
var logger = require('../utils/Logger');
var eventEmitter;
var bot;



var LineConnector = function (app, eveEmitter, server, _config) {
    this.app = app;
    this.eventEmitter = eveEmitter;
    this.config = _config;
    this.moduleName = 'LineConnector - ' + this.config.BOT_NAME;
    this.bot = LINEBot.create({
    channelID: this.config.LINE_CHANNEL_ID,
    channelSecret: this.config.LINE_CHANNEL_SECRET,
    channelToken: this.config.LINE_CHANNEL_ACCESS_CODE
    }, server);


}

// Initialize the Line Connector and set all needed listeners.
LineConnector.prototype.start = function () {
	
	var self = this;
	
    // configure express with botly details
	//example: /linewebhook/kkairport
    self.app.use(self.bot.webhook("/linewebhook/" + this.config.BOT_NAME));


    // Listen for Line events. These events are fired when BOT Engine sends back a reply through BotEngineConnector,
    // hence LineConnector needs to listen for these incoming message and direct them back to Line Server for delivery.
    self.eventEmitter.on(Constants.EVENT_SEND_TO_LINE + self.config.BOT_NAME, function (message) {
        logger.info(self.moduleName, 'BotEngine EventEmitting - bot');
        self.sendMessageToLine(message,1);
    });
  

    logger.info(self.moduleName, 'successfully init Line connector');

    // Listen for Line incoming Free Text messages
    self.bot.on(LINEBot.Events.MESSAGE, function(replyToken, message) {
            if (message.isMessageType('text')) {
                logger.info(self.moduleName, 'bot - received a free textMessage message from user [' + message.getUserId() + ']...', message.getText());
                var payload = {text: message.getText()};
                self.sendMessageToBot(message.getUserId(), payload,1);
            } else {
                logger.info(self.moduleName, 'received a non-textMessage message from user [' + message.getUserId() + ']...', message.getType());
                //To be implemented
            };
    });
   


    // Listen for Line incoming Button postback messages
    self.bot.on(LINEBot.Events.POSTBACK, function(replyToken, message) {
        logger.info(self.moduleName, 'Postback  received a button postback message from user [' + message.getUserId() + ']...', message.getPostbackData());
        var payload = JSON.parse(message.getPostbackData());
        logger.info(self.moduleName, 'Postback  Convert in JSON...', payload.toString());
        self.sendMessageToBot(message.getUserId(), payload,1);
    });
   
};

/*
 Send message to BOT by firing an postbackEvent_toBot
 @param msg: JSON object representing the message received from Client and to be sent to BOT
 */
LineConnector.prototype.sendMessageToBot = function (userId, msg, pageId) {

   var self = this;
	 
   self.transformMessageToBotFormat(userId, msg).then(function (botMessage) {
        logger.info(self.moduleName, 'sending message to BotEngine Connector... here comes the payload: ', botMessage);

        // var message = {userId: userId, replyBackTo: Constants.EVENT_SEND_TO_LINE + self.config.BOT_NAME, payload: botMessage,  botName: self.config.BOT_NAME};
        if (pageId==1) {
            var message = {userId: userId, replyBackTo: Constants.EVENT_SEND_TO_LINE + self.config.BOT_NAME, payload: botMessage,  botName: self.config.BOT_NAME};
            logger.info(self.moduleName, 'sendind message to BotEngine Connector... - complete message: ', message);
            self.eventEmitter.emit(Constants.EVENT_SEND_TO_BOT, message);
        } 
    });
};

/*
 Transforms message received from line to BOT Engine format
 @param userId: user ID
 @param body: message received.
 @return formatted message
 */
LineConnector.prototype.transformMessageToBotFormat = function(userId, body) {
	var self = this;
    return new Promise(function (resolve, reject) {
        //getUserProfile(userId).then(function (userProfile) {
            logger.info(self.moduleName, 'transforming message to BOT Engine format...', body);
            // If client sent free textMessage message, then check if this is a special keyword, if it is act upon it like
            // show main menu, otherwise, send it as it but add a special postbackEvent_toBot 'next'
            if (!_.isUndefined(body.text) || !_.isEmpty(body.text)) {
                // If user typed keyword menu, then show main menu
                if (body.text.toUpperCase() === Constants.KEYWORD_MENU.toUpperCase()) {
                    body.text = "";
                    body.event = 'start';
                    logger.info(self.moduleName, 'transforming message to BOT Engine format... 11111', body.toString());
                }
                // this is not a keyword, hence send it as is
                else {
                    body.event = Constants.BOT_EVENTID_FREE_TEXT;
                    logger.info(self.moduleName, 'transforming message to BOT Engine format... 22222', body.toString());
                }
                // Bot engine expect free textMessage to be sent as the value of a 'value' key rather than 'textMessage'
                body.value = body.text;
                delete body.text;
            }

            // @msgToLine: formatted message to send to BOT Engine.
            // copy the entire body received from Line, this could be a buttons postback or free textMessage message
            var msgToBot = body;
            // add metadata object with required fields for BOT
            var metadata = {};
            metadata.user = userId;
            metadata.language = Constants.DEFAULT_LANGUAGE;;
            msgToBot.metadata = metadata;
            resolve(msgToBot);
            logger.info(self.moduleName, 'transforming message to BOT Engine format...END ' + resolve(msgToBot));
        //});



    });

};


/*
 send message(s) from BOT Engine to Line server.
 @param message: message received from BOT Engine
 */
LineConnector.prototype.sendMessageToLine = function(message, pageId) {

	var self = this;
    // Transform message from BOT Engine format to Line format
    if(!_.isUndefined( message.payload.items)){
		    
		message.payload.items.forEach(function (item) {

		    message.payload = item;
		    
		    logger.info(self.moduleName, 'transforming message to Line format, for page id ' + pageId, message.payload);
		    if (!_.isUndefined(message.payload.prompt) && !_.isEmpty(message.payload.prompt)) {
	            logger.info(self.moduleName, 'create prompt message to Line format...[' + message.userId + '] ', message.payload.prompt);
		        if (pageId==1) {
		            var data = self.bot.pushTextMessage(message.userId, message.payload.prompt);
		        } 
		    };
		
		    if (!_.isUndefined(message.payload.cards) && !_.isEmpty(message.payload.cards)) {
		        var msgContent = '';
		        message.payload.cards.forEach(function (textCard) {
		            logger.info(self.moduleName, 'sending card message to Line format...[' + message.userId + '] ', JSON.stringify(textCard));
		            msgContent = msgContent + '\n\n' + textCard.title + ':\n' + textCard.subTitle;
		        });
		        if (pageId==1) {
		            var data = self.bot.pushTextMessage(message.userId, msgContent);
		        } 
		    };
		
		    if (!_.isUndefined(message.payload.options) && !_.isEmpty(message.payload.options)) {
		        var actions = [];
		        message.payload.options.forEach(function (optionItem) {
		            logger.info(self.moduleName, 'sending button to Line format...', optionItem.prompt);
		            logger.info(self.moduleName, 'sending button to Line format...', JSON.stringify(optionItem.payload));
		            if (optionItem.prompt.length > 19) {
		                logger.info(self.moduleName, 'Kenneth - handling option item: ', optionItem.prompt);
		                logger.info(self.moduleName, 'Kenneth - I do NOT LIKE string too long ', optionItem.prompt);
		                actions.push(new LINEBot.PostbackTemplateAction(optionItem.prompt.substr(0,18) + '..', JSON.stringify(optionItem.payload)));
		            } else {
		                logger.info(self.moduleName, 'Kenneth - handling option item: ', optionItem.prompt);
		                logger.info(self.moduleName, 'Kenneth - this is the final payload: ', optionItem.payload);
		
		                actions.push(new LINEBot.PostbackTemplateAction(optionItem.prompt, JSON.stringify(optionItem.payload)));
		
		            }
		        });
		
		        if (pageId==1) {
		            var buttonTemplate = new LINEBot.ButtonTemplateBuilder('---Option Menu---', 'Please select option:', Constants.LINE_JPG_SERVER + Constants.LINE_CHANNEL_JPG, actions);
		            var messageBuilder = new LINEBot.TemplateMessageBuilder('this is a buttons template', buttonTemplate);
		            var data = self.bot.pushMessage(message.userId, messageBuilder);
		        }  
			}
		}); 
    };
};

/*
 Fetch user profile from Line

function getUserProfile(userId) {
    logger.info(self.moduleName, 'fetching user [' + userId + '] profile from Line...');
    var profile = bot.getProfile(userId);
    logger.info(self.moduleName, 'profile info: ' + profile.toString());
    return profile;
};
*/

function sleep(milliseconds) {
    var start = new Date().getTime();
    while (true) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
};


module.exports = LineConnector;
