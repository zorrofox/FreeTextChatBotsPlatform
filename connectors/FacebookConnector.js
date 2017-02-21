/******************************************************************************
 Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved.
 $revision_history$
 13-Nov-2016   Tamer Qumhieh, Oracle A-Team
 1.0           initial creation

Jan, 2017      Hysun He:  Customize main menu
 ******************************************************************************/


var Constants = require('../utils/Constants');
var request = require('request');
var crypto = require('crypto');
var bodyParser = require('body-parser');
var Promise = require('bluebird');
// Botly is a Facebook Messenger Bot Framework, it makes it easy to read
var Botly = require('botly');
// Initialize Logger
var logger = require('../utils/Logger');

var mainMenu = require('../schemas/menu.json');

var FacebookConnector = function (app, eveEmitter, _config) {
    this.app = app;
    this.eventEmitter = eveEmitter;
    this.config = _config;
    this.moduleName = 'FacebookConnector - ' + this.config.BOT_NAME;
    this.botly = new Botly({
        accessToken: this.config.FACEBOOK_ACCESS_TOKEN,
        verifyToken: this.config.FACEBOOK_VERIFY_TOKEN,
        webHookPath: '/' + this.config.BOT_NAME,
        notificationType: Botly.CONST.REGULAR
    });

}

// Initialize the Facebook Connector and set all needed listeners.
// @param app: express HTTP app to bind to.
// @param evEmitter: postbackEvent_toBot emitter
FacebookConnector.prototype.start = function () {

    var self = this;
    logger.info(self.moduleName , 'started...');
    // Listen for Facebook events. These events are fired when BOT Engine sends back a reply through BotEngineConnector,
    // hence FacebookConnector needs to listen for these incoming message and direct them back to Facebook Server for delivery
    self.eventEmitter.on(Constants.EVENT_SEND_TO_FACEBOOK + self.config.BOT_NAME, function (message) {
        self.sendMessageToFacebook(message)
    });

    // Get main menu definition from JSON file
    var mainMenu = require('../schemas/menu.json');
    var menuButtons = [];
    mainMenu.button[0].sub_button.forEach(function(btn){
        var pbBtn = self.botly.createPostbackButton(btn.name, JSON.stringify({language: btn.key}));
        menuButtons.push(pbBtn);
    });
    
    // Add Facebook Persistent Menu
    self.botly.setPersistentMenu({
        pageId: self.config.FACEBOOK_PAGE_ID,
        buttons: menuButtons
    }, function (err, data) {
        if (err || data.error) {
            logger.error(self.moduleName, '!!! ERROR creating facebook persistent menu...', (err === null ? data : err));
        } else {
            logger.info(self.moduleName, 'successfully created facebook persistent menu...', data);
        }
    });


    // Listen for facebook incoming Free Text messages
    self.botly.on('message', function (userId, message, data) {
        logger.info(self.moduleName, 'received a free textMessage message from user [' + userId + ']...', data);
        self.sendMessageToBot(userId, data);

    });

    // Listen for facebook incoming Button postback messages
    // postback is the string representation of a JSON object 'button payload'
    self.botly.on("postback", function (userId, message, postback) {
        logger.info(self.moduleName, 'received a button postback message from user [' + userId + ']...', postback);
        var payload = JSON.parse(postback);
        self.sendMessageToBot(userId, payload);

    });


    // configure express with botly details
    // add JSON body parser to express app, and add a verification method that will intercept incoming requests and
    // use the 'x-hub-signature' header to verify that the request is actaully coming from Facebook and not spoofed.
    self.app.use("/fbwebhook/" + self.config.BOT_NAME, bodyParser.json({verify: self.verifyRequestSignature}));
    self.app.use("/fbwebhook", self.botly.router());


    /*
     Verify request authenticity by inspecting the 'x-hub-signature' header provided by Facebook and compare against
     the facebook app secret encrypted with SHA1
     */
    var verifyRequestSignature = function (req, res, buf) {
        var signature = req.headers["x-hub-signature"];

        if (!signature) {
            logger.error(self.moduleName, 'message source is not trusted');
        } else {
            var elements = signature.split('=');
            var method = elements[0];
            var signatureHash = elements[1];

            var expectedHash = crypto.createHmac('sha1', self.config.FACEBOOK_APP_SECRET)
                .update(buf)
                .digest('hex');

            if (signatureHash != expectedHash) {
                logger.error(self.moduleName, 'Couldnt validate the request signature....');
                throw new Error("Couldn't validate the request signature.");

            }
        }
    }
}

