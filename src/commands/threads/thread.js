const Discord = require('discord.js');
const Command = require('../Command');
const { THREAD_QUERY, CREATE_THREAD } = require('../../APIFunctions/thread');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

module.exports = new Command({
  name: 'thread',
  description: 'View active threads or start a new one',
  category: 'threads',
  aliases: [],
  permissions: 'general',
  params:
    '`active` (view active threads), `all` (view all threads),\
  `<topic>` (start new thread)',
  example: 's!thread <param (optional)>',
  execute: (message, args) => {
    const param = args.join(' ').trim();

    if (param === 'active' || param === 'all') {
      // Show threads
      const getThreads = async () => {
        const getAll = param === 'all';
        const currentDate = new Date();
        const response = await THREAD_QUERY();
        const embed = new Discord.RichEmbed().setDescription(
          'Use `|thread id|` to view the full thread or\
            `|thread id| <message>` to add to the thread'
        );

        const checkIfInclude = (message) =>
          getAll || (currentDate - message.createdAt) / MS_PER_DAY < 7;
        const requestMessage = (id) =>
          message.channel
            .fetchMessage(id)
            .then((response) => response)
            .catch(() => null);

        for (let i = 0; i < response.responseData.length; i++) {
          const thread = response.responseData[i];
          let lastMessage = await requestMessage(
            thread.threadMessages[thread.threadMessages.length - 1].messageID
          );
          // Catch messages from other channels and
          // do not display messages older than a week old
          if (lastMessage === null || !checkIfInclude(lastMessage)) {
            continue;
          }
          const blurb = (
            lastMessage.member.displayName +
            ' on ' +
            lastMessage.createdAt.toLocaleDateString() +
            '\n' +
            lastMessage.content
          ).substring(0, 150);
          // Add the thread and display the last message
          if (thread.topic) {
            embed.addField(
              thread.topic + ' (id: ' + thread.threadID + ')',
              blurb
            );
          } else {
            embed.addField(' (id: ' + thread.threadID + ')', blurb);
          }
        }
        if (getAll) {
          embed.setTitle('All Threads');
        } else {
          embed.setTitle('Active Threads');
        }
        if (embed.fields.length === 0) {
          embed.setFooter('No threads found in this channel.');
        }
        return embed;
      };

      getThreads()
        .then((embed) => message.channel.send(embed))
        .catch(() => message.channel.send('Oops! Could not query threads.'));
    } else if (param.length > 0) {
      // Start new thread
      // todo generate threadID
      const threadID = '1';

      const createThread = async () =>
        await CREATE_THREAD({
          threadID: threadID,
          creatorID: message.member.id,
          guildID: message.guild.id,
          topic: param,
          messageID: message.id,
        });

      createThread().then((response) => {
        if (response.error) {
          message.channel.send('Oops! Could not create thread ' + param);
        } else {
          message.channel.send(
            new Discord.RichEmbed()
              .setTitle('New Thread')
              .setDescription(
                'Use `|thread id|` to view the full thread or\
                `|thread id| <message>` to add to the thread'
              )
              .addField('ID', response.responseData.id)
              .addField('Topic', response.responseData.topic)
          );
        }
      });
    } else {
      // Help
      message.channel.send(
        new Discord.RichEmbed()
          .setColor('#ccffff')
          .setTitle('Thread')
          .setDescription('View or start threads\nUse `|thread id|` to view\
          the full thread or `|thread id| <message>` to add to the thread')
          .addField('s!thread all', 'View all threads')
          .addField('s!thread active', 'View active threads')
          .addField('s!thread <topic>', 'Start a new thread')
      );
    }
  },
});
