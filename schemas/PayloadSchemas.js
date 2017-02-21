/******************************************************************************
 Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved.
 $revision_history$
 13-Nov-2016   Tamer Qumhieh, Oracle A-Team
 1.0           initial creation
 ******************************************************************************/


exports.MESSAGE_ACK_PAYLOAD = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {
        "sender": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string"
                }
            },
            "required": [
                "id"
            ]
        },
        "recipient": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string"
                }
            },
            "required": [
                "id"
            ]
        },
        "delivery": {
            "type": "object",
            "properties": {
                "mid": {
                    "type": "integer"
                },
                "watermark": {
                    "type": "integer"
                }
            },
            "required": [
                "mid",
                "watermark"
            ]
        }
    },
    "required": [
        "sender",
        "recipient",
        "delivery"
    ]
};

/** Changed by Hysun He */
exports.BUTTON_TEXT_REQUSET_PAYLOAD = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {
        "sender": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string"
                }
            },
            "required": [
                "id"
            ]
        },
        "recipient": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string"
                }
            },
            "required": [
                "id"
            ]
        },
        "timestamp": {
            "type": "integer"
        },
        "message": {
            "type": "object",
            "properties": {
                "payload": {
                    "type": "object",
                    "properties": {
                        "text":{
                            "type": "string"
                        },
                        "event":{
                            "type": "string"
                        }
                    }
                }
            },
            "required": [
                "payload"
            ]
        },
        "metadata": {
            "type": "object",
            "properties": {
                "authorization": {
                    "type": "string"
                },
                "language": {
                    "type": "string"
                }
            },
            "required": [
                "language"
            ]
        }
    },
    "required": [
        "sender",
        "recipient",
        "timestamp",
        "message",
        "metadata"
    ]
};