/*
 Send message to BOT by firing an postbackEvent_toBot
 @param msg: JSON object representing the message received from Client and to be sent to BOT
 */
FacebookConnector.prototype.sendMessageToBot = function (userId, msg) {
    var self = this;
    self.transformMessageToBotFormat(userId, msg).then(function (botMessage) {
        logger.info(self.moduleName, 'sending message to BotEngine Connector...', botMessage);
        var message = {
            userId: userId,
            replyBackTo: Constants.EVENT_SEND_TO_FACEBOOK + self.config.BOT_NAME,
            payload: botMessage,
            botName: self.config.BOT_NAME
        };
        self.eventEmitter.emit(Constants.EVENT_SEND_TO_BOT, message);
    });
}

/*
 Transforms message received from facebook to BOT Engine format
 @param userId: user ID
 @param body: JSON message received.
 @return formatted message
 */
FacebookConnector.prototype.transformMessageToBotFormat = function (userId, body) {
    var self = this;
    return new Promise(function (resolve, reject) {

        self.getUserProfile(userId).then(function (userProfile) {
            logger.info(self.moduleName, 'transforming message to BOT Engine format...', body);

            var msgToBot = {};
            var metadata = {};
			metadata.client = Constants.CLIENT_FB;
            metadata.user = userId;
            metadata.firstName = userProfile.first_name;
            metadata.lastName = userProfile.last_name;
			
			// user input
			if (body.text) {
				var input = body.text.toLowerCase();
				if(input === Constants.KEYWORD_MENU || input === Constants.BOT_EVENTID_START){
					msgToBot.event = Constants.KEYWORD_STARTOVER;
				}
			}
			// menu click event
			if(body.language){
				msgToBot.event = Constants.BOT_EVENTID_START;
				metadata.language = body.language;
			}
			
			if(body.event){
				msgToBot.event = body.event;
				msgToBot.value= body.value;  
			}
			
            if(!msgToBot.event){
				msgToBot.event = Constants.BOT_EVENTID_FREE_TEXT;
				msgToBot.value= body.text;  
			}

			if(!metadata.language){
				if (userProfile.locale && (userProfile.locale.toLowerCase().indexOf(Constants.DEFAULT_LANGUAGE) < 0)) {
					metadata.language = userProfile.locale.toLowerCase();
				}
				else {
					metadata.language = Constants.DEFAULT_LANGUAGE;
				}
			}

            msgToBot.metadata = metadata;
            resolve(msgToBot);
        });
    });

}

/*
 Transforms message received from BOT Engine to Facebook format
 @param userId: user ID
 @param body: JSON message to send to facebook.
 @return formatted JSON object accordinf to Facebook Specifications
 */
