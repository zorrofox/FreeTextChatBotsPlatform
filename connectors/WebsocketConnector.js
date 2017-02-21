/******************************************************************************
 Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved.
 $revision_history$
 13-Nov-2016   Tamer Qumhieh, Oracle A-Team
 1.0           initial creation
 ******************************************************************************/

// Initialize Logger
var logger = require('../utils/Logger');
// Initialize Constans module
var Constants = require('../utils/Constants');
// Initialize Underscore module
var _ = require('underscore');
// Initialize Promises
var Promise = require('bluebird');
//Initialize RequestJS
var request = require('request');
// Initialize JSON Schema Validator
var JsonValidator = require('jsonschema').Validator;
var payloadsSchema = require('../schemas/PayloadSchemas');

// Configure JSON Schema Validator to validate incoming messages
var validator = new JsonValidator();

var WebsocketConnector = function (server, evEmitter) {
    this.eventEmitter = evEmitter;
    this.server = server;
    this.moduleName = 'WebsocketConnector';
    // Local cache to map a userId to a websocket connection
    this.users = [];

}

/*
 Initialize the WebSocketConnector and set all needed listeners.
 @param server: HTTP server to bind too.
 @param evEmitter: events Bus, used ot listen/publish events to other modules
 */
WebsocketConnector.prototype.start = function () {

    var self = this;
    logger.info(self.moduleName, 'started...');

    // Configure WebSocket Server
    var WebSocketServer = require('ws').Server;
    var wss = new WebSocketServer({server: self.server});

    // WebSocket Connection setup
    wss.on('connection', function (socket) {

            /*
             When a client initialize the websocket connection, they use the format of ws://SERVER:PORT/USER_ID,
             hence we need to extract USER_ID from URL and save it in our USER-Sockets dictionary/cache
             */
            var userId = self.getUserIdFromSocket(socket);

            // make sure client sent a userId along initiating the websocket connection
            if (_.isUndefined(userId) || _.isEmpty(userId)) {
                var errorMessage = self.prepareErrorMessage(Constants.ERROR_CODE_USERID_REQUIRED, Constants.ERROR_MSG_USERID_REQUIRED);
                logger.error(self.moduleName, errorMessage.body);
                socket.send(JSON.stringify(errorMessage.body));
                // Wait for 1 second till error message is sent and then close websocket connection
                setTimeout(function () {
                    socket.close();
                }, 1000);

            }

            // UserId is provided correctly, hence process the connection and cache user connection and check if there
            // are any pending messages that were not delivered before, then deliver them.
            else {
                self.storeUserSocketInCache(userId, socket);
                logger.info(self.moduleName, 'user [' + userId + '] Connected...');

                // check if user has any pending undelivered messages, if yes, then send them to user.
                self.checkForUndeliveredMessages(userId).then(function (messages) {
                    if (messages.length > 0) {
                        logger.info(self.moduleName, 'user [' + userId + '] has undelivered messages, sending these messages again...')
                    }
                    messages.forEach(function (message) {
                        var msg = JSON.parse(message.message);
                        msg.payload.mid = message.id;
                        self.sendMessageToUser(msg);
                    });
                });

                // Listen for incoming messages from websocket connection.
                socket.on('message', function (message) {
                    self.onMessage(message, self.getUserIdFromSocket(socket));
                });

                // Listen for connection drops.
                socket.on('close', function (code, message) {
                    self.onDisconnect(socket);
                });

                // Lister for connection errors
                socket.on('error', function (error) {
                    self.onError(error, socket);
                });
            }
        }
    );


    // Listen for incoming events
    self.eventEmitter.on(Constants.EVENT_SEND_TO_WEBSOCKET, function (message) {
        logger.info(self.moduleName, 'message received, to be delivered to client websocket...', message);
        self.transformMessageToClientFormat(message).then(function (message) {
            self.sendMessageToUser(message);
        });
    });

};

/*
 Check the Message store if there are any pending messages for this client to be delivered.
 */
