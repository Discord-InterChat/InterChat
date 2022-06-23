# ChatBot-Beta

## TODO, REVIEW, NOTE, and FIXME comments:
1. `TODO` - Something that must be finished before releasing, a reminder.

2. `REVIEW` - Review a piece of code to see if there is a better alternative.

3. `FIXME` - To change later to avoid facing problems, a bug that must be fixed before release.

4. `NOTE` - A note left for later, something important or something that shows how something is supposed to be used/works.


# Goals
* 1000 servers using chatbot
* 101 votes on topgg in a month


# Plans

## Network
- [ ] Ability to edit/delete messages
- [ ] Premium features using topgg as the subscription site
- [ ] Private networks
- [ ] Leveling system that gives perks as one uses the chat network more
- [ ] New earnable badges
- [ ] Level Badges

## Moderation
- [ ] Better profanity filter
- [ ] A way to detect inappropriate images
- [ ] A way for Moderators to delete Chat messages in every server
- [ ] A way for Server Owners & Admins to delete messages sent by their server members.

## Documentation
- [ ] A full documentation on gitbook instead of a gist
- [ ] New web dashboard for the bot
- [ ] Privacy Policy & Terms Of Service page
- [ ] Updated rules for better moderation of the bot


## How to Deploy Slash Commands:
### Normal way:
```node deploy-commands.js -a```

### Cool way:
For this to work you will have to run a few commands before.
Works for both Windows and Linux.

#### Windows Setup:
1. Run `npm link`
3. Finally run `deploy` in the terminal!

#### Linux Setup:
1. Run `chmod +x deploy-commands.js` (optional)
2. Run `sudo npm link`
3. Finally run `deploy` in the terminal!

*Note: To view the help command run, `deploy --help`*

---

### Usage: 

#### 
#### Deploy Public Commands (Default):
```
deploy
```

#### Staff commands that are only available in ChatBot HQ:
```
deploy --private
```
#### Private *and* normal commands:
```
deploy --all
```

