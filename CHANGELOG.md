# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.4.1](https://github.com/dev-737/ChatBot-Beta/compare/v1.5.1...v1.4.1) (2022-07-03)

## [1.4.1](https://github.com/dev-737/ChatBot-Beta/compare/v1.4.0...v1.5.0) (2022-07-03)

### Features

* Add image & review system for suggestions ([a342afb](https://github.com/dev-737/ChatBot-Beta/commit/a342afbed9e6a046e39fb7ce18b0a2060b09ec56))
* Add option for custom emojis in pagination ([c35539f](https://github.com/dev-737/ChatBot-Beta/commit/c35539f14e92a984bc0ddb02bc36793f24021e3b))

### Bug Fixes

* Add dynamic status update + new error message ([132ee2e](https://github.com/dev-737/ChatBot-Beta/commit/132ee2e893f94f948f16673a31d745c5cc8c0605))
* Add icons category to emoji.json ([b1e55f6](https://github.com/dev-737/ChatBot-Beta/commit/b1e55f6bebedc46d44bdd8dc6cb499e08119c8db))

## [1.4.0](https://github.com/dev-737/ChatBot-Beta/compare/v1.3.1...v1.4.0) (2022-06-30)

### Features

* Add find command to get user/server by name ([7a7902a](https://github.com/dev-737/ChatBot-Beta/commit/7a7902abf338cc89f0fb89d593d97e458e51e5b3))

### Bug Fixes

* ChatBot now shows 0 connected ([2776461](https://github.com/dev-737/ChatBot-Beta/commit/27764616480203067ac642f3b6b3824dba03e5ef))
* Disable User option in connected command ([7f30504](https://github.com/dev-737/ChatBot-Beta/commit/7f30504e556919de52896881a4c006f4f5b10497))
* Seperated setup code to multiple script files ([9342aab](https://github.com/dev-737/ChatBot-Beta/commit/9342aab9b64983650bc48adabd6e3f39ef176931))
* Use inbuild discord.js intergration fetch ([f0b0b1d](https://github.com/dev-737/ChatBot-Beta/commit/f0b0b1d11ac33baec33186686c8d1fa5c8c63056))

### [1.3.1](https://github.com/dev-737/ChatBot-Beta/compare/v1.3.0...v1.3.1) (2022-06-28)

## [1.3.0](https://github.com/dev-737/ChatBot-Beta/compare/v1.2.0...v1.3.0) (2022-06-28)

### Features

* Block network for servers with swear names ([13038ee](https://github.com/dev-737/ChatBot-Beta/commit/13038ee6c826e3b1810e5c6fc26f3808ac395c8f))
* Help command now shows perms for command ([fa145e9](https://github.com/dev-737/ChatBot-Beta/commit/fa145e9a1bfbefe976f7e78846f6a5ff1725d147))

### Bug Fixes

* Add admin perm check to staff command ([c30322e](https://github.com/dev-737/ChatBot-Beta/commit/c30322e99859f1826a63d92fb3872deddc092169))
* Add new emojis to join and leave messages ([2eeb2eb](https://github.com/dev-737/ChatBot-Beta/commit/2eeb2eb51fa7d650ce7554b24a91a34f78b79c66))
* Add param for better intellisense ([70064df](https://github.com/dev-737/ChatBot-Beta/commit/70064df7020e48f7aded2b087f901b3947cdfa93))
* Commands now work as normal in DMs ([bb32e99](https://github.com/dev-737/ChatBot-Beta/commit/bb32e99418fec83e1f604ba9d66878b33a3c7cfc))
* disable connect/disconnect command in DM ([deb5d4a](https://github.com/dev-737/ChatBot-Beta/commit/deb5d4a094737bc80135dd070d41583d066dd6f8))
* Disconnect channel if user spams 6+ msgs ([6fd7326](https://github.com/dev-737/ChatBot-Beta/commit/6fd73265ae46d7ad451af3bcd32ef5bd5b98d35f))
* Ignore env ([9b9d36f](https://github.com/dev-737/ChatBot-Beta/commit/9b9d36fcb13c8e1373f3bd71cf509cfb2e027273))
* Limit using setup to users with correct perms ([bb4e6a3](https://github.com/dev-737/ChatBot-Beta/commit/bb4e6a348c2e60658132cd5e267471d6649faabc))
* Remove unused intents to improve performance ([fbf8263](https://github.com/dev-737/ChatBot-Beta/commit/fbf826331e4b2a4cafcbeddb499e7a26ccc1f82d))
* rename changelog to caps ([658f56c](https://github.com/dev-737/ChatBot-Beta/commit/658f56c5bebd35c05d4ab84cc5b5c3483fb70a7f))
* Update credits command ([69e9435](https://github.com/dev-737/ChatBot-Beta/commit/69e9435eb3c2fb90fe4f203b431afd612bbae4a6))

## [1.0.0] - 2022-06 -10

### Added

* Added server-leave goal messages
* Delete non-existing channels from DB every 1h
* Add pagination function and update command permission function
* Add end collector and minor bug fixes with setup command
* Added modals to support report command

### Changed

* Changed chatbot activity interval to 5 min
* Updated discord error message ternary
* Changed join goal to 500
* Update connected servers to show 5 servers per embed, added pagination

### Fixed Or Removed

* Fixed Issue with messages sending twice when the bot is kicked from server/channel
* Removed taunt when you send `@everyone`

[1.0.0]: https://github.com/dev-737/ChatBot-Beta/compare/v0.7.0...v0.8.0

## [1.1.0]

### Changed

* Getting bot version directly from package.json
* Pinging @everyone @here doesn't work anymore
* Added profanity filter
* Blacklisted n word

### Planned

* New badges
* Top.gg voting rewards

[1.1.0]: https://github.com/dev-737/ChatBot-Beta/compare/v1.1.0...v1.2.0

[1.2.0]

### Changed

# Stable

## 2.3.0 - 2022-05-21

### Changed

* The `network` command will be replaced by `/setup` soon™️

### Added

* Added setup
* Updated to v14 of discord.js
* View all connected servers with `/connected`
* Option to clear all guild data from chatbot's database in setup command
* Enabling and disabling embeds for each server is now fully functional
* Sending tenor gifs with chatbot (beta)
* Sending any attachment link with chatbot [.gif |  .png | .webg | .svg ] (beta)
* Turn off embeds in global chat (beta)

### Fixes

* Images should stay longer in the embed when you upload an image directly

* Updated error handlers to stop bot from crashing
* Fixed bug where chatbot crashes when kicked from a server

## 2.3.1 - 2022-05-24

### Changed

* Reverted back to discord.js v13
