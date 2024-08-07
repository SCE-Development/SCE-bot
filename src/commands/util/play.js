const { prefix } = require('../../../config.json');
const ytdl = require('@distube/ytdl-core');
const play = require('play-dl');

const Command = require('../Command');
const MusicSingleton = require('../../util/MusicSingleton');

const musicHandler = new MusicSingleton();

module.exports = new Command({
  name: 'play',
  description: 'Stream the URL/the most relevant result return from Youtube',
  aliases: ['play'],
  example: `${prefix}play <url/song title>`,
  permissions: 'member',
  category: 'music',
  disabled: false,
  execute: async (message, args) => {
    const repetitions = args[0];
    const url = args[1];
    if (!repetitions && !url) {
      return musicHandler.resume(message);
    }
    if (ytdl.validateURL(url)) {
      return musicHandler.playOrAddYouTubeUrlToQueue(message, url, repetitions);
    }
    if (args[0] === undefined) {
      return message.reply(`Usage: 
        \`${prefix}search <query>: Returns top 5\`
        \`${prefix}play <title/url>: Plays first song from search/ url\`
        \`${prefix}stream stop/skip: Modifies song playing\`
        
        `);
    }

    const searchQuery = args.slice(1).join(' ');
    let ytInfo = await play.search(searchQuery, { limit: 1 });
    if (ytInfo.length > 0) {
      return musicHandler.playOrAddYouTubeUrlToQueue(
        message, 
        ytInfo[0].url, 
        repetitions
      );
    }
    message.reply(
      `${args.join(' ')} is not a valid YouTube / SoundCloud URL`
    );
  } 
});
