# ChatBot Changelogs
All notable changes to this project will be documented in this file.

# Beta

## [1.0.0] - 2022-06 -10
### Added
- Added server-leave goal messages
- Delete non-existing channels from DB every 1h
- Add pagination function and update command permission function
- Add end collector and minor bug fixes with setup command
- Added modals to support report command

### Changed
- Changed chatbot activity interval to 5 min
- Updated discord error message ternary
- Changed join goal to 500
- Update connected servers to show 5 servers per embed, added pagination

### Fixed Or Removed
- Fixed Issue with messages sending twice when the bot is kicked from server/channel
- Removed taunt when you send `@everyone `

[1.0.0]: https://github.com/dev-737/ChatBot-Beta/compare/v0.7.0...v0.8.0


## [1.1.0]
### Changed
- Getting bot version directly from package.json
- Pinging @everyone @here doesn't work anymore
- Added profanity filter
- Blacklisted n word
### Planned
- New badges
- Top.gg voting rewards

[1.1.0]: https://github.com/dev-737/ChatBot-Beta/compare/v1.1.0...v1.2.0

[1.2.0]
### Changed

# Stable
## 2.3.0 - 2022-05-21
### Changed 
- The `network` command will be replaced by `/setup` soon™️

### Added
- Added setup
- Updated to v14 of discord.js
- View all connected servers with `/connected`
- Option to clear all guild data from chatbot's database in setup command
- Enabling and disabling embeds for each server is now fully functional
- Sending tenor gifs with chatbot (beta)
- Sending any attachment link with chatbot [.gif |  .png | .webg | .svg ] (beta)
- Turn off embeds in global chat (beta)

### Fixes
- Images should stay longer in the embed when you upload an image directly
- Updated error handlers to stop bot from crashing
- Fixed bug where chatbot crashes when kicked from a server


## 2.3.1 - 2022-05-24
### Changed 
- Reverted back to discord.js v13

