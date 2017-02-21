/******************************************************************************
 Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved.
 $revision_history$
 21-Nov-2016   Tamer Qumhieh, Oracle A-Team
 1.0           initial creation
 ******************************************************************************/


var userId = '1238853906166440';
var lang = 'en';
var Constants = require('../utils/Constants');


var In_WelcomeMessage = {
    items: [
        {
            type: "prompt",
            prompt: "Welcome Tamer Qumhieh, this is a summary of your accounts and your balance"
        },
        {
            type: "prompt",
            prompt: "tell us, what do you need?",
            options: [
                {
                    prompt: "View Transactions",
                    payload: {
                        event: "goSelectAccountForTransactions"
                    }
                }
            ]
        }
    ],
    metadata: {},
    globalOptions: [
        {
            prompt: "Send Location",
            payload: {
                event: "locationSent"
            },
            type: "location"
        }
    ]
};


// Postbacks
var postbackEvent_toBot = 'goSelectAccountForTransactions';
exports.Input_PostbackButton = {event: postbackEvent_toBot};
exports.Output_PostbackButton = {
    event: postbackEvent_toBot,
    metadata: {user: userId, language: lang, firstName: 'Tamer', lastName: 'Qumhieh', client: 'FB'}
};

// Free Text
var text_toBot = 'Transfer Desc';
exports.Input_FreeTextMessage = {text: text_toBot};
exports.Output_FreeTextMessage = {
    'event': Constants.BOT_EVENTID_FREE_TEXT,
    value: text_toBot,
    metadata: {user: userId, language: lang, firstName: 'Tamer', lastName: 'Qumhieh', client: 'FB'}
};

// Attachments
exports.Input_AttachmentMessage = {
    attachments: {
        image: ["imageURL1"]
    }
};
exports.Output_AttachmentMessage = {
    'event': Constants.BOT_EVENTID_IMAGE,
    value: 'imageURL1',
    metadata: {user: userId, language: lang, firstName: 'Tamer', lastName: 'Qumhieh', client: 'FB'}
};


// Bot Engine Response
exports.Input_BotEngineResponse_Buttons = {
    type: "prompt",
    prompt: "tell us, what do you need?",
    options: [
        {
            prompt: "View Transactions",
            payload: {
                event: "goSelectAccountForTransactions"
            }
        }
    ]
};
exports.Output_BotEngineResponse_Buttons = {
    msgType: Constants.MESSAGE_TYPE_FB_POSTBACK_BUTTON,
    payload: {
        id: "1238853906166440",
        text: "tell us, what do you need?",
        buttons: [{
            type: "postback",
            title: "View Transactions",
            payload: '{"event":"goSelectAccountForTransactions"}'
        }]
    }
};



exports.userId = userId;