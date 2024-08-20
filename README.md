<p align="center"><img src="https://i.imgur.com/MZiw1Yp.png" alt="interchat logo" width="150px"/></p>

<p align="center"><strong>InterChat</strong></p>

[![CodeFactor](https://www.codefactor.io/repository/github/discord-interchat/interchat/badge)](https://www.codefactor.io/repository/github/discord-interchat/interchat)
[![Discord Bots](https://top.gg/api/widget/servers/769921109209907241.svg/)](https://top.gg/bot/769921109209907241)

This repo contains the source code for the InterChat Discord bot. InterChat is a Discord bot that allows you to chat with users from other servers.

# ❗Contributors Needed ❗

InterChat is an open-source project that connects communities across Discord servers. We're actively looking for contributors to help us improve and expand this project!

## How You Can Help

- **Feature Development:** Help us build new features that make cross-server communication even more seamless.
- **Bug Fixes:** Assist in identifying and squashing bugs to enhance stability and performance.
- **Documentation:** Improve our documentation to make it easier for others to get involved and use InterChat.
- **Testing:** Contribute to testing new features and updates, ensuring everything works smoothly.

# Getting Started

## Prerequisites

1. [Node.js](https://nodejs.org/)
2. [Git](https://git-scm.com/downloads)
3. [MongoDB](https://www.mongodb.com/try/download/community)
4. [An Imgur API Key](https://api.imgur.com/oauth2/addclient) (optional, for setting hub icon and banner)
5. [Python 3.9.13](https://www.python.org/downloads/release/python-3913/) & [Visual Studio Build Tools (Windows Only)](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2019) (for Tensorflow)

## Running the code

1. Create a file called `.env` and fill it out with the appropriate contents
2. Install the dependencies
3. Build the code using `pnpm build`
4. Register commands for your bot using `pnpm deploy-commands --public --private`
5. Finally run the code using `pnpm dev`. `pnpm start` to run in production mode

## Creating Commands

To add a new command, follow these steps:

1. Create a new file in the `src/commands` directory with the command's name.
2. In this file, export a **default** class that extends the `BaseCommand` class from `src/commands/BaseCommand.ts`.
3. Include:
   - A `data` property to store the slash command builder or raw command JSON.
   - An `execute` method to handle incoming commands.

You can also explore various other methods and properties for additional customization by referring to `src/commands/BaseCommand.ts` for more details.

### Subcommands

To add a subcommand, follow these steps:

1. Create a new file named `index.ts` in the `src/commands/<command name>/` directory.
2. In this file, export a **default class** that extends the `BaseCommand` class found in `src/commands/BaseSubCommand.ts`.
3. Create additional files in the same directory, each named after a subcommand.
4. In each of these files, export a **default class** that extends the class created in `./index.ts`. Ensure that the subcommand file names match the registered subcommand names on Discord.

## Adding cooldowns

To add a cooldown to a command/subcommand, simply add a `cooldown` property to the class with the value being the cooldown in milliseconds. The cooldown will be applied to the user who executed the command.

## Creating Custom IDs

To help with handling components, we have a custom ID class that can be used to create custom IDs for components. To create a custom ID, simply call the `CustomID` method with the custom ID prefix and the custom suffix. Example:

```ts
const customId = new CustomID()
  .setIdentifier('cool_button_', '1') // add a prefix and a suffix
  .addArgs('arg1', 'arg2') // to add extra info like executor ID, page number, etc.
  .toString(); // convert it to a string to use it as a custom ID

// add arguments to the custom ID
```

It can be later parsed when handling the component using the `CustomID.parseCustomId` method. Example:

```ts
const customId = CustomID.parseCustomId(interaction.customId);
// this will return an object containing the following:
/* {
      prefix: string,
      suffix: string,
      expiry?: Date,
      args?: string[],
    };
*/
```

## Handling components

To handle components (buttons, selects, modals) create a new method called `handleComponents` or `handleModals` for modals in the command/subcommand class. Then create a decorator for the method using the `@InteractionHandler` decorator with the customId prefix of the components/modals. The method will be called when the component is triggered. Example:

```ts
// you can change the type of `interaction` to ButtonInteraction etc. if you are aware of the type of component
@InteractionHandler('cool_button_')
override async handleComponents(interaction: MessageComponentInteraction) {
  const customId = CustomID.parseCustomId(interaction.customId);
  // handle component logic, same as how it is with collectors
}
```

## Other information

- We use the `interactionCreate` event for handling **all** interactions instead of using collectors.
- If you are using your own bot for testing, make sure to set the CLIENT_ID to your bot's ID in `.env`.

### Tensorflow Errors

Some Windows users face the following problem:

```sh
Error: The specified module could not be found.
\\?\C:\Users\<username>\...otherpathstuff\InterChat\node_modules\@tensorflow\tfjs-node\lib\napi-v8\tfjs_binding.node
```

A simple fix would be to copy `node_modules/@tensorflow/tfjs-node/lib/napi-v9/tensorflow.dll` into `node_modules/@tensorflow/tfjs-node/lib/napi-v8/`. Everything should work fine after that. (just use linux frfr)

## Contributing

Please refer to the [CONTRIBUTING.md](./CONTRIBUTING.md) file for guidelines on how to contribute to this project.