FacebookConnector.prototype.transformMessageToFacebookFormat = function (userId, message) {
    var self = this;
    logger.info(self.moduleName, 'transforming message to facebook format...', message);

    var messageType = message.type || 'error';
    var responsePayload = {id: userId};
    var messageToFacebook = {};
    var max_card_buttons_length;

	
	
    // Text Messages. Text message can contain buttons too
    if (messageType === 'prompt') {

		
        // Set Message Type to text in order for 'sendMessageToFacebook' to send a text message.
        messageToFacebook.msgType = Constants.MESSAGE_TYPE_FB_TEXT;

        // Set Free Text message
        responsePayload.text = message.prompt;

        // If 'options' i.e. buttons exists, then iterate over them and add them to the text message
        if (message.options) {
            // bacause buttons exists, then change the message type to buttons
            messageToFacebook.msgType = Constants.MESSAGE_TYPE_FB_POSTBACK_BUTTON;

            // Facbook only allows (three) buttons to be attached to a text message, hence only add the first three buttons
            responsePayload.buttons = self.createFacebookButtons(message.options, Constants.FACEBOOK_LIMIT_BUTTONS_TEXT, false);

        }


    }

    /* Cards (List). Cards can either be represented as 'Vertical Lists using Facebook List Template' or as
     'Horizontal List using Facebook Generic Template'.

     - Vertical List (List Template): a card item can contain
     (title, subtitle, image_url,default_action, buttons - restricted to only one button). Also there can be global buttons
     at the list level (limited to 1 button). Max of 4 cards can be sent.

     - Horizontal List (Generic Template): a card item can contain
     (title, subtitle, image_url,default_action, buttons - restricted to 3 buttons'). A Max of 10 cards can be sent.
     */
    else if (messageType === 'cards') {

        // set Message Type to either 'Vertical' or 'Horizontal' which will be then used to decide whether to use
        // Facebook List or Generic template.
        // Default Layout is Horizontal.

        if (!message.uihints.cardLayout || message.uihints.cardLayout === 'horizontal') {
            // set Message Type to Horizontal Cards, i.e Facebook Generic Template
            messageToFacebook.msgType = Constants.MESSAGE_TYPE_FB_CARDS_HORIZONTAL;

            // set the max number of buttons a card in a Horizontal list can have. Based on Facebook restrictions,
            // Generic Template 'Horizontal List' can have a max of 3 buttons.
            max_card_buttons_length = Constants.FACEBOOK_LIMIT_CARDS_HORIZON_LIST;
        }
        else if (message.uihints.cardLayout === 'vertical') {
            messageToFacebook.msgType = Constants.MESSAGE_TYPE_FB_CARDS_VERTICAL;

            // set the max number of buttons a card in a Vertical list can have. Based on Facebook restrictions,
            // List Template 'Vertical List' can have a max of 1 button.
            max_card_buttons_length = Constants.FACEBOOK_LIMIT_CARDS_VERTICAL_LIST;

            // According to Facebook List Template,the first card in the list can have its image as a background
            // for the entire card, the 'firstCardProminent' uihint indicates if this option is on or not.
            if (message.uihints.firstCardProminent) {
                responsePayload.top_element_style = 'large';
            }
            else {
                responsePayload.top_element_style = 'compact';
            }

            // if Buttons exists at the list level, then create corresponding buttons.
            // Note that according to Facebook List Template, it can only contain a single button.
            if (message.options) {
                // Facebook List Template can only support one button at the List level
                responsePayload.buttons = self.createFacebookButtons(message.options, Constants.FACEBOOK_LIMIT_BUTTONS_VERTICAL_LIST, false);

            }


        }

        // Cards array.
        var cards = [];
        message.cards.forEach(function (card) {

            // Card Element
            var element = {};
            // Copy Card details.
            for (var key in card) {
                // convert BotEngine keys to Facebook keys
                if (key !== 'options') {
                    element[self.mapFacebookItemKey(key)] = card[key];
                    if (element.default_action) {
                        element.default_action = {type: 'web_url', url: element.default_action}
                    }
                }
            }
            // if buttons exists add them to card
            if (card.options) {
                element.buttons = self.createFacebookButtons(card.options, max_card_buttons_length, false);
            }
            cards.push(element);
        });

        // Apply Facebook Limitation on the number of cards to return based on the template applied
        if (responsePayload.msgType == Constants.MESSAGE_TYPE_FB_CARDS_HORIZONTAL) {
            cards.slice(0, Constants.FACEBOOK_LIMIT_CARDS_HORIZON_LIST);
        }
        else if (responsePayload.msgType === Constants.MESSAGE_TYPE_FB_CARDS_VERTICAL) {
            cards.slice(0, Constants.FACEBOOK_LIMIT_CARDS_VERTICAL_LIST)
        }

        responsePayload.elements = cards;
    }

    // Facebook Attachment can support (image,audio,video,file)
    else if (messageType === 'attachment') {
        // Set Message type to attachment
        messageToFacebook.msgType = Constants.MESSAGE_TYPE_FB_ATTACHMENT;
        // set attachment content type
        responsePayload.type = message.attachmentType;
        // set attachment value
        responsePayload.payload = {url: message.url};
    }

    // set response payload
    messageToFacebook.payload = responsePayload;

    return messageToFacebook;

}


/*
 Convert BotEngine options to Facebook Buttons
 @param options: BontEngine 'options' array to be converted to facebook buttons
 @param maxLength: the length of the array to return back.
 @param isQuickReply: boolean flag to indicate if to create options as 'Quick Replies' buttons.
 */
