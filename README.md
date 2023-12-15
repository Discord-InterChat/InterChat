<p align="center"><img src="https://i.imgur.com/MZiw1Yp.png" alt="interchat logo" width="150px"/></p>

<p align="center"><strong>InterChat</strong></p>

This repo contains the source code for the InterChat Discord bot. InterChat is a Discord bot that allows you to chat with users from other servers.

# Getting Started

## Prerequisites

1. [Node.js v18.0.0](https://nodejs.org/en/download/current/), or higher for linux users
2. [Git](https://git-scm.com/downloads)
3. [MongoDB](https://www.mongodb.com/try/download/community)
4. [NPM](https://www.npmjs.com/get-npm) or [Yarn](https://yarnpkg.com/getting-started/install) (we are using npm in this guide)
5. [An Imgur API Key](https://api.imgur.com/oauth2/addclient) (optional, for setting hub icon and banner)
6. [Python 2.7](https://www.python.org/downloads/release/python-2718/) & [Visual Studio Build Tools (Windows Only)](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2019) (for the API)

## Running the code

1. Clone the repository using `git clone` or download the zip file.
2. Create a file called `.env` and fill it out with the appropriate contents mentioned in the env.example file.
3. Install dependencies using `npm install` or `yarn`
4. Build the code using `npm run build`
5. Register commands for your bot using `npm run register:commands --public` & `npm run register:commands --private`
6. Finally run the code using `npm run dev`, or `npm start` to run in production mode

## Database Setup

1. Create a MongoDB instance on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Copy the database connection string and paste it in the `.env` file as `MONGODB_URI`

## Creating Commands

To add a new command, follow these steps:

1. Create a new file in the `src/commands` directory with the command's name.
2. In this file, export a **default** class that extends the `BaseCommand` class from `src/commands/BaseCommand.ts`.
3. The class should include:
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

To help with handling components, we have a custom ID class that can be used to create custom IDs for components. To create a custom ID, simply call the `CustomID` method with the custom ID prefix and the custom postfix. Example:

```ts
const customId = new CustomID()
.setIdentifier('cool_button_')
.setPostfix('1')
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
      postfix: string,
      expiry: Date,
      args?: string[],
    };
*/
```

## Handling components

To handle components (buttons, selects, modals) create a new method called `handleComponents` or `handleModals` for modals in the command/subcommand class. Then create a decorator for the method using the `@InteractionHandler` decorator with the customId prefix of the components/modals. The method will be called when the component is triggered. Example:

```ts
// you can change the type of `interaction` to ButtonInteraction etc. if you are aware of the type of component
@InteractionHandler('cool_button_')
public async handleComponents(interaction: MessageComponentInteraction) { 
  const customId = CustomID.parseCustomId(interaction.customId);
  // handle component logic, same as how its with collectors
}
```

## Other information

- Events are located in `src/InterChat.ts`.
- Commands are loaded automatically by calling the `loadCommandFiles` method from `src/managers/CommandManager.ts` during the bot startup.
- The `src/commands/BaseCommand.ts` file contains all the methods/properties that can be used in a command.
- We use the `interactionCreate` event for handling **all** interactions instead of using collectors.
- If you are using your own bot for testing, make sure to change the CLIENT_ID in `src/utils/Constants.ts` like so:

  ```ts
  export const CLIENT_ID = isDevBuild ? '<new_client_id_here>' : '769921109209907241';
  ```

## Contributing

### Commit Messages

Use semantic commit messages in your commit messages as it will make auto-releases and changelog updates easier.

[Examples](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716):

- `feat`: (new feature for the user, not a new feature for build script)

- `fix`: (bug fix for the user, not a fix to a build script)

- `docs`: (changes to the documentation)

- `style`: (formatting, missing semi colons, etc; no production code change)

- `refactor`: (refactoring production code, eg. renaming a variable)

- `test`: (adding missing tests, refactoring tests; no production code change)

- `chore`: (updating grunt tasks etc; no production code change)

To make our lives easier by not having to remember the commit messages at all times, this repository is [commitizen](https://www.npmjs.com/package/commitizen) friendly! Commitizen is a commandline tool that guides you through the process of choosing your desired commit type.

> [!IMPORTANT]
> Make sure to run `npm i commitizen --global` first. It won't work if you haven't.

![commitizen](https://commitizen-tools.github.io/commitizen/images/demo.gif)

Run `git cz` or `cz commit` to commit using commitizen.

### Special Comments

These are comments to show the state of a piece of code. Install
the "Todo Tree" extension to highlight them in VS-Code.

1. `TODO` - Something that must be finished before releasing, a reminder.

2. `REVIEW` - Review a piece of code to see if there is a better alternative.

3. `FIXME` - To change later to avoid facing problems, a bug that must be fixed before release.

4. `NOTE` - A note left for later, something important or something that shows how something is supposed to be used/works.
