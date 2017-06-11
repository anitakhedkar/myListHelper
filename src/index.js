'use strict';

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({region: 'us-east-1'});
//for email
var ses = new AWS.SES({region: 'us-east-1'});
//end for email

exports.handler = function(event, context) {
    try {
        var request = event.request;

        if (request.type === "LaunchRequest") {
            let options = {};
            options.speechText = "Welcome to mylisthelper skill. I track your grocery and chores lists. What can I do for you?";
            options.repromptText = "Do you need any help with mylisthelper skill?";
            options.endSession = false;
            context.succeed(buildResponse(options));
        } else if (request.type === "IntentRequest") {
            let options = {};
            if (request.intent.name === "ReadGroceryListIntent") {
                var storeName = request.intent.slots.store.value;
                //code added now
                let scanningParameters = {
                    TableName: 'ItemStoreList',
                    //KeyConditionExpression: 'storeName = :storeName',
                    FilterExpression: 'storeName = :storeName',
                    ExpressionAttributeValues: {
                        ":storeName": storeName
                    }
                };

                var itemList = '';
                var itemListForEmail = '';

                docClient.scan(scanningParameters, function onScan(err, data) {
                    if (err) {
                        options.speechText = "there was an error " + err;
                        // options.endSession = false;

                    } else {
                        data.Items.forEach(myfunction);
                        options.speechText = 'This is your ' + storeName + ' list<break time="1s"/>' + itemList;

                        if (typeof data.LastEvaluatedKey != "undefined") {
                            scanningParameters.ExclusiveStartKey = data.LastEvaluatedKey;
                            docClient.scan(scanningParameters, onScan);

                        } else {
                            // context.succeed(buildResponse(options));
                            //email content here
                            var eParams = {
                                Destination: {
                                    ToAddresses: ["anita.khedkar@gmail.com"]
                                },
                                Message: {
                                    Body: {
                                        Text: {
                                            Data: itemListForEmail
                                        }
                                    },
                                    Subject: {
                                        Data: "your list for " + storeName
                                    }
                                },
                                Source: "mylisthelper@gmail.com"
                            };

                            console.log('===SENDING EMAIL===');
                            var email = ses.sendEmail(eParams, function(err, data) {
                                if (err)
                                    console.log(err);
                                else {
                                    console.log("===EMAIL SENT===");
                                    console.log(data);

                                    console.log("EMAIL CODE END");
                                    console.log('EMAIL: ', email);
                                    // context.succeed(event);
                                    options.endSession = false;
                                    context.succeed(buildResponse(options));

                                }
                            });

                            //end email content here
                            //context.succeed(buildResponse(options));

                        }

                    }

                    function myfunction(iName) {
                        console.log(iName)
                        itemList += iName.itemName + '<break time="1s"/>';
                        itemListForEmail += iName.itemName + ' ';
                    }

                });
                //till here

            } else if (request.intent.name === "LaundryIntent") {
                let chore = request.intent.slots.chore.value;
                options.speechText = "Dont bother. That is what husbands are for.";
                options.endSession = false;
                context.succeed(buildResponse(options));

            } else if (request.intent.name === "MakeGroceryListIntent") {
                let item = request.intent.slots.item.value;
                let store = request.intent.slots.store.value;

                var params = {
                    Item: {
                        date: Date.now(),
                        itemName: item,
                        storeName: store
                    },
                    TableName: 'ItemStoreList'
                };
                //write to DynamoDB
                docClient.put(params, function(err, data) {
                    if (err) {
                        throw err;
                    } else {
                        options.speechText = item + " has been added to the " + store + " list";
                        options.endSession = false;
                        context.succeed(buildResponse(options));
                    }
                });
            } else {
                throw "unknown request intent type";
            }
        } else if (request.type === "SessionEndedRequest") {} else {
            throw "unknown request type";
        }
    } catch (e) {
        context.fail("Exception " + e);
    }
};

function buildResponse(options) {
    var response = {
        version: "1.0",
        response: {
            outputSpeech: {
                type: "PlainText",
                text: options.speechText
            },
            shouldEndSession: options.endSession
        }
    };
    if (options.repromptText) {
        response.response.reprompt = {
            outputSpeech: {
                type: "PlainText",
                text: options.repromptText
            }
        }
    }
    return response;
}