FacebookConnector.prototype.createFacebookButtons = function (options, maxLength, isQuickReply) {
    var self = this;
    var buttons = [];


    // Create Facebook Buttons
    options.forEach(function (option) {
        if (!isQuickReply) {
            if (!option.type || option.type.toUpperCase() === 'postback'.toUpperCase()) {
                buttons.push(self.botly.createPostbackButton(option.prompt, JSON.stringify(option.payload)));
            }
            else if (option.type.toUpperCase() === 'url'.toUpperCase()) {
                buttons.push(self.botly.createWebURLButton(option.prompt, option.payload.url));
            }
            else if (option.type.toUpperCase() === 'call'.toUpperCase()) {
                buttons.push({type: 'phone_number', title: option.prompt, payload: option.payload.phoneNumber})
            }
            else if (option.type.toUpperCase() === 'share'.toUpperCase()) {
                buttons.push(self.botly.createShareButton());
            }
        }
        // create Facebook Quick Reply Buttons
        else {
            if (!option.type || option.type.toUpperCase() === 'postback'.toUpperCase()) {
                buttons.push(self.botly.createQuickReply(option.prompt, JSON.stringify(option.payload), option.imageUrl))
            }
            else if (option.type.toUpperCase() === 'location'.toUpperCase()) {
                buttons.push(self.botly.createShareLocation());
            }
        }
    });


    return buttons.slice(0, maxLength);
}

/*
 send message(s) from BOT Engine to Facebook server.
 @param message: message received from BOT Engine
 */
FacebookConnector.prototype.sendMessageToFacebook = function (message) {
    var self = this;
    var userId = message.userId;
    var index = 0;
    var retryCount = 0;
    var length = 0;
    if(message.payload && message.payload.items){
        length = message.payload.items.length;
    }

    sendAllMessages();

    // Recursively Loop over messages and send them to facebook. Only send the next message when the first message is successfully sent
    function sendAllMessages() {

        // Set 'Typing On' indicator between sending messages
        self.botly.sendAction({id: userId, action: Botly.CONST.ACTION_TYPES.TYPING_ON}, function (err, data) {
        });

        // Message to send to facebook, need to trasform it first to Facebook Format
        var msgToFacebook = self.transformMessageToFacebookFormat(userId, message.payload.items[index]);

        // If this is the last message to send and 'globalOptions' are available i.e. 'Facebook Quick Replies Buttons'
        // add them to this last facebook Response message.
        if ((index === length - 1) && message.payload.globalOptions) {
            msgToFacebook.payload.quick_replies = self.createFacebookButtons(message.payload.globalOptions, Constants.FACEBOOK_LIMIT_BUTTONS_QUICK_REPLIES, true);
        }
		
		
        // Send Text Message
        if (msgToFacebook.msgType === Constants.MESSAGE_TYPE_FB_TEXT) {
            self.botly.sendText(msgToFacebook.payload, function (error, data) {
                if (error) {
                    logger.error(self.moduleName, 'error sending textMessage message to user [' + msgToFacebook.payload.id + ']...', error);

                    if (retryCount < Constants.MESSAGE_SEND_MAX_RETRY_COUNT) {
                        // if error sending message, then retry to send message to facebook
                        retryCount = retryCount + 1;
                        sendAllMessages();
                    }
                }
                else {
                    logger.info(self.moduleName, 'sending facebook textMessage message to user [' + msgToFacebook.payload.id + ']...', msgToFacebook.payload);

                    // message sent successfully, hence increment index and do a recursive call to send the rest of messages.
                    index = index + 1;
                    // recursive call
                    if (index < length)
                        sendAllMessages();
                }
            });
        }
        // Send Buttons 'Facebook Buttons Template'
        else if (msgToFacebook.msgType === Constants.MESSAGE_TYPE_FB_POSTBACK_BUTTON) {

            self.botly.sendButtons(msgToFacebook.payload, function (error, data) {
                if (error) {
                    logger.error(self.moduleName, 'error sending buttons message to user [' + msgToFacebook.payload.id + ']...', error);
                    if (retryCount < Constants.MESSAGE_SEND_MAX_RETRY_COUNT) {
                        // if error sending message, then retry to send message to facebook
                        retryCount = retryCount + 1;
                        sendAllMessages();
                    }
                }
                else {
                    logger.info(self.moduleName, 'sending facebook buttons message to user [' + msgToFacebook.payload.id + ']...', msgToFacebook.payload);
                    // message sent successfully, hence increment index and do a recursive call to send the rest of messages.
                    index = index + 1;
                    // recursive call
                    if (index < length)
                        sendAllMessages();
                }
            });

        }
        // Send 'Horizontal List' i.e. Facebook Generic Template
        else if (msgToFacebook.msgType === Constants.MESSAGE_TYPE_FB_CARDS_HORIZONTAL) {
            self.botly.sendGeneric(msgToFacebook.payload, function (error, data) {
                if (error) {
                    logger.error(self.moduleName, 'error sending cards message to user [' + msgToFacebook.payload.id + ']...', error);
                    if (retryCount < Constants.MESSAGE_SEND_MAX_RETRY_COUNT) {
                        // if error sending message, then retry to send message to facebook
                        retryCount = retryCount + 1;
                        sendAllMessages();
                    }
                }
                else {
                    logger.info(self.moduleName, 'sending facebook cards message to user [' + msgToFacebook.payload.id + ']...', msgToFacebook.payload);
                    // message sent successfully, hence increment index and do a recursive call to send the rest of messages.
                    index = index + 1;
                    // recursive call
                    if (index < length)
                        sendAllMessages();
                }
            });

        }
        // Send 'Vertical List' i.e. Facebook List Template
        else if (msgToFacebook.msgType === Constants.MESSAGE_TYPE_FB_CARDS_VERTICAL) {

            self.botly.sendList(msgToFacebook.payload, function (error, data) {
                if (error) {
                    logger.error(self.moduleName, 'error sending List cards message to user [' + msgToFacebook.payload.id + ']...', error);
                    if (retryCount < Constants.MESSAGE_SEND_MAX_RETRY_COUNT) {
                        // if error sending message, then retry to send message to facebook
                        retryCount = retryCount + 1;
                        sendAllMessages();
                    }
                }
                else {
                    logger.info(self.moduleName, 'sending facebook List cards message to user [' + msgToFacebook.payload.id + ']...', msgToFacebook.payload);
                    // message sent successfully, hence increment index and do a recursive call to send the rest of messages.
                    index = index + 1;
                    // recursive call
                    if (index < length)
                        sendAllMessages();
                }
            });
        }
        // Send 'attachment (image, audio, video, file)
        else if (msgToFacebook.msgType === Constants.MESSAGE_TYPE_FB_ATTACHMENT) {
            self.botly.sendAttachment(msgToFacebook.payload, function (error, data) {
                if (error) {
                    logger.error(self.moduleName, 'error sending attachment message to user [' + msgToFacebook.payload.id + ']...', error);
                    if (retryCount < Constants.MESSAGE_SEND_MAX_RETRY_COUNT) {
                        // if error sending message, then retry to send message to facebook
                        retryCount = retryCount + 1;
                        sendAllMessages();
                    }
                }
                else {
                    logger.info(self.moduleName, 'sending facebook attachment message to user [' + msgToFacebook.payload.id + ']...', msgToFacebook.payload);
                    // message sent successfully, hence increment index and do a recursive call to send the rest of messages.
                    index = index + 1;
                    // recursive call
                    if (index < length)
                        sendAllMessages();
                }
            });
        }

    }
}

