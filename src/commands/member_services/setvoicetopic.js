const Command = require('../Command');

module.exports = new Command({
  name: 'setvoicetopic',
  description: 'Rename Voice Channel, but can be only done 2 per 10 min',
  category: 'member services',
  aliases: ['svt'],
  permissions: 'member',
  example: 's!setvoicetopic',
  execute: async (message, args) => {
    // Check if a user gave topic for args
    if (!args.length) {
      await message.channel.send('You need to give the name of the channel!').
        then((msg) => {msg.delete(5000);});
      return ;
    }
    const str = args.join(' ');
    // Check if guild is still available
    if (!message.guild.available) {
      await message.channel.send('The server (guild) is unavailable').
        then((msg) => {msg.delete(5000);});
      return ;
    }
    // Check if a user is in voicechannel
    if (!message.member.voiceChannelID) {
      await message.channel.send('You are not in a voice chat!').
        then((msg) => {msg.delete(5000);});
      return ;
    }

    const author = message.member;
    // Check if a user has permission to change channel name
    const vcID = message.member.voiceChannelID;
    const vc = author.guild.channels.get(vcID);
    let oriname = vc.name;
    // Check if channel has been renamed or not
    const re = /(?<=: : \().+(?=\))/;
    if (re.test(oriname)) {
      oriname = oriname.match(re)[0];
    }
    // Function that edits the name
    const fin = new Promise((resolve, reject) => {
      vc.edit({name: str+'  : : ('+oriname+')'}).then(() => {resolve();});
      setTimeout(() => {reject('timeout');}, 3000);
    }).then((res) => {return res;});

    try {
      await fin;
      await message.channel.send('Successfully changed Name!')
        .then((msg) => {msg.delete(5000);});
    } catch (error) {
      await 
      message.channel.send('You are on cooldown! Try again in 10 minutes.')
        .then((msg) => {msg.delete(5000);});
    } finally {
      message.delete(5000);
    }
  },
});