WebsocketConnector.prototype.checkForUndeliveredMessages = function (userId) {
    return new Promise(function (resolve, reject) {
        var options = {
                url: Constants.MCS_URL + Constants.MCS_MESSAGES_STORE,
                headers: {
                    'oracle-mobile-backend-id': Constants.MCS_MBE_ID,
                    'Authorization': Constants.MCS_MBE_AUTH
                },
                json: true,
                qs: {userId: userId}
            }
            ;

        request.get(options, function (error, response, body) {

            if (response.statusCode == 200) {
                resolve(body);
            }
            else if (response.statusCode == 500) {
                reject(error);
            }
        });
    });
};

/*
 Store message in Messages store
 */
WebsocketConnector.prototype.saveMessageInStore = function (userId, message) {
    return new Promise(function (resolve, reject) {
        var body = {userId: userId, message: JSON.stringify(message)};
        var options = {
                url: Constants.MCS_URL + Constants.MCS_MESSAGES_STORE,
                headers: {
                    'oracle-mobile-backend-id': Constants.MCS_MBE_ID,
                    'Authorization': Constants.MCS_MBE_AUTH
                },
                json: true,
                body: body
            }
            ;

        request.post(options, function (error, response, body) {

            if (response.statusCode == 200) {
                message.payload.mid = body.id;

                resolve(message);
            }
            else if (response.statusCode == 500) {
                reject(error);
            }
        });
    });
};

/*
 Delete Message From messages store
 */
WebsocketConnector.prototype.deleteMessageFromStore = function (messageId) {
    return new Promise(function (resolve, reject) {
        var options = {
                url: Constants.MCS_URL + Constants.MCS_MESSAGES_STORE,
                headers: {
                    'oracle-mobile-backend-id': Constants.MCS_MBE_ID,
                    'Authorization': Constants.MCS_MBE_AUTH
                },
                json: true,
                qs: {messageId: messageId}
            }
            ;

        request.delete(options, function (error, response, body) {

            if (response.statusCode == 200) {
                resolve(body);
            }
            else if (response.statusCode == 500) {
                reject(error);
            }
        });
    });
}

/*
 process message received from websocket connection
 @param msg    : message recieved from websocket connection
 @param socket : end client websocket connection.
 @
 */
WebsocketConnector.prototype.onMessage = function (msg, userId) {
    var self = this;
    logger.info(self.moduleName, 'message received, validating it...', msg);
    var message = self.isValidMessage(msg);

    // Client sent a valid message
    if (message.isValid) {

        // if Message is valid, and it is a FREE_TEXT or BUTTON_REQUEST message, then send message to BOT
        if (message.type === Constants.MESSAGE_TYPE_WS_TEXT_BUTTON) {
            self.sendMessageToBot(userId, self.transformMessageToBotFormat(userId, message.body));
        }
        // if message is valid and it is a MSG_ACK
        else if (message.type === Constants.MESSAGE_TYPE_WS_ACK) {
            self.messageDelivered(userId, message.body);
        }
    }
    // Client sent an invalid Message
    else {
        // 'message' object contains an error message, send it back to client
        self.getUserSocket(userId).send(JSON.stringify(message.body));
    }

};


/*
 When user disconnect, terminate his/her websocekt connection and remove the user entry from cache.
 */
WebsocketConnector.prototype.onDisconnect = function (socket) {
    var self = this;
    var userId = self.getUserIdFromSocket(socket);
    var socket = self.getUserSocket(userId);
    self.removeUserSocketFomCache(userId);
    logger.info(self.moduleName, 'user [' + userId + '] disconnected...');
};


WebsocketConnector.prototype.onError = function (error, socket) {
    var self = this;
    logger.error(self.moduleName, error);
    socket.terminate();
};

/*
 This method is used to store a client websocekt connection an map it the the client UserId.
 It search if userId already exists; if exists update websocket connection,otherwise add a new user entry in the cache.
 @param userId : client userId
 @param socket : client websocket connection.
 */
