const {
  createAudioPlayer,
  joinVoiceChannel,
  AudioPlayerStatus,
  getVoiceConnection,
  createAudioResource,
} = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const play = require('play-dl');

// see https://stackoverflow.com/a/59626464
class MusicSingleton {
  constructor() {
    if (MusicSingleton._instance) {
      return MusicSingleton._instance;
    }
    MusicSingleton._instance = this;

    this._currentMessage = null;
    this.upcoming = [];
    this.history = [];
    this.botWasKicked = false;
    this.audioPlayer = createAudioPlayer();
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.playNextUpcomingUrl(this);

    }
    );
    this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
      if (this.botWasKicked) {
        return;
      }
      this.announceNowPlaying(this);

    }
    );
    this.audioPlayer.on(AudioPlayerStatus.AutoPaused, async () => {
      // clear queues and stop the streaming
      this.botWasKicked = true;
      this.stop();
      this.setIsBotConnectedToChannel(false);
    });
    this.audioPlayer.on('error', console.error);
  }

  async announceNowPlaying(originalThis) {

    const nowPlaying = originalThis.history[originalThis.history.length - 1];
    originalThis._currentMessage.reply(
      `Now playing \`${nowPlaying.metadata.title}\``
    );
  }

  async playNextUpcomingUrl(originalThis) {
    if (originalThis.upcoming.length) {
      const { url: latestTrack, metadata } = originalThis.upcoming.shift();
      originalThis.history.push({ url: latestTrack, metadata });
      let stream = await play.stream(latestTrack);
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
      });
      originalThis.audioPlayer.play(resource);
    }
    else if (this.botWasKicked) {
      // when the bot is kicked from a channel, the next time it plays a song,
      // the state first goes to idle. we handle this case here by
      // playing the next song instead of disconnecting the bot
      this.botWasKicked = false;
    } else {
      const connection = getVoiceConnection(
        originalThis._currentMessage.guild.voiceStates.guild.id
      );
      originalThis._isBotConnectedToChannel = false;
      connection.destroy();
    }
  }

  isBotConnectedToChannel() {
    return this._isBotConnectedToChannel;
  }

  setIsBotConnectedToChannel(value) {
    this._isBotConnectedToChannel = value;
  }

  skip(message) {
    if (this.isBotConnectedToChannel()) {
      if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) {
        // we stop the audio player here so the state becomes idle
        // once idle, the next song will play
        this.audioPlayer.stop();
      } else {
        message.reply('There is no song to skip!');
      }
    } else {
      // bot is not on
      message.reply('The bot is offline!');
    }
  }

  stop() {
    this.upcoming = [];
    this.history = [];
    this.audioPlayer.stop();
  }
  // Assumes sent url is valid YouTube URL
  async playOrAddYouTubeUrlToQueue(message, url) {
    try {
      const { videoDetails } = await ytdl.getInfo(url);
      this._currentMessage = message;

      if (!message.member.voice.channel) {
        message.reply('You need to join a voice channel first!');
        return false;
      }

      if (!this._isBotConnectedToChannel) {
        const voiceChannel = message.member.voice.channel;
        this.setIsBotConnectedToChannel(true);
        joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        }).subscribe(this.audioPlayer);
      }
      const isInPlayingState =
        this.audioPlayer.state.status === AudioPlayerStatus.Playing;
      if (isInPlayingState) {
        this.upcoming.push({ url, metadata: videoDetails });
        message.reply(`Added track \`${videoDetails.title}\``);
      } else {
        this.history.push({ url, metadata: videoDetails });
        const stream = await play.stream(url);
        this.audioPlayer.play(
          createAudioResource(stream.stream, { inputType: stream.type })
        );
      }
      return true;
    } catch (e) {
      console.error('couldnt play song:', e);
      return false;
    }
  }
}

module.exports = MusicSingleton;
