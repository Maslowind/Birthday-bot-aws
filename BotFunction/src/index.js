/* Amplify Params - DO NOT EDIT
	ENV
	REGION
Amplify Params - DO NOT EDIT */

const axios = require("axios");
var AWS = require('aws-sdk');

AWS.config.update({ region: 'eu-west-2' });

var ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

let TABLE_NAME = 'BotStorage-master';

var ID = function () {
    return Math.random().toString(9).substr(2, 15);
};

function checkAddBDMessage(message) {
    let message_data = message.text.replace(/\s+/g, ' ').split(" ");
    if (message_data.length < 3) return null;
    let username = "";
    for (let i = 0; i < message_data.length - 2; i++) {
        username += message_data[1 + i];
        if (i != message_data.length - 3)
            username += " ";
    }
    let dateParams = message_data[message_data.length - 1].split(".");
    if (dateParams.length !== 2) return null;
    if (!(dateParams[0] >= 1 && dateParams[0] <= 31 && dateParams[1] >= 1 && dateParams[1] <= 12)) return null;
    let date = dateParams[0] + "." + dateParams[1];
    createNewData(message.chat.id, username, date);
    return date;
}

async function checkDelBDMessage(message) {
    let username = "";
    let message_data = message.text.replace(/\s+/g, ' ').split(" ");
    if (message_data.length < 2) return false;
    for (let i = 0; i < message_data.length - 1; i++) {
        username += message_data[1 + i];
        if (i != message_data.length - 2)
            username += " ";
    }
    await delUserData(message.chat.id, username);
    return true;
}

function createNewData(user_id, username, date) {

    let params = {
        TableName: TABLE_NAME,
        Item: {
            'id': { N: `${ID()}` },
            'user_id': { N: `${user_id}` },
            'date': { S: `${date}` },
            'username': { S: `${username}` }
        }
    };
    ddb.putItem(params, function (err, data) {
        if (err) {
            console.log("Error", err);
        } else {
            console.log("Success", data);
        }
    });
}

async function getUserData(user_id) {
    var params = {
        ExpressionAttributeValues: {
            ':ui': { N: `${user_id}` }
        },
        KeyConditionExpression: 'user_id = :ui',
        TableName: TABLE_NAME,
        IndexName: 'user_id-username-index',
    };

    return await ddb.query(params, function (err, data) {
        if (err) {
            console.log("Error", err);
        } else {
            console.log("Nice", data);
        }
    }).promise();
}

async function delUserData(user_id, username) {
    var params = {
        ExpressionAttributeValues: {
            ':ui': { N: `${user_id}` },
            ':un': { S: `${username}` }
        },
        KeyConditionExpression: 'user_id = :ui AND username = :un',
        TableName: TABLE_NAME,
        IndexName: 'user_id-username-index',
    };


    await ddb.query(params, function (err, data) {
        if (err) {
            console.log("Error", err);
        } else {
            data.Items.forEach(async (element) => {
                var delParams = {
                    TableName: TABLE_NAME,
                    Key: {
                        'id': { N: `${element.id.N}` }
                    }
                };
                console.log("there", delParams)
                await ddb.deleteItem(delParams, function (delErr, delData) {
                    if (delErr) {
                        console.log("Error", delErr);
                    } else {
                        console.log("Success", delData);
                    }
                }).promise();
            })
        }
    }).promise();
}

async function getUserList(message) {
    let user_bd_list = await getUserData(message.chat.id);
    let message_bd_list = "Ваш список друзей:\n"
    for (let i = 0; i < user_bd_list.Items.length; i++) {
        message_bd_list += `${user_bd_list.Items[i].username.S}: ${user_bd_list.Items[i].date.S} \n`
    }
    if (user_bd_list.Items.length === 0) message_bd_list = "У Вас нет друзей в списке. Добавьте их!"
    return message_bd_list;
}



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

exports.handler = async (event) => {
    const message = event.message;
    console.log(message);
    if (message.text.toLowerCase().indexOf("/start") != -1) {
        let infoMessage = `Привет! Я бот, который напоминает о ДР твоих друзей. Вот список моих команд:\nДобавить друга в список напоминания: "/setbirthday @username DD.MM"
Посмотреть список друзей и их ДР: "/getbdlist"\nУдалить друга из списка:"/delete @username"`
        await sendMessage(telegram_url, message.chat.id, infoMessage);

    } else if (message.text.toLowerCase().indexOf("/setbirthday") != -1) {
        let result = checkAddBDMessage(message);
        if (result !== null)
            await sendMessage(telegram_url, message.chat.id, "Вы успешно добавили друга в список");
        else
            await sendMessage(telegram_url, message.chat.id, `Дата должна быть в формате "/setbirthday @username DD.MM"`);
    } else if (message.text.toLowerCase().indexOf("/getbdlist") != -1) {
        let message_bd_list = await getUserList(message);
        await sendMessage(telegram_url, message.chat.id, message_bd_list);

    } else if (message.text.toLowerCase().indexOf("/delete") != -1) {
        if (await checkDelBDMessage(message)) {
            await sendMessage(telegram_url, message.chat.id, "Удаление было совершено.\n" );
        }
        else await sendMessage(telegram_url, message.chat.id, `Удаление должно быть в формате "/delete @username"`);
    } else await sendMessage(telegram_url, message.chat.id, `${message.from.first_name}... Ти не то робиш`);

    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from TBbot!'),
    };
    return response;
};