WebsocketConnector.prototype.storeUserSocketInCache = function (userId, socket) {
    var self = this;
    var user = _.find(self.users, function (user) {
        if (user.userId === userId) {
            return user;
        }
    });

    // New user, hence create a new User object and cache websocekt connection
    if (_.isUndefined(user)) {
        logger.info(self.moduleName, 'user [' + userId + '] doesnt exists, create a new user and store his/her websocket connection...');
        var newUser = {};
        newUser.userId = userId;
        newUser.socket = socket;
        self.users.push(newUser);
    }
    // User already exists, hence terminate old socket and cache new socket.
    else {
        logger.info(self.moduleName, 'user [' + userId + '] already exist...');
        // terminate old socket
        user.socket.terminate();
        logger.info(moduleName, 'terminating old websocket connection for user [' + userId + ']...');
        // update user new socket connection
        user.socket = socket;
        logger.info(self.moduleName, 'updating new websocket connection for user [' + userId + ']...');
    }
};

/*
 Upon client disconnects, remove the client websocket connection from cache.
 @param userId
 */
WebsocketConnector.prototype.removeUserSocketFomCache = function (userId) {
    var self = this;
    var user = _.find(self.users, function (user) {
        if (user.userId === userId) {
            return user;
        }
    });

    self.users.pop(user);
    logger.info(self.moduleName, 'removing user [' + userId + '] websocket connection from cache...');
}

/*
 Return user websocket Connection
 @param: userId
 */
WebsocketConnector.prototype.getUserSocket = function (userId) {
    var self = this;
    var user = _.find(self.users, function (user) {
        if (user.userId === userId) {
            return user;
        }
    });
    if(user) {
        return user.socket;
    } else {
        return null;
    }
};

/*
 Validate if message received from websocket connection is valid or not. A message is considered valid if it conforms
 with any of the JSON payload schemas defined in PayloadSchemas.js
 @param stringMsg: message received from websocket connection.
 @return validMessage object
 */
WebsocketConnector.prototype.isValidMessage = function (stringMsg) {
    var self = this;
    var validMessage = {};
    try {
        // Convert String msg to JSON object
        var jsonMsg = JSON.parse(stringMsg);


        // Check if message received conforms with any of the allowed schemas defined

        // check if message received is a Free Text/Button Response message
        if (validator.validate(jsonMsg, payloadsSchema.BUTTON_TEXT_REQUSET_PAYLOAD).valid) {
            validMessage.isValid = true;
            validMessage.body = jsonMsg;
            validMessage.type = Constants.MESSAGE_TYPE_WS_TEXT_BUTTON;
        }
        // Check if message received is a MSG_ACK type
        else if (validator.validate(jsonMsg, payloadsSchema.MESSAGE_ACK_PAYLOAD).valid) {
            validMessage.isValid = true;
            validMessage.body = jsonMsg;
            validMessage.type = Constants.MESSAGE_TYPE_WS_ACK;
        }
        // invalid message, hence throw an error.
        else {
            throw 'error';
        }

    }
    catch (error) {
        validMessage = self.prepareErrorMessage(Constants.ERROR_CODE_INVALID_MESSAGE, Constants.ERROR_MSG_INVALID_MESSAGE);
        logger.error(self.moduleName, validMessage.body, stringMsg);
    }

    return validMessage
};


/*
 Prepare error message object.
 @param: errorCode
 @param: errorMessage
 @return error object
 */
WebsocketConnector.prototype.prepareErrorMessage = function (errorCode, errorMessage) {
    var error = {};
    error.isValid = false;
    error.body = {'errorCode': errorCode, 'errorMessage': errorMessage};
    return error;
};

/*
 get userId from socket.
 */
WebsocketConnector.prototype.getUserIdFromSocket = function (socket) {
    return socket.upgradeReq.url.substr(1);
};

