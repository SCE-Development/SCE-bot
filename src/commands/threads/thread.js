const Discord = require('discord.js');
const Command = require('../Command');
const {
  THREAD_QUERY,
  CREATE_THREAD,
  DELETE_THREAD,
  DELETE_THREADMESSAGE,
} = require('../../APIFunctions/thread');

const THREADS_PER_PAGE = 6;
const KEEP_ALIVE = 300000; // 5 minutes
const ACTIVE_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

module.exports = new Command({
  name: 'thread',
  description: 'View active threads or start a new one',
  aliases: [],
  example: 's!thread <[all | active | none] | topic>',
  permissions: 'general',
  category: 'custom threads',
  disabled: true,
  execute: async (message, args) => {
    const param = args.join(' ').trim();

    if (param === 'active' || param === 'all') {
      // Show threads
      message.delete(5000).catch(() => null);
      const response = await THREAD_QUERY();
      if (response.error) {
        message.channel
          .send('Oops! Could not query threads')
          .then(msg => msg.delete(10000).catch(() => null));
        return;
      }

      const getAll = param === 'all';
      const currentDate = new Date();

      const checkIfInclude = message =>
        getAll || (currentDate - message.createdAt) / MS_PER_DAY < ACTIVE_DAYS;

      const fields = [];
      for (let i = 0; i < response.responseData.length; i++) {
        const thread = response.responseData[i];
        if (
          thread.guildID !== message.guild.id ||
          thread.channelID !== message.channel.id
        ) {
          continue;
        }
        let j = thread.threadMessages.length;
        let lastMessage = null;
        while (lastMessage === null && j-- >= 0) {
          const threadMessage = thread.threadMessages[j];
          lastMessage = await message.channel
            .fetchMessage(threadMessage.messageID)
            .catch(() => {
              DELETE_THREADMESSAGE({
                threadID: thread.threadID,
                messageID: threadMessage.messageID,
              }).catch(() => null);
              return null;
            });
        }
        if (lastMessage === null) {
          DELETE_THREAD(thread.threadID);
          continue;
        }
        if (!checkIfInclude(lastMessage)) {
          continue;
        }
        const blurb = `${
          lastMessage.member.displayName
        } on ${lastMessage.createdAt.toLocaleDateString()}\n${
          lastMessage.content
        }`.substring(0, 150);
        // Add the thread and display the last message
        if (thread.topic === null) {
          fields.push([`(id: ${thread.threadID})`, blurb]);
        } else {
          fields.push([`${thread.topic} (id: ${thread.threadID})`, blurb]);
        }
      }

      const makeEmbed = (page, numPages) => {
        const embed = new Discord.RichEmbed().setDescription(
          'Use `|thread id|` to view the full thread or\
              `|thread id| <message>` to add to the thread.\n\
              Type at least 4 digits of the thread id.'
        );
        if (getAll) {
          embed.setTitle('All Threads');
        } else {
          embed.setTitle('Active Threads');
        }
        if (fields.length === 0) {
          embed.setFooter('No threads found in this channel.');
        }
        if (numPages > 1) {
          embed.setFooter(`Page ${page + 1} of ${numPages}`);
        }
        return embed;
      };

      if (fields.length > THREADS_PER_PAGE) {
        // pagination
        const numPages = Math.ceil(fields.length / THREADS_PER_PAGE);
        let page = 0;
        const embed = makeEmbed(page, numPages);
        for (let i = 0; i < THREADS_PER_PAGE; i++) {
          embed.addField(fields[i][0], fields[i][1]);
        }
        message.channel.send(embed).then(async sentEmbed => {
          await sentEmbed.react('⬅️');
          await sentEmbed.react('➡️');

          const filter = (reaction, user) => {
            return (
              ['⬅️', '➡️'].includes(reaction.emoji.name) &&
              user.id === message.author.id
            );
          };
          const collector = sentEmbed.createReactionCollector(filter, {
            time: KEEP_ALIVE,
          });
          collector.on('collect', reaction => {
            reaction.remove(reaction.users.last().id);
            switch (reaction.emoji.name) {
              case '⬅️':
                if (page === 0) {
                  page = numPages - 1;
                } else {
                  page--;
                }
                break;
              case '➡️':
                if (page === numPages - 1) {
                  page = 0;
                } else {
                  page++;
                }
            }
            const newEmbed = makeEmbed(page, numPages);
            const indexLimit = Math.min(
              (page + 1) * THREADS_PER_PAGE,
              fields.length
            );
            for (let i = page * THREADS_PER_PAGE; i < indexLimit; i++) {
              newEmbed.addField(fields[i][0], fields[i][1]);
            }
            sentEmbed.edit(newEmbed);
          });
          sentEmbed.delete(KEEP_ALIVE).catch(() => null);
        });
      } else {
        // no pagination
        const embed = makeEmbed(0, 0);
        fields.forEach(field => {
          embed.addField(field[0], field[1]);
        });
        message.channel
          .send(embed)
          .then(msg => msg.delete(KEEP_ALIVE).catch(() => null));
      }
    } else if (param.length > 0) {
      // Start new thread
      // Confirm action
      const confirmAction = async () => {
        const confirmMessage = await message.channel.send(
          new Discord.RichEmbed()
            .setTitle('Start new thread?')
            .addField('Topic', param, true)
        );
        confirmMessage
          .react('👍')
          .then(() => confirmMessage.react('👎'))
          .catch(() => null);

        const filter = (reaction, user) => {
          return (
            ['👍', '👎'].includes(reaction.emoji.name) &&
            user.id === message.author.id
          );
        };

        let confirmed = false;
        await confirmMessage
          .awaitReactions(filter, { max: 1, time: 30000, errors: ['time'] })
          .then(collected => {
            const reaction = collected.first();
            confirmMessage.delete().catch(() => null);
            if (reaction.emoji.name === '👍') {
              confirmed = true;
            } else {
              message.channel
                .send('New thread canceled')
                .then(msg => msg.delete(10000).catch(() => null));
            }
          })
          .catch(() => {
            confirmMessage.delete().catch(() => null);
            message.channel
              .send('New thread canceled')
              .then(msg => msg.delete(10000).catch(() => null));
          });

        return confirmed;
      };
      // Create thread
      const confirmed = await confirmAction();
      if (!confirmed) {
        return;
      }
      const threadID = message.createdTimestamp
        .toString()
        .split('')
        .reverse()
        .join('');

      const mutation = {
        threadID: threadID,
        creatorID: message.member.id,
        guildID: message.guild.id,
        channelID: message.channel.id,
        messageID: message.id,
      };
      if (param !== 'none') {
        mutation.topic = param;
      }

      const response = await CREATE_THREAD(mutation);
      if (response.error) {
        // Error
        message.channel
          .send('Oops! Could not create thread ' + param)
          .then(msg => {
            msg.delete(20000).catch(() => null);
          });
        return;
      }
      if (response.responseData.topic === null) {
        response.responseData.topic = 'none';
      }
      message.channel.send(
        new Discord.RichEmbed()
          .setTitle('New Thread')
          .setDescription(
            'Use `|thread id|` to view the full thread or\
                `|thread id| <message>` to add to the thread.\n\
                Type at least 4 digits of the thread id.'
          )
          .addField('ID', response.responseData.threadID, true)
          .addField('Topic', response.responseData.topic, true)
      );
    } else {
      // Help
      message.delete().catch(() => null);
      message.channel.send(
        new Discord.RichEmbed()
          .setColor('#ccffff')
          .setTitle('Thread')
          .setDescription(
            'View or start threads\nUse `|thread id|` to view\
          the full thread or `|thread id| <message>` to add to the thread.\n\
          Type at least 4 digits of the thread id.'
          )
          .addField('`s!thread all`', 'View all threads')
          .addField(
            '`s!thread active`',
            `View threads with activity in the last ${ACTIVE_DAYS} days`
          )
          .addField('`s!thread <topic>`', 'Start a new thread with a topic')
          .addField('`s!thread none`', 'Start a new thread without a topic')
      );
    }
  },
});