/*
 Fetch user profile from facebook
 */
FacebookConnector.prototype.getUserProfile = function (userId) {
    var self = this;
    return new Promise(function (resolve, reject) {
        logger.info(self.moduleName, 'fetching user [' + userId + '] profile from facebook...');
        self.botly.getUserProfile(userId, function (error, userProfile) {
            if (error) {
                reject(error);
            }
            else {
                resolve(userProfile);
            }
        });
    });

}

/*
    Translate BotEngine Response item keys to corresponding Facebook Item key
 */
FacebookConnector.prototype.mapFacebookItemKey = function (key) {
    var self = this;
    if (key.toUpperCase() === Constants.DICTIONARY_BOT_ITEM_TITLE.toUpperCase()) {
        return Constants.DICTIONARY_FACEBOOK_ITEM_TITLE;
    }
    else if (key.toUpperCase() === Constants.DICTIONARY_BOT_ITEM_SUBTITLE.toUpperCase()) {
        return Constants.DICTIONARY_FACEBOOK_ITEM_SUBTITLE;
    }
    else if (key.toUpperCase() === Constants.DICTIONARY_BOT_ITEM_IMAGEURL.toUpperCase()) {
        return Constants.DICTIONARY_FACEBOOK_ITEM_IMAGEURL;
    }
    else if (key.toUpperCase() === Constants.DICTIONARY_BOT_ITEM_CARDURL.toUpperCase()) {
        return Constants.DICTIONARY_FACEBOOK_ITEM_CARDURL;
    }
    else if (key.toUpperCase() === Constants.DICTIONARY_BOT_ITEM_OPTIONS.toUpperCase()) {
        return Constants.DICTIONARY_FACEBOOK_ITEM_OPTIONS;
    }
    else if (key.toUpperCase() === Constants.DICTIONARY_BOT_ITEM_PROMPT.toUpperCase()) {
        return Constants.DICTIONARY_FACEBOOK_ITEM_PROMPT;
    }
    else {
        return key.toLowerCase();
    }
}

module.exports = FacebookConnector;