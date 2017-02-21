/******************************************************************************
 Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved.
 $revision_history$
 21-Nov-2016   Tamer Qumhieh, Oracle A-Team
 1.0           initial creation
 ******************************************************************************/



var FacebookConnector = require('../connectors/FacebookConnector');
var botConfig = {};
botConfig.FACEBOOK_ACCESS_TOKEN = 'EAADQboXcZBZCkBAOnYkqLiIAqdsJbPXoHk9ZBFLbaOlJfcy58W6hG9gU9OAM163Lb74GylmwqgLrsekafv8TZCpSvdUJw7mPZCXZAqMaxqZA3TxEYyUWRDZAdoFZAJ0BSON7Q2F6FQULgT7pG4cY5flmZAFCgRMSCHgg1ZC16fGWH7BJQZDZD';
botConfig.FACEBOOK_VERIFY_TOKEN = 'ateam';
botConfig.BOT_NAME = 'banking';
botConfig.FACEBOOK_PAGE_ID = '652968578203637';
botConfig.FACEBOOK_APP_SECRET = '65301c35633b57c8cc9e246f85d8c4b1';
var fb = new FacebookConnector(null,null,botConfig);
var InOutData = require('../tests/InOutData');


describe('Testing facebook Connector', function () {

    describe('Facebook Button postback', function () {
        var finalMessage;
        beforeEach(function (done) {
            fb.transformMessageToBotFormat(InOutData.userId, InOutData.Input_PostbackButton)
                .done(function (result) {
                    finalMessage = result;
                    done();
                });
        });
        it('transform message to BOT Format', function () {
            expect(finalMessage).toEqual(InOutData.Output_PostbackButton);
        });

    });

    describe('Facebook Free Text', function () {
        var finalMessage;
        beforeEach(function (done) {
            fb.transformMessageToBotFormat(InOutData.userId, InOutData.Input_FreeTextMessage)
                .done(function (result) {
                    finalMessage = result;
                    done();
                });
        });
        it('transform message to BOT Format', function () {
            expect(finalMessage).toEqual(InOutData.Output_FreeTextMessage);
        });

    });

    describe('Facebook Attachment', function () {
        var finalMessage;
        beforeEach(function (done) {
            fb.transformMessageToBotFormat(InOutData.userId, InOutData.Input_AttachmentMessage)
                .done(function (result) {
                    finalMessage = result;
                    done();
                });
        });
        it('transform message to BOT Format', function () {
            expect(finalMessage).toEqual(InOutData.Output_AttachmentMessage);
        });

    });

    describe('BOT Engine ', function () {
        it('transform BOT messages to Facebook Format', function () {
            var response = fb.transformMessageToFacebookFormat(InOutData.userId, InOutData.Input_BotEngineResponse_Buttons);
            expect(response).toEqual(InOutData.Output_BotEngineResponse_Buttons);
        });

    });


});