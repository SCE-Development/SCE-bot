const Command = require('../Command');


module.exports = new Command({
  name: 'internship',
  description: 'Internship information doc',
  aliases: [],
  example: 's!internship',
  permissions: 'general',
  category: 'information',
  // eslint-disable-next-line
  execute: async (message, args) => {
    await message.channel.send(
      'https://sce.sjsu.edu/s/internshipinfo'
    );
  },
});
