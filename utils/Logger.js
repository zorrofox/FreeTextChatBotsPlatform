/******************************************************************************
 Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved.
 $revision_history$
 13-Nov-2016   Tamer Qumhieh, Oracle A-Team
 1.0           initial creation
 ******************************************************************************/


var moment = require('moment');
var winstonLogger = require('winston');

exports.info = function (moduleName, message, data) {

    winstonLogger.info(moment().format('D-MMM-YYYY HH:mm:ss - ') + '[' + moduleName + '] :', message, (typeof data === 'undefined' ? '' : '( ' + JSON.stringify(data) + ' )'));
};

exports.error = function (moduleName, message, data) {
    winstonLogger.error(moment().format('D-MMM-YYYY HH:mm:ss - ') + '[' + moduleName + ']' , '[errorCode: ' + message.errorCode + '] [' + message.errorMessage + ']', (typeof data === 'undefined' ? '' : '( ' +  JSON.stringify(data) + ' )'));
};