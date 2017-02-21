/******************************************************************************
 Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved.
 $revision_history$
 13-Nov-2016   Tamer Qumhieh, Oracle A-Team
 1.0           initial creation
 ******************************************************************************/



/*
    ##############################################

    Need to change the following in order to reflect your environment

    1) MCS Setup
    exports.MCS_URL
    exports.MCS_MBE_ID
    exports.MCS_MBE_AUTH

    2) Message Platform default settings
    exports.DEFAULT_LANGUAGE


 #############################################
 */

// Message Platform default settings
exports.HTTP_PORT = process.env.PORT || 9090;
exports.LANGUAGE_EN = 'en';
exports.LANGUAGE_ES = 'es';
exports.DEFAULT_LANGUAGE  = this.LANGUAGE_EN;
exports.KEYWORD_MENU = 'menu';
exports.KEYWORD_STARTOVER = 'startOver';
exports.MESSAGE_SEND_MAX_RETRY_COUNT=3;
exports.MESSAGE_SEND_RETRY_INTERVAL = 3000;
exports.CLIENT_FB = 'FB';
exports.CLIENT_CUSTOM = 'CUSTOM';
exports.CLIENT_WECHAT = 'WECHAT';


// MCS Setup
exports.MCS_URL = process.env.MCS_URL || 'https://mcs-cncsmdomain.mobileenv.us2.oraclecloud.com:443/mobile/custom/';
exports.MCS_BOT_ENDPOINT = '/freetxtchatbot/chat?bot=';
exports.MCS_MESSAGES_STORE = '/freetxtmcsmessageplatform/message';
exports.MCS_BOT_CONFIG = '/freetxtmcsmessageplatform/botclientconfig';
exports.MCS_MBE_ID = process.env.MCS_MBE_ID || 'b306a285-0de8-4f59-b6d1-f3a1061c1e34';
exports.MCS_MBE_AUTH = process.env.MCS_MBE_AUTH || 'Basic Y2hhdHJvYi11c2VyOkIlQCReZzdJKjR2';

// Events name
exports.EVENT_SEND_TO_BOT = 'send_botEngine';
exports.EVENT_SEND_TO_WEBSOCKET = 'send_websocket';
exports.EVENT_SEND_TO_FACEBOOK = 'send_facebook';
exports.EVENT_SEND_TO_LINE = 'send_line';
exports.EVENT_SEND_TO_WECHAT = 'send_wechat';

// Facebook Specific Constraints
exports.FACEBOOK_LIMIT_BUTTONS_TEXT = 3;
exports.FACEBOOK_LIMIT_BUTTONS_CARD_VERTICAL_LIST = 1;
exports.FACEBOOK_LIMIT_BUTTONS_CARD_HORIZONTAL_LIST = 3;
exports.FACEBOOK_LIMIT_BUTTONS_VERTICAL_LIST = 1;
exports.FACEBOOK_LIMIT_BUTTONS_QUICK_REPLIES = 11;
exports.FACEBOOK_LIMIT_CARDS_VERTICAL_LIST = 4;
exports.FACEBOOK_LIMIT_CARDS_HORIZON_LIST = 10;

//Wechat Settings
//exports.WECHAT_VERIFY_TOKEN='damdemo';
//exports.WECHAT_BOT_NAME='kkairport';
//exports.WECHAT_APPID='wx6ac1142569b02768';
//exports.WECHAT_SECRET='2a604ee48146a561b14df413abe08802';
//exports.WECHAT_API_TOKEN='https://api.weixin.qq.com/cgi-bin/token';
//exports.WECHAT_API_USER_INFO='https://api.weixin.qq.com/cgi-bin/user/info';
//exports.WECHAT_ACCESS_TOKEN_FILE='./utils/access_token.txt';
//exports.WECHAT_PROXY_PAGE='https://chatbotProxyPage-tsinghualy.apaas.us2.oraclecloud.com/';

