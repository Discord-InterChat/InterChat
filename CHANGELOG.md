# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.7.6](https://github.com/dev-737/ChatBot-Beta/compare/v1.8.0...v1.7.6) (2022-08-11)


### Bug Fixes

* **azure:** Ignore `.git` folder to save space during production ([7d5d824](https://github.com/dev-737/ChatBot-Beta/commit/7d5d824b801ab7baee457d7817ec5abb3073f35c))
* **goal:** Disabled mentions in goal messages ([c649dfb](https://github.com/dev-737/ChatBot-Beta/commit/c649dfb0f17073c0e07f7545189d6be14cdd37e9))
* **support:** Fixed bugs with report command modal ([b42af19](https://github.com/dev-737/ChatBot-Beta/commit/b42af1941b774701cef0d449cc034774ef684a33))

## [1.7.0](https://github.com/dev-737/ChatBot-Beta/compare/v1.6.1...v1.7.0) (2022-08-02)

### Features

* **Experimental** feature that will prevent images from expiring once sent to network ([eb2b813](https://github.com/dev-737/ChatBot-Beta/commit/eb2b8132b578e02a77213accb59ff2b862416c06))
* Added ability to delete messages in network ([30b5135](https://github.com/dev-737/ChatBot-Beta/commit/30b513549dfa460146c7f50bd87626b09e68db28))
* Added ablity to edit message in network (WIP only works for embeds) ([a4b5098](https://github.com/dev-737/ChatBot-Beta/commit/a4b5098c6d2cc576e7e1245330d3429a7e1c7deb))
* Find command now shows more info ([245f0a8](https://github.com/dev-737/ChatBot-Beta/commit/245f0a8b42ce36aff537dc6ef0f5e804c22da196))
* New disconnect command that lets you disconnect a server manually ([0b6b852](https://github.com/dev-737/ChatBot-Beta/commit/0b6b8526f8240c441a4206370c556a39f8545cac))

### Bug Fixes

* Defering the reply just in case ([ec9e4a9](https://github.com/dev-737/ChatBot-Beta/commit/ec9e4a934f0ddae060a4025c6940d4c79837fde6))
* Fixed issues with deploy-commands.js clientID ([ebd4abb](https://github.com/dev-737/ChatBot-Beta/commit/ebd4abbf9f2a21ed72519bec2af69676e243f02a))
* messageTypes function now returns sent values for editing/deleting messages to be possible ([dc4faf7](https://github.com/dev-737/ChatBot-Beta/commit/dc4faf715d0a1e6a9720df8bd7093371e9c1750a))
* Update setup select menu options ([1c8df48](https://github.com/dev-737/ChatBot-Beta/commit/1c8df485f3529d8b01bd6cd9488fb552350846ae))

### [1.6.1](https://github.com/dev-737/ChatBot-Beta/compare/v1.6.0...v1.6.1) (2022-07-31)

## [1.6.0](https://github.com/dev-737/ChatBot-Beta/compare/v1.5.0...v1.6.0) (2022-07-24)

### Features

* Add new functions: `sendInNetwork` & `deleteChannels` ([c709586](https://github.com/dev-737/ChatBot-Beta/commit/c709586043353bd1ef68bce5b1ceb33bc9bed7f4))
* Bot auto-deploys commands to test servers when run in DevMode ([0ba2489](https://github.com/dev-737/ChatBot-Beta/commit/0ba248994ce58d268574bb18cb66a30543e55994))

### Bug Fixes

* Changed deploy-commands.js from executable to normal file ([a9e275d](https://github.com/dev-737/ChatBot-Beta/commit/a9e275dad421025d2fcca057f1ae2198be303e35))
* I forgot `avatarURL()` was a function ([501e11a](https://github.com/dev-737/ChatBot-Beta/commit/501e11a8bfc3262139d73eda417ebc0e900e6cfa))
* Remove anti spam since it makes network slow ([d00f1b2](https://github.com/dev-737/ChatBot-Beta/commit/d00f1b2349267fd4c826099c80165ad5bf331a25))
* **setup:**  Toggle profanity is disabled for now ([4d22ab5](https://github.com/dev-737/ChatBot-Beta/commit/4d22ab5802a4c510f5a25b42c02b5ae1665a85d6))
* Update find command, fix previously known bug ([5e0804f](https://github.com/dev-737/ChatBot-Beta/commit/5e0804f59d9e07740596ced4a269bb8770b56e2f))
* Update other emojis as well... ([ed07e33](https://github.com/dev-737/ChatBot-Beta/commit/ed07e33c8e99c41429b1b32386a4a81864f6748f))

## [1.5.0](https://github.com/dev-737/ChatBot-Beta/compare/v1.4.1...v1.5.0) (2022-07-06)

### Features

* Deploy commands by folder & guild ([a1b83ed](https://github.com/dev-737/ChatBot-Beta/commit/a1b83ed027386d7107dd533d06587d48d37b83e6))

### Bug Fixes

* Add catch so chatbot  leaves guild on error ([7557598](https://github.com/dev-737/ChatBot-Beta/commit/75575980447aec8fec198af5d54a7b72906e3eb1))
* Add new invite link with required permissions ([6813497](https://github.com/dev-737/ChatBot-Beta/commit/6813497a6fe69d9ae59edc0ba3a8fbd2a70eb391))
* Fix bug that didnt allow bug reports to work ([70b2a40](https://github.com/dev-737/ChatBot-Beta/commit/70b2a401dd2c09acd90ae7a3eeaa72d35a20efb8))
* Include Thomas as author ([8fd25c4](https://github.com/dev-737/ChatBot-Beta/commit/8fd25c4ca2a4f942687ce6437d2b8e4e984b5414))
* Perm-check letting normal users use staff cmd ([e8ff189](https://github.com/dev-737/ChatBot-Beta/commit/e8ff1896a318ab041d1b523cb32c1f465d93978d))
* Remove unused option from report options ([3bea30b](https://github.com/dev-737/ChatBot-Beta/commit/3bea30b10b7c4163e2fa3e99001ad229ff4fed30))
* Sending invite links are blocked now ([75dcf15](https://github.com/dev-737/ChatBot-Beta/commit/75dcf151726595ee6ca9580230be85218e4850dd))
* Set component timeout to 30 seconds from 3 ([b965925](https://github.com/dev-737/ChatBot-Beta/commit/b965925391c8bbac5a9e3259aa806a69047ce77f))
* Update credits ([74c7b0f](https://github.com/dev-737/ChatBot-Beta/commit/74c7b0fb29f5851d02cfa0c71ad61e765428ec1e))
* Update guide gist ([df3dde5](https://github.com/dev-737/ChatBot-Beta/commit/df3dde570bdb6489b2e8da6494d6fd3aacb3f955))
* Update rules footer ([d4745ea](https://github.com/dev-737/ChatBot-Beta/commit/d4745ea334be0cdd815e37d1af750442ab227f0f))
* Update setup command description ([94c1093](https://github.com/dev-737/ChatBot-Beta/commit/94c10930f96c04130a00a0fadcd9fd2381aecabf))
* Update setup embed style ([b714bf2](https://github.com/dev-737/ChatBot-Beta/commit/b714bf2dd4d5b203853a0e4c891b85b24bc128ff))

## [1.4.1](https://github.com/dev-737/ChatBot-Beta/compare/v1.4.0...v1.4.1) (2022-07-03)

### Features

* Add image & review system for suggestions ([a342afb](https://github.com/dev-737/ChatBot-Beta/commit/a342afbed9e6a046e39fb7ce18b0a2060b09ec56))
* Add option for custom emojis in pagination ([c35539f](https://github.com/dev-737/ChatBot-Beta/commit/c35539f14e92a984bc0ddb02bc36793f24021e3b))

### Bug Fixes

* Fix join message not showing using setup ([27328f4](https://github.com/dev-737/ChatBot-Beta/commit/27328f49dfb397aba3e5d9dace04e7278446a78d))
* Add dynamic status update + new error message ([132ee2e](https://github.com/dev-737/ChatBot-Beta/commit/132ee2e893f94f948f16673a31d745c5cc8c0605))
* Add icons category to utils/emoji.json ([b1e55f6](https://github.com/dev-737/ChatBot-Beta/commit/b1e55f6bebedc46d44bdd8dc6cb499e08119c8db))

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
