# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [3.4.0](https://github.com/Discord-ChatBot/ChatBot-Beta/compare/v3.3.2...v3.4.0) (2022-11-21)


### Features

* Logging System for Network ([#99](https://github.com/Discord-ChatBot/ChatBot-Beta/issues/99)) ([2976e6f](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/2976e6f034ec632fa65212ba77f17faa4b2c85c4))


### Bug Fixes

* **eval:** removed eval ([4c3fd8b](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/4c3fd8bb235fbd572bd271a1d9b841a717ebf9c0))
* **goal:** updated goal to 700 ([422d9e8](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/422d9e8e87334feec387d822579b3cecb38d04e1))
* new custom client class, code refactors & several bug fixes ([7f5f06f](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/7f5f06f7d9279b7be46429ad79bc1a6002ce2a1a))
* **script:** checking before replace is not necessary ([74f889a](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/74f889a95a12ed4cdce320d0c390b1451a05a1e8))
* **script:** force any instead of unknown in fetch v3 ([37b534e](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/37b534e11ad5f1ece44a9d6ec06c1dfd5aa70781))

### [3.3.2](https://github.com/Discord-ChatBot/ChatBot-Beta/compare/v3.3.0...v3.3.2) (2022-11-14)


### Bug Fixes

* **editMsg:** Fixed most bugs, and refactored code ([c1f1dec](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/c1f1dec659384689b78a6defebe61aad2d6a7937))
* Fixed editing replies for webhook removing replied msg ([4bb7e6c](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/4bb7e6c32de6cafe91d69ddfe67d0e343adb0746))
* Fixed issue with sending images without a message ([7ffe7b2](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/7ffe7b252e74474660e689d67a15f2f1cbd17fc4))
* Fixed uncaught rejections flooding error channel ([16878a4](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/16878a4b5c46a3eba5c137d1992ddc843883d9a8))
* New /info and join embeds ([7fe5643](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/7fe5643accb718ad52594e2a17d8cfabe8b24a95))
* Removed anti-spam ([3018345](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/301834549b3b3deb16c42edf52b8eb7fabb2a174))
* **report:** New report embeds ([7cdbcd7](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/7cdbcd712a70be07f1e8cf6cc00909c17c677057))

## [3.3.0](https://github.com/Discord-ChatBot/ChatBot-Beta/compare/v3.2.0...v3.3.0) (2022-11-02)


### Features

* Display youtube thumbnails as image ([19b7c16](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/19b7c168b613b80ff22ac8c61357e3fd650b9828))
* Editing webhook messages ([563a58d](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/563a58d20c26ad74c0fba431b54e94123bde30db))
* **network:** Added webhook support ([743296f](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/743296f8522a4e34fae18b5bbe248e4999c0d776))


### Bug Fixes

* `User ID` context menu now works for compact messages ([abe1e43](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/abe1e4374d0d5a9276cd433b8514d7bf52d32392))
* Fixed direct context menu reports not working ([64b6369](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/64b6369244ce047e33323daa56969e69a6151acb))
* Fixed resetting setup showing cancelled on success ([06a782f](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/06a782fde50c177534588cb8123084fa8f2a0862))
* replies wont overflow from quotes anymore ([11cf21b](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/11cf21b199be542aa175d5affdff6942644f2293))
* Updated perms for staff commands ([54e3f72](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/54e3f724caba8e350f8c49778dca4e714bac06e5))

## [3.1.0](https://github.com/Discord-ChatBot/ChatBot-Beta/compare/v3.1.0-beta...v3.1.0) (2022-10-21)

## [2.0.0](https://github.com/Discord-ChatBot/ChatBot-Beta/compare/v2.0.0-alpha.1...v2.0.0) (2022-10-12)


### Features

* Auto-Complete handler ([229bc83](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/229bc83521ad1464df3a907aaef1fbae855f0c88))
* Basic Error Handler ([1196d46](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/1196d469f194962790b03333c9c6ba2154054a15))
* Better Setup Command ([ebc6532](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/ebc653242e557fba9745a56700bf24a0a5cc63bc))
* **find:** Implemented Autocomplete for find command instead of "Did you mean?" embed ([57cd006](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/57cd006812619e07830ecc70c7d83cacde5c31d7))
* **network:** Add ability to quote (reply) to messages ([753a79c](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/753a79cd1c3840933c0c0fef344af1d3cbeb745d))
* **network:** Added `NetworkManager ` class ([782f3a4](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/782f3a4e0883a2f816da898cbba57dc5f1c95f93))
* **network:** ChatBot staff now have 12h to delete messages ([1a0001e](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/1a0001e0930fd74633b8675ce51d95d645eaab8c))
* **suggest:** Using Forum channel for suggestions ([80cc8fe](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/80cc8fe728c932c0a1a4a08de72786e25487eafd))


### Bug Fixes

* **anti-spam:** Anti-Spam is now testing ready ([ee4f3ee](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/ee4f3ee3f7f48b2065f6795e47eb73f24f712656))
* **anti-spam:** Updated anti-spam ([83f0005](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/83f0005b63d83350ee7fba5cc9be336d89dc889c))
* **find:** Update command permissions ([fb4f296](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/fb4f2965e9749a0c43d5d5622c06c1a22c5683c3))
* Fixed issues with replying to messages in the network ([b48ad37](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/b48ad37de44ebec7bba8ec2dfc47a49c9ec285b9))
* Fixed rejections not showing stack in error handler ([4c99ee3](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/4c99ee35a14707e0908f38992b1f434301e2ea8b))
* **guide:** Update link to new guide ([14fbce9](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/14fbce9d9b6d1158d31cd239ac6137f652357376))
* **network:** Updated checks for better optimization ([a8aa41a](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/a8aa41a9e6e6651dadcef785ad02738e38b45ef6))
* **report:** Bug reports no longer go to report channel ([2147d62](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/2147d62d66ee5146bb37ab7a7b2899ee0f558cda))
* **suggest:** Archiving posts fixed for `takedown` ([4ff543f](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/4ff543fb4b2b7b29714dcfaaf4639523349f8362))

## [2.0.0-alpha.1](https://github.com/Discord-ChatBot/ChatBot-Beta/compare/v2.0.0-alpha...v2.0.0) (2022-09-26)


### Features

* **network:** Setup and Network code overhaul ([d6d6194](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/d6d619498a82b0152a1113827a47ba8b67952261))
* **release:** ChatBot-Beta v2.0.0-alpha ([fc6561f](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/fc6561fa257e35f036eaedb5db79b58fbd0533a8))


### Bug Fixes

* **anti-profanity:** Added more whitelisted workds ([e7fe4d5](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/e7fe4d5a99f7428f6cf3f5d174c515148e8f83b6))
* **setup:** Fix bugs and add blacklist check ([989c355](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/989c3554fa4efb2729ce1cc933fa171ec9abc4fd))
* **setup:** Setup refactor and optimizations ([1252275](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/125227533de8827645f959f3cfa0154edf88b1bf))

## [2.0.0-alpha](https://github.com/Discord-ChatBot/ChatBot-Beta/compare/v1.9.0...v2.1.0) (2022-09-10)


### Features

* **core:** Codebase rewrite to TypeScript 🎉 ([#66](https://github.com/Discord-ChatBot/ChatBot-Beta/issues/66)) ([dfaee5d](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/dfaee5d848164d4d2e25d1088302e03b6f74ee01))

### [1.7.7](https://github.com/dev-737/ChatBot-Beta/compare/v1.7.6...v1.7.7) (2022-08-13)


### Bug Fixes

* **devMode:** Only manual deploy allowed now ([12ad177](https://github.com/dev-737/ChatBot-Beta/commit/12ad177ca586b00d706045347cd7d7adaed89859))
* **server:** Fixed `disconnect` command disconnecting wrong server ([e4dcc57](https://github.com/dev-737/ChatBot-Beta/commit/e4dcc57ec2fc6837a5a4902536efa7db696d866d))
* **find:** Fixed bug when multiple servers have same name

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
