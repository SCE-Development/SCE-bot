const {InvokeCommand} = require('@aws-sdk/client-lambda');
const {Lambda} = require('@aws-sdk/client-lambda');
const commandsPath = '../commands';
const requireDir = require('require-dir');
const Command = require(commandsPath + '/Command');
const Discord = require('discord.js');
const credentials = require('../../config.json');

async function sendData(data){
  const lambdaClient = new Lambda({
    region: 'us-west-1',
    credentials: {
      accessKeyId: credentials.aws_access_key_id,
      secretAccessKey: credentials.aws_secret_access_key
    }
  });

  const params = {
    FunctionName: credentials.aws_function_name,
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify(data)
  };

  const command = new InvokeCommand(params);
  try {
    const response = await lambdaClient.send(command);
    console.log(JSON.stringify(response));
  } catch (err) {
    console.log(err);
  }
}

let commandMap = new Discord.Collection();
const prefix = 's!';

function initialize(){
  const commandFiles = requireDir(commandsPath, { recurse: true });
  for (const directory in commandFiles) {
    for (const file in commandFiles[directory]) {
      const command = require(`${commandsPath}/${directory}/${file}`);
      if (command instanceof Command) {
        if (!command.disabled) {
          commandMap.set(command.name, command);
          command.aliases.map(alias => commandMap.set(alias, command));
        }
      }
    }
  }
}

initialize();

function countSuccessCommands(message){
  sendData(createJSON(message, true));
}

function countUnsuccessCommands(message){
  sendData(createJSON(message, false));
}


function createJSON(message, successful){
  /* eslint-disable */
  let date = new Date;
  let time = checkTime(date.getHours()) + ':' + checkTime(date.getMinutes()) + ':' + checkTime(date.getSeconds());
  let userID = message.author.id;
  let channelID = message.channel.id;
  let msg = message.content;
  let args = message.content.substring(prefix.length).split(/ +/);
  let discord_data;
  date = new Date( date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split("T")[0]; //ISO Format YYYY-MM-DD
  discord_data = {
    Command_Name: args.shift(),
    Command_Args: args,
    Channel_ID: channelID, 
    Message: msg,
    Date: date,
    Time: time,
    UserID: userID,
    Successful: successful,
    Source : 'Discord'
  }
  return discord_data;
  /* eslint-enable */
}


function countInvalidCommands(message){
  let date = new Date;
  /* eslint-disable */
  let time = checkTime(date.getHours()) + ':' + checkTime(date.getMinutes()) + ':' + checkTime(date.getSeconds());
  let userID = message.author.id;
  let channelID = message.channel.id;
  let msg = message.content;
  let args = message.content.substring(prefix.length).split(/ +/);
  let discord_data;
  args.shift(); 
  date = new Date( date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split("T")[0]; 
  discord_data = {
    Command_Name : null,
    Command_Args : args,
    Channel_ID : channelID, 
    Message : msg,
    Date: date,
    Time: time,
    UserID: userID,
    Successful: false,
    Source : 'Discord'
  }
  return discord_data;
  /* eslint-enable */
}

function checkTime(i) {
  if (i < 10) {
    i = '0' + i;
  }
  return i;
}

module.exports =
{countUnsuccessCommands,
  countSuccessCommands,
  countInvalidCommands
};
