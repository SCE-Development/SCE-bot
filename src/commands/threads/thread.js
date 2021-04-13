const Discord = require('discord.js');
const { prefix } = require('../../../config.json');
const Command = require('../Command');
const {
  THREAD_QUERY,
  CREATE_THREAD,
  DELETE_THREAD,
  DELETE_THREADMESSAGE,
} = require('../../APIFunctions/thread');
const { createIdByTime, decorateId } = require('../../util/ThreadIDFormatter');

const THREADS_PER_PAGE = 6;
const KEEP_ALIVE = 300000; // 5 minutes
const ACTIVE_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

module.exports = new Command({
  name: 'thread',
  description: 'View active threads or start a new one',
  aliases: [],
  example: `${prefix}thread <all | active | none | topic>`,
  permissions: 'general',
  category: 'custom threads',
  execute: async (message, args) => {
    const param = args.join(' ').trim();

    if (param === 'active' || param === 'all') {
      // Show threads
      const response = await THREAD_QUERY({ guildID: message.guild.id });
      if (response.error) {
        message.channel.send('Oops! Could not query threads').then(msg => {
          msg.delete({ timeout: 10000 }).catch(() => null);
          message.delete({ timeout: 10000 }).catch(() => null);
        });
        return;
      }

      const getAll = param === 'all';
      const currentDate = new Date();

      const checkIfInclude = message =>
        getAll || (currentDate - message.createdAt) / MS_PER_DAY < ACTIVE_DAYS;

      const fields = [];
      for (let i = 0; i < response.responseData.length; i++) {
        const thread = response.responseData[i];
        let j = thread.threadMessages.length;
        let lastMessage = null;
        while (lastMessage === null && j-- > 0) {
          const threadMessage = thread.threadMessages[j];
          lastMessage = await message.channel.messages
            .fetch(threadMessage.messageID)
            .catch(error => {
              if (error.message === 'Unknown Message') {
                DELETE_THREADMESSAGE({
                  threadID: thread.threadID,
                  guildID: thread.guildID,
                  messageID: threadMessage.messageID,
                });
              }
              return null;
            });
        }
        if (lastMessage === null) {
          DELETE_THREAD({ threadID: thread.threadID, guildID: thread.guildID });
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
          fields.push([`(id: ${decorateId(thread.threadID)})`, blurb]);
        } else {
          fields.push([
            `${thread.topic} (id: ${decorateId(thread.threadID)})`,
            blurb,
          ]);
        }
      }

      const makeEmbed = (page, numPages) => {
        const embed = new Discord.MessageEmbed().setDescription(
          'Use `[thread id]` to view the full thread or ' +
            '`[thread id] message` to add to the thread.\n' +
            'Type at least 4 digits of the thread id.'
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
            reaction.users.remove(reaction.users.cache.last());

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
          sentEmbed.delete({ timeout: KEEP_ALIVE }).catch(() => null);
          message.delete({ timeout: 10000 }).catch(() => null);
        });
      } else {
        // no pagination
        const embed = makeEmbed(0, 0);
        fields.forEach(field => {
          embed.addField(field[0], field[1]);
        });
        message.channel.send(embed).then(msg => {
          msg.delete({ timeout: KEEP_ALIVE }).catch(() => null);
          message.delete({ timeout: 10000 }).catch(() => null);
        });
      }
    } else if (param.length > 0) {
      // Start new thread
      // Confirm action
      const confirmAction = async topic => {
        const confirmMessage = await message.channel.send(
          new Discord.MessageEmbed()
            .setTitle('Start new thread?')
            .addField('Topic', topic, true)
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
                .then(msg => msg.delete({ timeout: 10000 }).catch(() => null));
            }
          })
          .catch(() => {
            confirmMessage.delete().catch(() => null);
            message.channel
              .send('New thread canceled')
              .then(msg => msg.delete({ timeout: 10000 }).catch(() => null));
          });

        return confirmed;
      };
      // Create thread
      const topic = param.substring(0, 130);
      const confirmed = await confirmAction(topic);
      if (!confirmed) {
        return;
      }
      const threadID = createIdByTime(message.createdAt);

      const mutation = {
        threadID: threadID,
        creatorID: message.member.id,
        guildID: message.guild.id,
        channelID: message.channel.id,
        messageID: message.id,
      };
      if (topic !== 'none') {
        mutation.topic = topic;
      }

      const response = await CREATE_THREAD(mutation);
      if (response.error) {
        // Error
        message.channel
          .send('Oops! Could not create thread ' + param)
          .then(msg => {
            msg.delete({ timeout: 20000 }).catch(() => null);
          });
        return;
      }
      if (response.responseData.topic === null) {
        response.responseData.topic = 'none';
      }
      message.channel.send(
        new Discord.MessageEmbed()
          .setTitle('New Thread')
          .setDescription(
            'Use `[thread id]` to view the full thread or ' +
              '`[thread id] message` to add to the thread.\n' +
              'Type at least 4 digits of the thread id.'
          )
          .addField('ID', decorateId(response.responseData.threadID), true)
          .addField('Topic', response.responseData.topic, true)
      );
    } else {
      // Help
      message.delete().catch(() => null);
      message.channel.send(
        new Discord.MessageEmbed()
          .setColor('#ccffff')
          .setTitle('Thread')
          .setDescription(
            'View or start threads\nUse `[thread id]` to view ' +
              'the full thread or `[thread id] message` to add to the ' +
              'thread.\nType at least 4 digits of the thread id.'
          )
          .addField(`\`${prefix}thread all\``, 'View all threads')
          .addField(
            `\`${prefix}thread active\``,
            `View threads with activity in the last ${ACTIVE_DAYS} days`
          )
          .addField(
            `\`${prefix}thread <topic>\``,
            'Start a new thread with a topic'
          )
          .addField(
            `\`${prefix}thread none\``,
            'Start a new thread without a topic'
          )
      );
    }
  },
});