/*
 Send message to client through websocekt. Before sending the message, we need to store the message in MCS DB and then
 send to client; once the client ACK back with the message ID, delete from MCS DB.
 @param message: message to be sent, however it is still needs foramting.
 */
WebsocketConnector.prototype.sendMessageToUser = function (message) {
    var self = this;
    logger.info(self.moduleName, 'sending message to user [' + message.userId + ']...', message);
    var socket = self.getUserSocket(message.userId);
    
    if(socket) {
        if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify(message.payload));
            // Optimistic: Temparorily remove the message after call send.
            self.messageDeliveredById(message.payload.mid);
        }
    } else {
        logger.error(self.moduleName, '!User socket not found!');
        self.messageDeliveredById(message.payload.mid);
    }
};

/*
 Send message to BOT by firing an postbackEvent_toBot
 @param msg: JSON object representing the message received from Client and to be sent to BOT
 */
WebsocketConnector.prototype.sendMessageToBot = function (userId, msg) {
    var self = this;
    logger.info(self.moduleName, 'sending message to BotEngine Connector...', msg.payload);
    var message = {userId: userId, replyBackTo: Constants.EVENT_SEND_TO_WEBSOCKET, payload: msg.payload, botName: msg.botName};
    self.eventEmitter.emit(Constants.EVENT_SEND_TO_BOT, message);
};

/*
 Transforms message received from client to BOT Engine format
 @param msg: JSON message received. From previous validations, we know the message is either a FREE_TEXT or
 BUTTON_REQUEST message, hence fetch the postbackEvent_toBot value and pass to BOT Engine.
 @param userId: user ID
 @return formatted message
 */
WebsocketConnector.prototype.transformMessageToBotFormat = function (userId, msg) {
    var self = this;
    logger.info(self.moduleName, 'transforming message to BOT Engine format...', msg);

    logger.info(self.moduleName, "Parsing payload", msg.message.payload);
//    var clientMessagePayload = JSON.parse(msg.message.payload);
    var clientMessagePayload = msg.message.payload;

    if (!_.isUndefined(clientMessagePayload.text) || !_.isEmpty(clientMessagePayload.text)) {
        clientMessagePayload.value = clientMessagePayload.text;
        delete clientMessagePayload.text;
    }
    // fetch metadata from message
    var metadata = msg.metadata;
    metadata.client = Constants.CLIENT_CUSTOM;

    // formatted message to send to BOT Engine.
    var requestPayload = clientMessagePayload;

    // update metadata object with required fields for BOT
    metadata.user = userId;
    // if customer didn't specify a language, then default to system default language
    if (_.isUndefined(metadata.language) || _.isEmpty(metadata.language)) {
        metadata.language = Constants.DEFAULT_LANGUAGE;
    }
    requestPayload.metadata = metadata;

    var msgToBot = {payload: requestPayload , botName : msg.recipient.id};


    logger.info(self.moduleName, 'message transformation completed...', msgToBot);

    return msgToBot;

};

WebsocketConnector.prototype.transformMessageToClientFormat = function (message) {
    var self = this;
    return new Promise(function (resolve, reject) {
        self.saveMessageInStore(message.userId, message).then(function (message) {
            resolve(message);
        });
    });

}

/*
 Update messages store and mark the message as delivered.
 @param userId: user ID
 @param msg: JSON object representing the message delivery report
 */
WebsocketConnector.prototype.messageDelivered = function (userId, msg) {
    var self = this;
    self.deleteMessageFromStore(msg.delivery.mid).then(function (data) {
        logger.info(self.moduleName, 'ACK for messageId [' + msg.delivery.mid + '] processed successfully...');
    });

}

/*
 Update messages store and mark the message as delivered.
 @param userId: user ID
 @param msg: JSON object representing the message delivery report
 */
WebsocketConnector.prototype.messageDeliveredById = function (msgId) {
    var self = this;
    self.deleteMessageFromStore(msgId).then(function (data) {
        logger.info(self.moduleName, 'Del [' + msgId + ']');
    });
};

module.exports = WebsocketConnector;

