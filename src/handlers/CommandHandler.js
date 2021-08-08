const commandsPath = '../commands';
const utilPath = '../util';
const {countSuccessCommands,
  countUnsuccessCommands,
  countInvalidCommands} = require('./cmd-count.js');

const Command = require(commandsPath + '/Command');
const { CooldownManager } = require(utilPath + '/CooldownManager');
const { INVALID_TIME } = require(utilPath + '/constants');
const { parseCommandParameters } = require(utilPath + '/CommandParser');

const Discord = require('discord.js');
const requireDir = require('require-dir');

/**
 * Class which handles invoking the correct prefixed command
 * for the SCE discord bot and checks the user's cooldown status
 * for the command.
 */
class CommandHandler {
  /**
   * Create a CommandHandler.
   * @member {string} commandMap A map containing a command name e.g. "ping"
   * mapped to the proper class that handles it.
   * @member {CooldownManager} cooldownManager An instance of the
   * CooldownManager class to avoid spam from users.
   */
  constructor() {
    this.commandMap = new Discord.Collection();
    this.cooldownManager = new CooldownManager();
  }

  /**
   * Iterate through the supplied command directory to populate the commandMap.
   */
  initialize() {
    const commandFiles = requireDir(commandsPath, { recurse: true });
    for (const directory in commandFiles) {
      for (const file in commandFiles[directory]) {
        const command = require(`${commandsPath}/${directory}/${file}`);
        if (command instanceof Command) {
          if (!command.disabled) {
            this.commandMap.set(command.name, command);
            command.aliases.map(alias => this.commandMap.set(alias, command));
          }
        }
      }
    }
  }

  /**
   * Function to handle when a user sends a command on discord.
   * @param {string} message An event triggered by a user's input.
   * @requires message author is not a bot
   * Informs user if the command is on cooldown.
   */
  handleCommand(prefix, message) {
    let args = message.content.slice(prefix.length).split(/ +/);
    const commandName = args.shift().toLowerCase();
    args = parseCommandParameters(args.join(' '));

    if (!this.commandMap.has(commandName)) {
      countInvalidCommands(message);
      return;
    } else {
      const cooldownStatus = this.cooldownManager.needsToCoolDown(
        message.author.id,
        this.commandMap.get(commandName)
      );
      if (cooldownStatus !== INVALID_TIME) {
        message.channel.send(
          `please wait ${cooldownStatus.toFixed(1)} ` +
            `more second(s) before reusing the \`${commandName}\` command.`
        );
        return;
      }
      // Add a commands field to message.client to
      // reference all available commands
      message.client.commands = this.commandMap;
      this.executeCommand(commandName, message, args);
    }
  }

  /**
   * Execute a bot command.
   * @param {string} commandName The name of the command to be invoked.
   * @param {string} message Data related to the command invocation
   * @param {Discord.Collection} message.client.commands A map containing
   * all of the available bot commands.
   * @param {Object} args Any arguments sent from the user.
   */
  executeCommand(commandName, message, args) {
    const command = this.commandMap.get(commandName);

    try {
      command.execute(message, args);
      countSuccessCommands(message);
    } catch (Exception) {
      countUnsuccessCommands(message);
    }
  }
}

module.exports = { CommandHandler };
