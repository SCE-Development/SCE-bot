// see https://discord.js.org/#/docs/discord.js/12.5.3/topics/voice

/**
 * stupid hacks:
 * docker exec -it bot /bin/sh
 * npm update
 * npm i libsodium-wrappers
 */

const {
  prefix
} = require('../../../config.json');


const {
  joinVoiceChannel,
  createAudioResource,
  getVoiceConnection,
  AudioPlayerStatus,

} = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const play = require('play-dl');

const Command = require('../Command');

let { audio, getIsBotOn, setIsBotOn } = require('./audio');
// get next audio resource to play
// create new AudioResource for audio to play
const getNextResource = async () => {
  const latestTrack = audio.upcoming.shift();
  if (latestTrack) {
    audio.history.push(latestTrack);
    let stream = await play.stream(latestTrack);
    return createAudioResource(stream.stream, { inputType: stream.type });
  }
};

// idle state
// bot dc when finish playing
audio.player.on(AudioPlayerStatus.Idle, async () => {
  const resource = await getNextResource();
  if (resource) {
    audio.player.play(resource);
  }
  else {
    // disconnect if there is no more track to play
    setIsBotOn(false);
    const connection = getVoiceConnection(
      audio.message.guild.voiceStates.guild.id
    );
    connection.destroy();
  }

});

audio.player.on(AudioPlayerStatus.Playing, async () => {
  const { videoDetails: jsonData } = await ytdl.getInfo(
    audio.history[audio.history.length - 1]
  );
  audio.message.reply(`Now playing \`${jsonData.title}\``);
});

audio.player.on('error', error => {
  console.error(`Error: ${error}`);
});


module.exports = new Command({
  data: audio,
  name: 'play',
  description: 'imagine kneeling to a corporation',
  aliases: ['play'],
  example: 's!play',
  permissions: 'member',
  category: 'information',
  disabled: false,
  execute: async (message, args) => {
    const url = args[0];
    // const cacheKey = Object.keys(message.guild.voiceStates)[0];
    // const channelId = message.guild.voiceStates[cacheKey].channelID;
    // const guildId = message.guild.voiceStates.guild.id;
    const voiceChannel = message.member.voice.channel;
    audio.message = message;
    if (message.member.voice.channel) {
      if (!getIsBotOn()) {
        setIsBotOn(true);
        joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        }).subscribe(audio.player);

      }
      // check if it is a playable url
      if (ytdl.validateURL(url)) {
        const { videoDetails } = await ytdl.getInfo(url);
        if (audio.player.state.status === AudioPlayerStatus.Playing) {
          audio.upcoming.push(url);
          message.reply(`Added track \`${videoDetails.title}\``);
        } else {
          audio.history.push(url);
          let stream = await play.stream(url);
          audio.player.play(
            createAudioResource(stream.stream, { inputType: stream.type })
          );
        }
      }
      else {
        if (args[0] === undefined)
          message.reply(`Usage: 
          \`${prefix}search <query>: Returns top 5\`
          \`${prefix}play <title/url>: Plays first song from search/ url\`
          \`${prefix}stream stop/skip: Modifies song playing\`
          
          `);
        else {
          // search 
          let ytInfo = await play.search(args.join(' '), { limit: 1 });
          // if it return result
          if (ytInfo.length > 0) {
            if (audio.player.state.status === AudioPlayerStatus.Playing) {
              audio.upcoming.push(ytInfo[0].url);
              message.reply(`Added track \`${ytInfo[0].title}\``);
            } else {
              audio.history.push(ytInfo[0].url);
              let stream = await play.stream(ytInfo[0].url);
              audio.player.play(
                createAudioResource(stream.stream, { inputType: stream.type })
              );
            }
          }
          else {
            message.reply(
              `${args.join(' ')} is not a valid YouTube / SoundCloud URL`
            );
          }
        }

      }

    } else {
      message.reply('You need to join a voice channel first!');
    }
  }
});
