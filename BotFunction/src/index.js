/* Amplify Params - DO NOT EDIT
	ENV
	REGION
Amplify Params - DO NOT EDIT */

const axios = require("axios");
var AWS = require('aws-sdk');

AWS.config.update({ region: 'eu-west-2' });

var ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

let TABLE_NAME = 'BotStorage-master';

let setBD = false, setDate = false, deleteItem = false;
let userData = null;

var ID = function () {
    return Math.random().toString(9).substr(2, 15);
};



function checkAddBDdateMessage(user_id, username, date) {

    let bd_dateParams = date.split(".");
    if (bd_dateParams.length !== 2) return null;
    if (!(bd_dateParams[0] >= 1 && bd_dateParams[0] <= 31 && bd_dateParams[1] >= 1 && bd_dateParams[1] <= 12)) return null;
    /*if (!(bd_dateParams[0] >= 1 && bd_dateParams[0] <= 29 && bd_dateParams[1] == 2)) return null;
    if (!(bd_dateParams[0] >= 1 && bd_dateParams[0] <= 30 && bd_dateParams[1] == 4)) return null;
    if (!(bd_dateParams[0] >= 1 && bd_dateParams[0] <= 30 && bd_dateParams[1] == 6)) return null;
    if (!(bd_dateParams[0] >= 1 && bd_dateParams[0] <= 30 && bd_dateParams[1] == 9)) return null;
    if (!(bd_dateParams[0] >= 1 && bd_dateParams[0] <= 30 && bd_dateParams[1] == 11)) return null;*/
    let bd_date = bd_dateParams[0] + "." + bd_dateParams[1];
    createNewData(user_id, username, bd_date);
    return bd_date;
}

function checkAddBDusernameMessage(message_text) {
    let message_data = message_text.replace(/\s+/g, ' ').split(" ");
    let username = "";
    for (let i = 0; i < message_data.length; i++) {
        username += message_data[i];
        if (i != message_data.length - 1)
            username += " ";
    }
    return username;
}
async function checkDelBDMessage(user_id, message_text) {
    let username = "";
    let message_data = message_text.replace(/\s+/g, ' ').split(" ");
    for (let i = 0; i < message_data.length; i++) {
        username += message_data[i];
        if (i != message_data.length - 1)
            username += " ";
    }
    let result = await delUserData(user_id, username);
    if(result.Items.length===0) return false
    return true;
}

function createNewData(user_id, username, bd_date) {

    let params = {
        TableName: TABLE_NAME,
        Item: {
            'id': { N: `${ID()}` },
            'user_id': { N: `${user_id}` },
            'bd_date': { S: `${bd_date}` },
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


   return await ddb.query(params, function (err, data) {
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
        message_bd_list += `${user_bd_list.Items[i].username.S}: ${user_bd_list.Items[i].bd_date.S} \n`
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

function stopProcess() {
    setBD = false, setDate = false, deleteItem = false;
    userData = null;
}

exports.handler = async (event) => {
    const message = event.message;
    console.log(message);
    if (message.text.toLowerCase().indexOf("/start") != -1) {
        stopProcess();
        let infoMessage = `Привет! Я бот, который напоминает о ДР твоих друзей. Вот список моих команд:\nДобавить друга в список напоминания: "/setbirthday"
Посмотреть список друзей и их ДР: "/getbdlist"\nУдалить друга из списка:"/delete".`
        await sendMessage(telegram_url, message.chat.id, infoMessage);

    } else if (message.text.toLowerCase().indexOf("/setbirthday") != -1) {
        stopProcess();
        setBD = true;
        await sendMessage(telegram_url, message.chat.id, `Введите имя юзера, которого хотите добавить. Или /stop, чтоб остановить процесс добавления.`);
        
    } else if (message.text.toLowerCase().indexOf("/getbdlist") != -1) {
        stopProcess();
        let message_bd_list = await getUserList(message);
        await sendMessage(telegram_url, message.chat.id, message_bd_list);
    } else if (message.text.toLowerCase().indexOf("/delete") != -1) {
        stopProcess();
        deleteItem = true;
        await sendMessage(telegram_url, message.chat.id, `Введите имя юзера, которого хотите удалить. Или /stop, чтоб остановить процесс удаления.`);
        
    } else if (message.text.toLowerCase().indexOf("/stop") != -1) {
        stopProcess();
        await sendMessage(telegram_url, message.chat.id, "Все процессы остановлены.");
    } else if (message.text && setBD) {
        userData = checkAddBDusernameMessage(message.text);
        setBD = false; setDate = true;
        await sendMessage(telegram_url, message.chat.id, `Введите дату рождения в формате "DD.MM". Или /stop, чтоб остановить процесс добавления.`);
    } else if (message.text && setDate) {
        let result = checkAddBDdateMessage(message.chat.id, userData, message.text);
        if (result !== null){
            await sendMessage(telegram_url, message.chat.id, "Вы успешно добавили друга в список.");
            setDate = false;   
            userData = null;             
        }
        else
            await sendMessage(telegram_url, message.chat.id, `Дата рождения должна быть в формате "DD.MM".`);
    } else if (message.text && deleteItem) {
        deleteItem = false;
        if (await checkDelBDMessage(message.chat.id, message.text)) {
            await sendMessage(telegram_url, message.chat.id, "Удаление было совершено.");
            
        } else await sendMessage(telegram_url, message.chat.id, "Данный юзер в списке не найден.");
    } else {
        stopProcess();
        await sendMessage(telegram_url, message.chat.id, `${message.from.first_name}... Ти не то робиш.`);
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from TBbot!'),
    };
    return response;
};
