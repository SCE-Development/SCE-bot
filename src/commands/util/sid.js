module.exports = {
  name: 'sid',
  description: 'grab server ID',
  category: 'information',
  aliases: [],
  permissions: 'general',
  execute(message) {
    message.channel.send('Guild ID is ' + message.guild.id);
  }
};