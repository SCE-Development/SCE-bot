const { prefix } = require('../../../config.json');

const Command = require('../Command');

const MusicSingleton = require('../../util/MusicSingleton');

const musicHandler = new MusicSingleton();

module.exports = new Command({
  name: 'stop',
  description: 'Stop, clear queues and disconnect the bot',
  aliases: ['stop'],
  example: `${prefix}stop`,
  permissions: 'member',
  category: 'information',
  disabled: false,
  execute: async (message) => {
    if (!message.member.voice.channel) {
      return message.reply('Please join voice channel first!');
    }
    musicHandler.stop(message);
  },
});
