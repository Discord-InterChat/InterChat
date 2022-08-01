# ChatBot-Beta

## Todo, Review, Note, and Fixme comments

These are comments to show the state of a piece of code. Install
the "Comment Anchor" extension to highlight them in VS-Code.

1. `TODO` - Something that must be finished before releasing, a reminder.

2. `REVIEW` - Review a piece of code to see if there is a better alternative.

3. `FIXME` - To change later to avoid facing problems, a bug that must be fixed before release.

4. `NOTE` - A note left for later, something important or something that shows how something is supposed to be used/works.

### Goals

* 1000 servers using chatbot
* 101 votes on topgg in a month

## Road Maps

### Network

* [ ] Ability to edit/delete messages
* [ ] Premium features using topgg as the subscription site
* [ ] Private networks
* [ ] Leveling system that gives perks as one uses the chat network more
* [ ] New earnable badges
* [ ] Level Badges

### Moderation

* [ ] Better profanity filter
* [ ] A way to detect inappropriate images
* [ ] A way for Moderators to delete Chat messages in every server
* [ ] A way for Server Owners & Admins to delete messages sent by their server members.

### Documentation

* [ ] A full documentation on gitbook instead of a gist
* [ ] New web dashboard for the bot
* [-] Privacy Policy & Terms Of Service page
* [-] Updated rules for better moderation of the bot

## Deploying Commands

* **Deploy Public Commands (Default):** `npm run deploy`

* **Staff commands that are only available in ChatBot HQ:**  `npm run deploy --staff [guildID]`

* **Help Command:** `npm run deploy --help`

*Note: You can also manually run the file using, `node deploy-commands.js`*

## Commit Messages

Use [semantic commit messages](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716) in your commit messages as it will make auto-releases and changelog updates easier.

[Examples](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716):

> * `feat`: (new feature for the user, not a new feature for build script)
>
> * `fix`: (bug fix for the user, not a fix to a build script)
>
> * `docs`: (changes to the documentation)
`style`: (formatting, missing semi colons, etc; no production code change)
>
> * `refactor`: (refactoring production code, eg. renaming a variable)
>
> * `test`: (adding missing tests, refactoring tests; no production code change)
>
> * `chore`: (updating grunt tasks etc; no production code change)
