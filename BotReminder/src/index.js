/* Amplify Params - DO NOT EDIT
	ENV
	REGION
Amplify Params - DO NOT EDIT */

const axios = require("axios");
var AWS = require('aws-sdk');

AWS.config.update({ region: 'eu-west-2' });

var ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

let TABLE_NAME = 'BotStorage-master';

async function sendMessage(url, chat_id, reply) {
    await axios.post(url, {
        chat_id: chat_id,
        text: reply
    }).then(() => {
        console.log("Message posted");
    }).catch(error => {
        console.log(error);
    });
}
let telegram_url = "https://api.telegram.org/bot" + process.env.TOKEN + "/sendMessage";


async function getTomorrowData(bd_date) {
    console.log(bd_date);
    var params = {
        ExpressionAttributeValues: {
            ':d': { S: `${bd_date}` }
        },
        KeyConditionExpression: 'bd_date = :d',
        TableName: TABLE_NAME,
        IndexName: 'bd_date-index',
    };

    return await ddb.query(params, function (err, data) {
        console.log("data", data)
        if (err) {
            console.log("Error", err);
        } else {
            console.log("Nice", data);
        }
    }).promise();
}

const outputHelper = function (num) {
    if (num < 10) {
        return ("0" + num).slice(-2)
    } else {
        return num;
    }
}

let scheduleFunc =  async function () {
    let current_date = new Date();
    let tomorrow_date = outputHelper(current_date.getUTCDate() + 1) +"."+ outputHelper(current_date.getUTCMonth() + 1);
    let tomorrow_list = await getTomorrowData(tomorrow_date);
    for (let i = 0; i < tomorrow_list.Items.length; i++) {
    await  sendMessage(telegram_url, tomorrow_list.Items[i].user_id.N, `У ${tomorrow_list.Items[i].username.S} завтра, ${tomorrow_list.Items[i].bd_date.S}, День рождения. Не забудьте поздравить!`);
    }
};

exports.handler = async (event) => {
    // TODO implement
    await scheduleFunc();
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    return response;
};
