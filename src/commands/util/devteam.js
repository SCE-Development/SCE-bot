const Command = require('../Command');


module.exports = new Command({
  name: 'devteam',
  description: 'Devteam information doc',
  aliases: [],
  example: 's!devteam',
  permissions: 'general',
  category: 'information',
  // eslint-disable-next-line
  execute: async (message, args) => {
    await message.channel.send(
      'https://sce.sjsu.edu/s/joinus'
    );
  },
});
