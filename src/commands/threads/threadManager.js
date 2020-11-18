const Command = require('../Command');

module.exports = new Command({
  name: 'threadmanager',
  description: 'Thread Manager. Used for managing custom threads.',
  category: 'custom threads',
  aliases: ['tm'],
  permissions: 'admin',
  execute: (message, args) => {
    console.log('Executed Command: <thread manager>, args=' + args);
  }
});