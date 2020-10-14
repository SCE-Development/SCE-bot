const Discord = require('discord.js');
const { prefix, API_TOKEN, database } = require('./config.json');
const { CommandHandler } = require('./src/CommandHandler');
const {
  VoiceChannelChangeHandler
} = require('./src/VoiceChannelChangeHandler');
const mongoose = require('mongoose');
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { schema } = require('./api/resolvers/index.js');
const port = 5000;

const startBot = async () => {
  const client = new Discord.Client();
  const commandHandler = new CommandHandler('./commands', prefix);
  const vcChangeHandler = new VoiceChannelChangeHandler();
  client.once('ready', () => {
    commandHandler.initialize();
    client.user.setActivity('Managing the SCE');
    console.log('Discord bot live');
  });

  client.on('message', message => {
    commandHandler.handleMessage(message);
  });

  client.on('voiceStateUpdate', (oldMember, newMember) => {
    vcChangeHandler.handleChangeMemberInVoiceChannel(oldMember, newMember);
  });

  client.login(API_TOKEN);
};

// Conenct to mongoose
const startDatabase = () => {
  const url = `mongodb://localhost/${database}`;
  mongoose.connect(url, {
    autoIndex: true,
    poolSize: 50,
    bufferMaxEntries: 0,
    keepAlive: 120,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
  });
  mongoose.connection.once('open', () =>
    console.log('Connected to Mongo')
  );
};

const startServer = async () => {
  const server = new ApolloServer({
    schema,
    playground: true,
    introspection: true
  });
  // Express app
  const app = express();

  server.applyMiddleware({ app });

  // start app
  app.listen(port, () => console.log(`Server running at port ${port}`));
};


startBot();
startDatabase();
startServer();
