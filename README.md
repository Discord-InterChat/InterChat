# ChatBot-Beta

The Canary Version of the growing discord bot named 'ChatBot'
---


### How to Run:
1. Run `npm install`
2. Make a file called `.env` and fill it out with the appropriate contents:
    ```env
    # Bot token here
    TOKEN= 

    # Your mongodb connection string
    MONGODB_URI= # mongodb+srv://<name>:<password>@uri

    # Top.gg token goes here, not required if you don't have a bot on top.gg.
    TOPGG= 

    # Tenor api key (required for posting gifs in global chat.)
    TENOR_KEY=
    ```
3. Run `npm run dev`

If everything was done right, the bot should come online and responsive.

### Todo, Review, Note, and Fixme comments

These are comments to show the state of a piece of code. Install
the "Comment Anchor" extension to highlight them in VS-Code.

1. `TODO` - Something that must be finished before releasing, a reminder.

2. `REVIEW` - Review a piece of code to see if there is a better alternative.

3. `FIXME` - To change later to avoid facing problems, a bug that must be fixed before release.

4. `NOTE` - A note left for later, something important or something that shows how something is supposed to be used/works.

### Goals

* 1000 servers using chatbot
* 101 votes on topgg in a month

### Deploying Commands
> * **Public Commands (Default):** `npm run deploy`
> * **Staff commands:**  `npm run deploy --staff [guildID]`
> * **Help:** `npm run deploy --help`

*[] = optional; <> = required;*

*Note: You can also manually run the file using, `node deploy-commands.js`*


### Commit Messages

Use [semantic commit messages](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716) in your commit messages as it will make auto-releases and changelog updates easier.

[Examples](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716):

> * `feat`: (new feature for the user, not a new feature for build script)
>
> * `fix`: (bug fix for the user, not a fix to a build script)
>
> * `docs`: (changes to the documentation)
>
> * `style`: (formatting, missing semi colons, etc; no production code change)
>
> * `refactor`: (refactoring production code, eg. renaming a variable)
>
> * `test`: (adding missing tests, refactoring tests; no production code change)
>
> * `chore`: (updating grunt tasks etc; no production code change)
