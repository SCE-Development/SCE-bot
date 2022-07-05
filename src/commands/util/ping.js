const Command = require('../Command');

const snowboardEmoji = '🏂';
const clockEmoji = '🕑';
const CheckDiscordID = require('../../APIFunctions/CheckDiscordID');
const SendFileURL = require('../../APIFunctions/SendFileURL');
const {DISCORD_SECRET_KEY} = require('../../../config.json');

module.exports = new Command({
  name: 'ok',
  description: 'Check if the bot is up',
  aliases: [],
  example: 's!ok',
  permissions: 'general',
  category: 'information',
  // eslint-disable-next-line
  execute: async (message, args) => {
    const userID = message.author.id;
    // const file = message.author.lastMessageID;
    const filesArray = message.attachments.entries();
    const url = filesArray.next().value[1].url;

    // entries return an array of [key,value] 
    // we can use iterator to go through the array 
    const checkUser = {
      discordID: userID,
    };
    const checkURL = {
      url: url,
      apiKey: DISCORD_SECRET_KEY
    };

    const checkingInProcess = await message.channel.send('Checking user ID...');
    const {mess}  = await CheckDiscordID.checkID(checkUser);

    if(mess === 'User exists'){
      const response = await SendFileURL.allowPrinting(checkURL);
      
      if(response !== 'OK'){
        checkingInProcess.edit('Invalid API Key! Unable to print!');
      } else{
        checkingInProcess.edit(mess);
        message.channel.send('Printing...');
        const pingResponse = await message.channel.send(
          `Calculating latency... ${snowboardEmoji}`
        );
        const messageLatency =
          pingResponse.createdTimestamp - message.createdTimestamp;
        pingResponse.edit(`Pong! Latency is ${messageLatency} ms 
        ${clockEmoji}.`);
      }
    } else{
      checkingInProcess.edit(mess);
    }
  },
});