//exports.WECHAT_VERIFY_TOKEN='damdemo';
//exports.WECHAT_BOT_NAME='airport';
//exports.WECHAT_APPID='wx01b050459301cd7a';
//exports.WECHAT_SECRET='b72adc3ff2708f9ee8f4624d59127815';
exports.WECHAT_API_TOKEN='https://api.weixin.qq.com/cgi-bin/token';
exports.WECHAT_API_USER_INFO='https://api.weixin.qq.com/cgi-bin/user/info';
exports.WECHAT_CREATE_MENU='https://api.weixin.qq.com/cgi-bin/menu/create';
exports.WECHAT_PROXY_PAGE='https://chatbotProxyPage-gse00002994.apaas.us6.oraclecloud.com/';

// Message type
exports.MESSAGE_TYPE_WS_ACK = 0;
exports.MESSAGE_TYPE_WS_TEXT_BUTTON = 1;
exports.MESSAGE_TYPE_FB_TEXT=2;
exports.MESSAGE_TYPE_FB_CARDS_HORIZONTAL = 3;
exports.MESSAGE_TYPE_FB_POSTBACK_BUTTON=4;
exports.MESSAGE_TYPE_FB_CARDS_VERTICAL = 5;
exports.MESSAGE_TYPE_FB_ATTACHMENT = 6;


// LINE Messagen type
exports.MESSAGE_TYPE_LINE_TEXT=1;
exports.MESSAGE_TYPE_LINE_CARDS = 3;
exports.MESSAGE_TYPE_LINE_BUTTON=4;


// BOT Engine conversation states
exports.BOT_EVENTID_FREE_TEXT = 'textSent';
exports.BOT_EVENTID_IMAGE = 'imageSent';
exports.BOT_EVENTID_AUDIO = 'audioSent';
exports.BOT_EVENTID_VIDEO = 'videoSent';
exports.BOT_EVENTID_LOCATION = 'locationSent';
exports.BOT_EVENTID_START = 'start';


// BOT Engine Response Items Dictionary
exports.DICTIONARY_BOT_ITEM_TITLE = 'title';
exports.DICTIONARY_BOT_ITEM_SUBTITLE = 'subtitle';
exports.DICTIONARY_BOT_ITEM_IMAGEURL= 'imageUrl';
exports.DICTIONARY_BOT_ITEM_ITEMURL = 'itemUrl';
exports.DICTIONARY_BOT_ITEM_CARDURL = 'cardUrl';
exports.DICTIONARY_BOT_ITEM_OPTIONS = 'options';
exports.DICTIONARY_BOT_ITEM_PROMPT = 'prompt';
exports.DICTIONARY_BOT_ITEM_GLOBALOPTIONS = 'globalOptions';


// Facebook Template Response Dictionary
exports.DICTIONARY_FACEBOOK_ITEM_TITLE = 'title';
exports.DICTIONARY_FACEBOOK_ITEM_SUBTITLE = 'subtitle';
exports.DICTIONARY_FACEBOOK_ITEM_IMAGEURL = 'image_url';
exports.DICTIONARY_FACEBOOK_ITEM_ITEMURL = 'item_url';
exports.DICTIONARY_FACEBOOK_ITEM_CARDURL = 'default_action';
exports.DICTIONARY_FACEBOOK_ITEM_OPTIONS = 'buttons';
exports.DICTIONARY_FACEBOOK_ITEM_PROMPT = 'title';
exports.DICTIONARY_FACEBOOK_ITEM_GLOBALOPTIONS = 'quick_replies';


// Error Codes & Messages
exports.ERROR_CODE_INVALID_MESSAGE = 1234;
exports.ERROR_MSG_INVALID_MESSAGE = 'message received is not a valid message...';
exports.ERROR_CODE_USERID_REQUIRED = 5678;
exports.ERROR_MSG_USERID_REQUIRED = 'UserId is required, websocket connection will terminate after 1 second . UserId should be passed upon initiating websocket connection in the format of wss://SERVER:PORT/USER_ID...';