# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [3.17.2](https://github.com/Discord-InterChat/InterChat/compare/v3.17.1...v3.17.2) (2024-02-18)


### Bug Fixes

* **hub:** fix hub owner not able to remove a manager ([f8011b3](https://github.com/Discord-InterChat/InterChat/commit/f8011b35aba38ae4faa5e835f50d748df0ee7b42))
* **network:** fix username and content getting swapped ([71c527a](https://github.com/Discord-InterChat/InterChat/commit/71c527a4d6106c15dee75efeb538c734bb613dd7))

### [3.17.1](https://github.com/Discord-interchat/interchat/compare/v3.17.0...v3.17.1) (2024-02-11)


### Bug Fixes

* **commands:** better command cooldown system ([#39](https://github.com/Discord-interchat/interchat/issues/39)) ([31c84e2](https://github.com/Discord-interchat/interchat/commit/31c84e269fa6c4d91d53b57e15d6a2fbf4b472d4))
* fixed botlist stats not getting updated ([8b72383](https://github.com/Discord-interchat/interchat/commit/8b7238361f3732b2f660a55af160bf28e2d040a9))
* **leave:** fix interaction failure with `/hub leave` ([bd086a8](https://github.com/Discord-interchat/interchat/commit/bd086a8de91679cdc275a1c6dbd7798742e0e06e))
* **locale:** fix locale setting problem ([63c87ad](https://github.com/Discord-interchat/interchat/commit/63c87adc3b53728d71b394b745bd56b9b4915f12))
* **locales:** `/set language` doesnt show invalid language anymore ([7400c21](https://github.com/Discord-interchat/interchat/commit/7400c216b7568c57649250c5cbef93071efb1a76))
* **nsfw:** use tfjs-node to speed up tensor conversions & host ai model locally ([47b13d8](https://github.com/Discord-interchat/interchat/commit/47b13d8c81c34fb64201210a2a478bbfaa9bbbc5))
* **reports:** remove server & user reports ([f2a22c1](https://github.com/Discord-interchat/interchat/commit/f2a22c1de17e1ae45f3e65f04ccc8331f2f7aaaf))
* **topgg:** Fix error handling in syncBotlistStats task ([39a5d7a](https://github.com/Discord-interchat/interchat/commit/39a5d7a90812926cbd2bab035c135732b88423d3))

## [3.17.0](https://github.com/Discord-interchat/interchat/compare/v3.16.0...v3.17.0) (2024-02-02)


### Features

* Vote annoucements, and storage of topgg votes in db ([aae6882](https://github.com/Discord-interchat/interchat/commit/aae68824c43ce918afdf016cf9f6fb00f42b1ba7))


### Bug Fixes

* fixed deletion of old messages function ([41cff8b](https://github.com/Discord-interchat/interchat/commit/41cff8b5b5c70cfbb97db098bb555f90477fcf1e))
* **goal:** fix bug with server join ([9d09f06](https://github.com/Discord-interchat/interchat/commit/9d09f06999913335859271452e78abe18e7087da))
* improved nsfw image detection capabilities ([7c4ae63](https://github.com/Discord-interchat/interchat/commit/7c4ae63699d24a8cd6c8087f43d83a86d7053739))
* **messageinfo:** remove user card ([b459abe](https://github.com/Discord-interchat/interchat/commit/b459abeea94c964ad82f472ed5b5454d6efca56f))
* **network:** add a 1s wait every 50 sends ([aaa0382](https://github.com/Discord-interchat/interchat/commit/aaa03822c60b6e1786c1224a17990e97df945171))
* **network:** fix message going to ([a9e7a46](https://github.com/Discord-interchat/interchat/commit/a9e7a46aa6756c0fac39c36283eca42761cf08bd))
* **network:** fix ratelimit issue by using different ips for each webhook send ([591c635](https://github.com/Discord-interchat/interchat/commit/591c635b2080eea946774de3f5d2143f5717796e))
* **vote:** update vote role ([495dbb0](https://github.com/Discord-interchat/interchat/commit/495dbb0a50e302c2b9ad0cc6cca253903395e835))

## [3.16.0](https://github.com/Discord-interchat/interchat/compare/v3.15.0...v3.16.0) (2024-01-26)


### Features

* new `/help` and `/credits` command ([578d56a](https://github.com/Discord-interchat/interchat/commit/578d56af46917b54e33ae7aac0bf313111675d91))


### Bug Fixes

* **autocomplete:** fix errors and db vulnerability where users were able to query regex through searches ([1e0d44c](https://github.com/Discord-interchat/interchat/commit/1e0d44c23a76f865afb5419ed25e66b3f18ca885))
* **browse:** fix wrong locale naming ([d65a309](https://github.com/Discord-interchat/interchat/commit/d65a309cf63928e99c2bb8af252b125d546c9f79))
* fix a bugaroo with leave i18n call ([bba519b](https://github.com/Discord-interchat/interchat/commit/bba519b052dddc4c2d6733c314af609c29b4ea0f))
* **hub:** fix bug that preventing leaving hubs ([6169d2d](https://github.com/Discord-interchat/interchat/commit/6169d2d0211970a1f1c1016c6d983b5832160f55))
* **hubLogs:** fix owner retrieval in `JoinLeaveLogger` ([f4d1122](https://github.com/Discord-interchat/interchat/commit/f4d1122db222b72fff82ed5edca787496190b0de))
* **msgInfo/report:** fix attachment URL retrieval ([003e5ae](https://github.com/Discord-interchat/interchat/commit/003e5ae8dac17456ed897edca89548b20b40518b))
* **msgInfo:** changed `reportNotEnabled` error msg to ephemeral ([0d7d5fe](https://github.com/Discord-interchat/interchat/commit/0d7d5feab950db8a351cdc7d58a2bc7c39f73056))
* **msgInfo:** deferring the reply ([ac2e898](https://github.com/Discord-interchat/interchat/commit/ac2e898b2d09ace614c56928d063cf2373f6b353))
* **msgInfo:** fix problem with reporting compact messages ([978ded0](https://github.com/Discord-interchat/interchat/commit/978ded0b4b3f66393cfa61133659352dc82cd6a7))
* **msgs:** fix old messages not getting deleted ([ec99483](https://github.com/Discord-interchat/interchat/commit/ec9948388757ec9c904d8c37cb885c9bbd69bb04))
* **network:** truncate user/server names to 90 chars ([9e1a466](https://github.com/Discord-interchat/interchat/commit/9e1a46678b7b9f7b1e7e266669eba7fa2d5b3377))
* **network:** using webhookclient again ([2dff73d](https://github.com/Discord-interchat/interchat/commit/2dff73dd759c1289619ab0a54a6da8231fb0f35b))
* **reaction:** fix bug with reacting with custom emojis ([46646e1](https://github.com/Discord-interchat/interchat/commit/46646e120f1e48dace034bab02e24764194690d5))
* **stats:** show shards from all clusters ([ac9dc79](https://github.com/Discord-interchat/interchat/commit/ac9dc7921f4d2c6980c676f41778f92ad6012c8b))
* update iconUrl and add EASTER_AVATAR constant ([bb636ff](https://github.com/Discord-interchat/interchat/commit/bb636ffaefd33ca5754685dd4cf71826a0ac8289))
* update support server invite ([355205f](https://github.com/Discord-interchat/interchat/commit/355205f19d353c1c11cf45a9be2e3f20cee608bc))

## [3.15.0](https://github.com/Discord-interchat/interchat/compare/v3.14.0...v3.15.0) (2024-01-06)


### Features

* hub logging, reporting messages, encrypted customIds, join server button ([f0ae9dd](https://github.com/Discord-interchat/interchat/commit/f0ae9ddda5f842d2a2d6be45850a892ec28456ff))
* **network:** prevent accounts that are not newer than 7 days from using interchat ([5bd416d](https://github.com/Discord-interchat/interchat/commit/5bd416d5f1c24f9d4d94bb54fa5c60440d0e1e73))
* search for server using `/hub connections` ([b16b13f](https://github.com/Discord-interchat/interchat/commit/b16b13fdab302770c37ad45f98ea1774854d9031))


### Bug Fixes

* add hindi locale ([719d06b](https://github.com/Discord-interchat/interchat/commit/719d06b93745d4ad9eb6b6c6ebefad2847b692e6))
* add shard information to stats command and ([090b6ad](https://github.com/Discord-interchat/interchat/commit/090b6ad3db8d2fa9381d7fb0f3aee9f74d50bd01))
* **blacklist:** fix bug with `Apps > Blacklist` ([30f9d2f](https://github.com/Discord-interchat/interchat/commit/30f9d2fe9fdc2c2c19a2e900d06c767cdcce0e14))
* **connection:** fix bug with channel switch when bot is missing permissions ([6b97b5a](https://github.com/Discord-interchat/interchat/commit/6b97b5a61a3c34bda8d3ae69b0894f373bf2aa63))
* fix `/hub servers` command ([681036a](https://github.com/Discord-interchat/interchat/commit/681036af6c3aad70abb2ce3e95ef76b5296a848b))
* fix hub create not using `CustomID()` ([35c89d7](https://github.com/Discord-interchat/interchat/commit/35c89d73b80d0d069b7d5151015e3389074e1158))
* fix hub settings giving errors ([ef37881](https://github.com/Discord-interchat/interchat/commit/ef37881afdeb85582940fd424787e2e6b2e1a2d7))
* fix issues with /support report for bugs ([a7b5d75](https://github.com/Discord-interchat/interchat/commit/a7b5d75ed066c1414d1b15723a606adcada933d5))
* fixed being able to join private hubs without invite ([822cf58](https://github.com/Discord-interchat/interchat/commit/822cf583e3614000589601c97d0270929b5f7a87))
* **hub leave:** fix permission check ([4bebf93](https://github.com/Discord-interchat/interchat/commit/4bebf9314776b8409bc72273b5e9714b4fbe583c))
* **hub leave:** fix permission check ([0eb2c2d](https://github.com/Discord-interchat/interchat/commit/0eb2c2d248eddae6b56f9e0e14af8c1cbcf0bf1a))
* **hub:** `/hub leave` bug when a server is no longer part of a hub and user clicks leave button it errors ([5afd61a](https://github.com/Discord-interchat/interchat/commit/5afd61a74c53623fd63e6310f0acbd41bc4f35cc))
* **hubDelete:** fix bug where hub delete process takes too long causing interaction failure ([0277123](https://github.com/Discord-interchat/interchat/commit/0277123b6a4a6299a988b1a2a2de9790fb039628))
* **hubInvite:** fix error with `/hub invite create` expiry ([87509fe](https://github.com/Discord-interchat/interchat/commit/87509fe8ea2de16f2bc775a307f2ecd102d938d0))
* **hubLogs:** fixed bug with embed thumbnails when server doesnt have an icon ([4434aee](https://github.com/Discord-interchat/interchat/commit/4434aeee401b62ef40bc1d4f2f94d02097961c87))
* **hubManage:** fix interaction failures when setting banner ([8a4c129](https://github.com/Discord-interchat/interchat/commit/8a4c129e70a62626ed73f28c378627a8ca183ec7))
* localization for hub logs ([373aeca](https://github.com/Discord-interchat/interchat/commit/373aecafb10896ee5ef01e1a9e8ff3504d71983c))
* make crib default hub ([90f92f6](https://github.com/Discord-interchat/interchat/commit/90f92f69aacbd53676a37a537264edf804561643))
* **msgData:** fix bug where original messages cant be deleted from the db ([23f19a8](https://github.com/Discord-interchat/interchat/commit/23f19a809e9fb9d2a97f361a882411b4ade44b40))
* **msgData:** split storing network messages into two collections ([91d51b2](https://github.com/Discord-interchat/interchat/commit/91d51b2e7b1cec5fe5a1d6d62c6c8b057e2ee119))
* **network:** add webhook caching ([e0269b1](https://github.com/Discord-interchat/interchat/commit/e0269b198654fa7d3d4dacd4407b750c6a8527cb))
* **network:** fix bug where bot cant reply about the nsfw warning ([6c8fa20](https://github.com/Discord-interchat/interchat/commit/6c8fa202eb20a0926eef1bfcfd0cd9f7978a67f4))
* **network:** fix errors when tenor url is invalid/doesn't exist ([1770538](https://github.com/Discord-interchat/interchat/commit/1770538cd7245765efc989d7af2b82c07c5d46d5))
* **network:** fix image urls showing in embed ([60e439f](https://github.com/Discord-interchat/interchat/commit/60e439fdb87053d70d00d5424e8b9a979191c8be))
* **network:** fix nickname setting not working on network ([1c0dae1](https://github.com/Discord-interchat/interchat/commit/1c0dae1e44411fae8eff5de247427f19c0b286d4))
* **network:** use discord.js to fetch webhooks instead of webhookclient ([94187f8](https://github.com/Discord-interchat/interchat/commit/94187f847cfb208cfa91ecfcc1b1b56d90386ea5))
* **purge:** fix `/purge server` failing ([57c5753](https://github.com/Discord-interchat/interchat/commit/57c5753b82bb198cded2ac49d381d2c4d8f028df))
* reaction button filtering issue ([9f40fe6](https://github.com/Discord-interchat/interchat/commit/9f40fe6ebc883237e821d5ee30b7efed6ee10639))
* **scheduler:** exit if task to set is a very long timeout ([9b6e30f](https://github.com/Discord-interchat/interchat/commit/9b6e30f11d99a76cb54ebfdaff2dae3838b75f3b))
* Updatei18n  button label for blacklist and fix invisible color hex ([d3c8e69](https://github.com/Discord-interchat/interchat/commit/d3c8e6913996e58c130e992b4db3965b5b6f2292))

## [3.14.0](https://github.com/discord-interchat/interchat/compare/v3.13.0...v3.14.0) (2023-11-22)


### Features

* Add profanity check and guild join/leave ([e01715a](https://github.com/discord-interchat/interchat/commit/e01715a727cba25bbfe4e212708e7ca9e3a6411b))
* blacklist context menu ([#31](https://github.com/discord-interchat/interchat/issues/31)) ([f4b82be](https://github.com/discord-interchat/interchat/commit/f4b82beec5fba3d56b7a1a85e63048789222e8f4))
* **network:** welcome messages for new users ([2cbef70](https://github.com/discord-interchat/interchat/commit/2cbef70aa4ce149c656d0a4c1847d8c5c9374dc8))
* rewrite everything from scratch, use classes, decorators etc ([#34](https://github.com/discord-interchat/interchat/issues/34)) ([c99434c](https://github.com/discord-interchat/interchat/commit/c99434c0ee8e2f0b4e15d998baca34cc2b7bb941))
* **stats:** shard stats ([db42bda](https://github.com/discord-interchat/interchat/commit/db42bdacaa0025757f4dd0b13fbc56d488afeed7))
* **translate:** translate Network messages ([03a349a](https://github.com/discord-interchat/interchat/commit/03a349a9ba513460738b6da35e69031e345b8d8b))


### Bug Fixes

* add autocmpletes to /hub blacklist ([#29](https://github.com/discord-interchat/interchat/issues/29)) ([173294c](https://github.com/discord-interchat/interchat/commit/173294c2f353f4624e2dcf2ff2b456200feece21))
* add Content-Type header to ([f394829](https://github.com/discord-interchat/interchat/commit/f394829a48800d27844c6d1a4451b6a3390fc435))
* Add error embeds to blacklist commands ([69ba090](https://github.com/discord-interchat/interchat/commit/69ba0902d71e16ae70d46ffefedd212caa5c6340))
* Add error handling to Purge command and filter out ([894de8c](https://github.com/discord-interchat/interchat/commit/894de8ccbf3bb1aee513f9acbe19df9b80de247b))
* add presence status and activity to SuperClient, ([137c82a](https://github.com/discord-interchat/interchat/commit/137c82ad155339dfd13f51cac568e741c5d9d16d))
* add shardReady event and fix guildDelete bug ([ff68e43](https://github.com/discord-interchat/interchat/commit/ff68e43aea00215736ab62a656e2e552f7fb0950))
* add translations to vote rewards ([3b388d5](https://github.com/discord-interchat/interchat/commit/3b388d5f5045959aa35b57e77a69de75f4b33981))
* add user mention and ID when deleting message ([2911923](https://github.com/discord-interchat/interchat/commit/29119234cfb03318406ea6ed00925bec25e0da7e))
* **blacklist duration:** Use `hmds`format instead ([4036abd](https://github.com/discord-interchat/interchat/commit/4036abdbf1a505af70a59f60b67d872e5b3cf68b))
* change client status from invisible to idle. ([00b9537](https://github.com/discord-interchat/interchat/commit/00b953756dbe11b54e2d0dc1d9b6f8515ea8fee9))
* **db:** remove caching ([dcef1d5](https://github.com/discord-interchat/interchat/commit/dcef1d598244126af5dd14afdae29e920b4a8e37))
* delete message from threads ([2f11e4a](https://github.com/discord-interchat/interchat/commit/2f11e4a7fc27710ac8fc23153000eadc5a86a8a6))
* fix activity name and state in SuperClient.ts ([ca9268b](https://github.com/discord-interchat/interchat/commit/ca9268b7632f9c3efaff1aa5d09aa7f802449e93))
* fix author name and icon for replies ([fa64d35](https://github.com/discord-interchat/interchat/commit/fa64d35e43ee101fd2bfacd8653775ca36af5029))
* fix bot version and join error message ([91165bf](https://github.com/discord-interchat/interchat/commit/91165bf5dbb801498c7f48e1022c302c9a6cb2f2))
* fix bug with messageInfo ([c19c012](https://github.com/discord-interchat/interchat/commit/c19c0120c331026ea214c5955f20b646bf601563))
* fix bugs with `/hub delete` and reactions ([d3d379b](https://github.com/discord-interchat/interchat/commit/d3d379bdfd5b51f28f85b04c5c239fc6eb4543aa))
* fix deploy script ([eef50d2](https://github.com/discord-interchat/interchat/commit/eef50d23d91b5e414b634c7bc89592f8d367a34f))
* fix error handling in `getOrCreateWebhook` ([0c550ab](https://github.com/discord-interchat/interchat/commit/0c550ab7d6216f874b185b908becd32c2e799140))
* fix formatting in blacklist notifications ([8200ca6](https://github.com/discord-interchat/interchat/commit/8200ca68d4065a12ec1ac20e2242e87f1b763e06))
* fix hub create cooldown error. ([3023b2e](https://github.com/discord-interchat/interchat/commit/3023b2e17084ff6868b8ef00fabf7233c2434598))
* fix hub join permission bugs ([f2a852b](https://github.com/discord-interchat/interchat/commit/f2a852b928ae459453bd0c6812334fdc398aa4e9))
* fix import paths for typings ([9a5f7eb](https://github.com/discord-interchat/interchat/commit/9a5f7ebcb04efc804b9a66f42df6faf11b142835))
* fix invalid connection reply and ([4e0198d](https://github.com/discord-interchat/interchat/commit/4e0198d55401ae7e5f096f6486a74ea7c945d23a))
* fix logChannels update in logging ([80df762](https://github.com/discord-interchat/interchat/commit/80df762777539233424192503238a8a04dea4f9a))
* fix logic in `/connections` for hub ownership ([f756243](https://github.com/discord-interchat/interchat/commit/f7562435d637a862e72e0b83ea6e90ab035a62e9))
* fix message sending issue on bot add ([361f9d2](https://github.com/discord-interchat/interchat/commit/361f9d2e9b0054d5382f9fdbf993c1e047258703))
* fix NSFW detection and allow gif urls ([d7290c8](https://github.com/discord-interchat/interchat/commit/d7290c87bafc73094a0f1d4c54bc38e279843ab3))
* fix rating stars display in browse.ts ([766e3f5](https://github.com/discord-interchat/interchat/commit/766e3f531eb770e20616771b6a6577d23bab5254))
* fix rules embed ([92fd87c](https://github.com/discord-interchat/interchat/commit/92fd87ce063ac008a5e36ba369e379915fc1e143))
* **goal:** use smaller embed for leaves as well ([0582dd6](https://github.com/discord-interchat/interchat/commit/0582dd636c198452f19b2ddaeffd498d241e7a70))
* **help:** Update docs links ([2d8feca](https://github.com/discord-interchat/interchat/commit/2d8feca30ec647149b2b26685618a7fe7cbbaba7))
* **hub leave:** check user's ([bb1fc12](https://github.com/discord-interchat/interchat/commit/bb1fc12d77940a2923e9d1cc1d5f9af516cfa5d6))
* **hub:** disallow names to contain words that discord doesn't like ([798802d](https://github.com/discord-interchat/interchat/commit/798802df1a19ee93d9f7db9742575d41990844da))
* **hub:** disallow non server-mod users being able to join hubs ([546af3c](https://github.com/discord-interchat/interchat/commit/546af3ccaf3ad45abcc0526862e2f04000995630))
* **hub:** fix hub delete mismatch ([42fb193](https://github.com/discord-interchat/interchat/commit/42fb193b50ece17d1d69d8c4b9e56537444fc352))
* **hub:** fix permissions error when joining hub ([8c80fd9](https://github.com/discord-interchat/interchat/commit/8c80fd9b587f273f5ff63a73a5dd34ead197c2f4))
* **hub:** fix unable to cancle leaving hub ([7004d2b](https://github.com/discord-interchat/interchat/commit/7004d2b8c6f3875a4a623e36090eeee262a65fd5))
* improve error messages & add ([f5debbf](https://github.com/discord-interchat/interchat/commit/f5debbf4c83455023f89d53d2f03ceb88f32e5b1))
* **messageInfo:** fix unresponsive report button ([6c2a2a4](https://github.com/discord-interchat/interchat/commit/6c2a2a40815c2d83d6b252a3f35d748fe08fc65e))
* move createConnection to network utils ([71b2ade](https://github.com/discord-interchat/interchat/commit/71b2ade3cc801a4dc45843ba2ef858b0de5b87f8))
* move report channel to forum post ([3dbc5b2](https://github.com/discord-interchat/interchat/commit/3dbc5b247f3a926f784f6f62be767e18348cc041))
* **network:** add caching for fetching connections ([4f05938](https://github.com/discord-interchat/interchat/commit/4f05938849219855a9fa1cc5d09a96997b951a04))
* **network:** embed colors tweak ([4544a47](https://github.com/discord-interchat/interchat/commit/4544a47ccea0c316838563b2669cb8ff892995a4))
* **network:** profanity uncensored in replies ([224f588](https://github.com/discord-interchat/interchat/commit/224f588ee39a8cfeb8bad261241779bc52fc4039))
* **network:** show replies to the bot itself ([a305992](https://github.com/discord-interchat/interchat/commit/a30599243f9ecfd04ddf48c50d0e8fd86670d8b3))
* only send to connected channels in sendToNetwork ([b0cc3e2](https://github.com/discord-interchat/interchat/commit/b0cc3e23f44050b391b0d09d72c67f3467382698))
* **purge:** make purge faster ([99eb1b1](https://github.com/discord-interchat/interchat/commit/99eb1b1a4b77c7f82e89bfac3cf33d205463341f))
* remove tags from hubs ([72b38ad](https://github.com/discord-interchat/interchat/commit/72b38adafc3dcd76f63db21246b8e2921356e9f7))
* Remove unused imports and simplify user notif ([3cfbbf5](https://github.com/discord-interchat/interchat/commit/3cfbbf545b47524e6f50cb5b4cb311fa83fd484c))
* **translate:** fix translate vote link ([54916bb](https://github.com/discord-interchat/interchat/commit/54916bb6ee63790f237dbde6ed18dbf6f3818b42))
* update `/vote` command ([3f9831e](https://github.com/discord-interchat/interchat/commit/3f9831eb02806dede22c7c274fa58f6487163f8f))
* update delete message command ([5aca056](https://github.com/discord-interchat/interchat/commit/5aca0567a47995fa45c12514f15188d88e7689fd))
* update editMsg command to use promises ([ff966d5](https://github.com/discord-interchat/interchat/commit/ff966d5e7a25346a15da71fdbf3209d18d5fff95))
* update log channelIds ([c265720](https://github.com/discord-interchat/interchat/commit/c265720540718bd5b14175a2b02d6c8b34fa4724))
* update message format and wording in goal and ([751c2dd](https://github.com/discord-interchat/interchat/commit/751c2dd77c9e71271dd43b45a8b7dcfd1cf17e11))
* update rules ([065829c](https://github.com/discord-interchat/interchat/commit/065829cc261234361cf4acf643eecd1793d9fd4d))
* use embeds for hub error message ([9d16133](https://github.com/discord-interchat/interchat/commit/9d161334ab753a46b51fc9953571ef8c1ea5981c))
* username now includes guild name in network ([fd24a72](https://github.com/discord-interchat/interchat/commit/fd24a72fbaf556c3817df5f1524c7d5087750643))

## [3.13.0](https://github.com/discord-interchat/interchat/compare/v3.12.0...v3.13.0) (2023-09-16)


### Features

* `/vote` command to view voting perks ([#25](https://github.com/discord-interchat/interchat/issues/25)) ([a51591d](https://github.com/discord-interchat/interchat/commit/a51591dd06ce834a64a859fb33fc4c803a144783))
* **hub:** hub settings ([#26](https://github.com/discord-interchat/interchat/issues/26)) ([cf1f08a](https://github.com/discord-interchat/interchat/commit/cf1f08a119c89b2fb2d11c80598f4bb7aa96df1f))
* **hub:** option to use server nicknames as network username ([#23](https://github.com/discord-interchat/interchat/issues/23)) ([79cc583](https://github.com/discord-interchat/interchat/commit/79cc5838f7c08fd019305fb1f175c0d657ff4455))
* join hubs through `/hub browse` ([#28](https://github.com/discord-interchat/interchat/issues/28)) ([495a4c9](https://github.com/discord-interchat/interchat/commit/495a4c970d213be60c1bc31bd64aae8add825a4c))
* make some /hub manage buttons into commands ([83d219d](https://github.com/discord-interchat/interchat/commit/83d219d5e7d6dfb1577ea074e61ae6782116a1f8))
* message reactions (WIP) ([#21](https://github.com/discord-interchat/interchat/issues/21)) ([485104a](https://github.com/discord-interchat/interchat/commit/485104a4db181e8774d71de1d8941972adca3ea7))
* **network:** embed colors ([#27](https://github.com/discord-interchat/interchat/issues/27)) ([69aaacc](https://github.com/discord-interchat/interchat/commit/69aaacc3aed420227459378060de58aa6a4d1277))


### Bug Fixes

* **antispam:** fixed spam detection bug ([#24](https://github.com/discord-interchat/interchat/issues/24)) ([58485a3](https://github.com/discord-interchat/interchat/commit/58485a368f3d63469d2a763afbc14966d87565c6))
* **attachments:** use existing attachment for images ([bc58fb2](https://github.com/discord-interchat/interchat/commit/bc58fb2cf56f15096814c9577ae573f96f2bde4e))
* **deleteMsg:** allow hub owner to delete messages ([17e3b99](https://github.com/discord-interchat/interchat/commit/17e3b99b916de5ac4d0e9dd70c7eea6881c7e0ef))
* **hub manage:** dont fetch messages ([284b98a](https://github.com/discord-interchat/interchat/commit/284b98a5ecd5abe835228bda8513eadc88ed1ccc))
* **hub:** add back bullet points to settings cmd ([dac0431](https://github.com/discord-interchat/interchat/commit/dac043176fd39fb9a11651b13b90525e4f921459))
* message edit fix ([88a46a1](https://github.com/discord-interchat/interchat/commit/88a46a183d30cb9f7900213cc63d0a57b0cfc449))
* **network:** display embed color for all connections ([bc047f6](https://github.com/discord-interchat/interchat/commit/bc047f6964944d43244ee4cc16526855a187dc6f))
* only use secondary buttons for messageinfo ([caf38ef](https://github.com/discord-interchat/interchat/commit/caf38efa38374e98d5ad8b55b9cb8553c4921572))
* **reactions:** fix reactions not working in threads ([69e4f7a](https://github.com/discord-interchat/interchat/commit/69e4f7a3a4bb6d529c513c8be7473d70beed539a))
* run message delete timer every 1h ([8b95980](https://github.com/discord-interchat/interchat/commit/8b9598080517db813692690d4b26ec433a6e372f))
* update guide/docs links ([3283231](https://github.com/discord-interchat/interchat/commit/328323147f56b770784945624655e0d3a7a8e553))

## [3.12.0](https://github.com/discord-interchat/interchat/compare/v3.11.1...v3.12.0) (2023-09-02)


### Features

* **network:** thread and forum post support ([#19](https://github.com/discord-interchat/interchat/issues/19)) ([f5296c0](https://github.com/discord-interchat/interchat/commit/f5296c01c63dc46f2f59bee2db3e336cf1e451a8))
* new messageInfo context menu ([acf7f85](https://github.com/discord-interchat/interchat/commit/acf7f85c4c24e2517bb2c5aee65a210c42465530))
* Use hub name for non-compact webhook usernames ([#20](https://github.com/discord-interchat/interchat/issues/20)) ([c3ea336](https://github.com/discord-interchat/interchat/commit/c3ea3368f9ce9c9e66509160a5bd9fee31ce33c0))


### Bug Fixes

* fix editing message in threads ([647fbf1](https://github.com/discord-interchat/interchat/commit/647fbf1abe6292fbb37ed7d2147faa6f1e357f93))
* **network:** limit editing network to channel's server ([4c352a7](https://github.com/discord-interchat/interchat/commit/4c352a76ff7688f680d3a1fa38cde805b0592d05))
* **network:** restrict hub mods can use `/network manage` ([03d3991](https://github.com/discord-interchat/interchat/commit/03d39911f4f2ba7ddb65275b00cf52b9ba657797))
* **network:** send to only connected networks ([b01b415](https://github.com/discord-interchat/interchat/commit/b01b415bc42828eabf2769ce572af0376d0c33c8))
* remove unnecessary user fetch ([26c4af0](https://github.com/discord-interchat/interchat/commit/26c4af0eb10e8aed488032787dadea6326d6baf0))
* **username:** Removed the use of discriminators ([9226a73](https://github.com/discord-interchat/interchat/commit/9226a734ee8a960b5b7f942d0dd95383ea037b83))

### [3.11.1](https://github.com/Discord-InterChat/InterChat/compare/v3.11.0...v3.11.1) (2023-07-12)


### Bug Fixes

* Create hub leave file ([1170a27](https://github.com/Discord-InterChat/InterChat/commit/1170a2717b54e78e8f3cbed10ae6833c83cdcbad))
* fixed bug that allowed rating greater than 5 ([0ad47c1](https://github.com/Discord-InterChat/InterChat/commit/0ad47c176211c9968e8da5a67f8eb24babf38972))
* **hub join:** fix "invalid connection" bug ([9231925](https://github.com/Discord-InterChat/InterChat/commit/9231925413de072c34325e602c14f5abeabc1853))
* **hub:** banners and icons must all be `i.imgur.com` urls now ([#18](https://github.com/Discord-InterChat/InterChat/issues/18)) ([455073c](https://github.com/Discord-InterChat/InterChat/commit/455073c53d99ad38a885e77e98c537620ebd004e))
* **hubs:** Hub delete command instead ([45b9c67](https://github.com/Discord-InterChat/InterChat/commit/45b9c67b95c78aff7cb30ca4a364088c79aa5bac))
* **hub:** simpler embed in subcommand `joined` ([#17](https://github.com/Discord-InterChat/InterChat/issues/17)) ([05f27be](https://github.com/Discord-InterChat/InterChat/commit/05f27bee9f865539bde8f8ffb27bbfcab0497161))
* **hubs:** Possible fix for unresponsive buttons ([1332387](https://github.com/Discord-InterChat/InterChat/commit/1332387e8dacc2644e33b8aff80451dd74875648))
* minor log fixes ([44d79d1](https://github.com/Discord-InterChat/InterChat/commit/44d79d11e453da20a14c341c68efafa498fce5b6))
* **network:** allow sending only attachments ([faaebfa](https://github.com/Discord-InterChat/InterChat/commit/faaebfac5bdd6093e9809a36d7ce2f4bab7f6b90))
* **network:** Deprecate non-webhook messages ([#15](https://github.com/Discord-InterChat/InterChat/issues/15)) ([6c3de66](https://github.com/Discord-InterChat/InterChat/commit/6c3de6664b519e8e3afddccf67d138fe638227fc))
* **network:** fix mass disconnection issue ([d106419](https://github.com/Discord-InterChat/InterChat/commit/d106419836b8dc07ecf8e3a003e61b6d466d91e2))
* **network:** removed blacklist check ([97799a1](https://github.com/Discord-InterChat/InterChat/commit/97799a1f4c0ab16b4e7e686ac278411bad1b1734))
* **purge:** Messages will be purged from hub in invoked channel ([ee530a2](https://github.com/Discord-InterChat/InterChat/commit/ee530a2ad09cc03f3da3d5a8e4adcc0293061345))
* remove announce command ([8c12073](https://github.com/Discord-InterChat/InterChat/commit/8c12073b0d85851ffdabc769e8180c457f8bb10f))
* remove old non-webhooks network code ([6df3928](https://github.com/Discord-InterChat/InterChat/commit/6df39288a0d042b8b8af8ea90b9a1272f4dd8058))
* Removed jump button from compact messages ([4e3ac06](https://github.com/Discord-InterChat/InterChat/commit/4e3ac063005f731321bdca155bd622b26aa3d3a2))
* Update on-join DM message embed ([2fd0423](https://github.com/Discord-InterChat/InterChat/commit/2fd0423e01af1ad065ee16e88e12f2ec8f8eae12))

## [3.11.0](https://github.com/Discord-InterChat/InterChat/compare/v3.10.3...v3.11.0) (2023-05-24)


### Features

* command cooldowns ([b9ab7ef](https://github.com/Discord-InterChat/InterChat/commit/b9ab7ef3e8ca50fa565df788b3e5e35ab78f5982))
* **hub:** allow hub mods to delete network messages ([baf37f3](https://github.com/Discord-InterChat/InterChat/commit/baf37f3d7946ec19ec66de4ea83f3d205a148f7c))
* Hubs ([#14](https://github.com/Discord-InterChat/InterChat/issues/14)) ([675a4fd](https://github.com/Discord-InterChat/InterChat/commit/675a4fdd7e5ee2366ee2a768e6105a155273e4b5))


### Bug Fixes

* disabled warn command ([8715b9f](https://github.com/Discord-InterChat/InterChat/commit/8715b9f602432ef600fcacc679494044d16bc514))
* fixed bugs with `/hub joined` ([2359ea3](https://github.com/Discord-InterChat/InterChat/commit/2359ea3ede055add037bc400ee60dacf0d659563))
* **hub:** hub delete hotfix ([af8c45e](https://github.com/Discord-InterChat/InterChat/commit/af8c45efadbe7b0d2cf929334956ae6077565305))
* **hub:** limit invite creation to private hubs ([5046aa2](https://github.com/Discord-InterChat/InterChat/commit/5046aa29f4fb4a694390758d27e1fad452611e3a))
* **hubs:** disable starter hubs for now ([ad3093f](https://github.com/Discord-InterChat/InterChat/commit/ad3093f4cf90552b1f9a5f29048c11913dd30b95))
* Moved `/network delete` to `/hub leave` ([c2002ad](https://github.com/Discord-InterChat/InterChat/commit/c2002ada552d94bd6cf195278c72db96b1d794a1))

### [3.10.3](https://github.com/Discord-InterChat/Interchat/compare/v3.10.2...v3.10.3) (2023-05-09)


### Bug Fixes

* new rules ([09004b3](https://github.com/Discord-InterChat/Interchat/commit/09004b36097e40339c4e4c548230217ab5321e2a))

### [3.10.2](https://github.com/Discord-InterChat/Interchat/compare/v3.10.1...v3.10.2) (2023-04-30)


### Bug Fixes

* **blacklist:** fix errors when user is removed from blacklist before timer ends ([6f9b698](https://github.com/Discord-InterChat/Interchat/commit/6f9b6984339cc988f9ad6b1df8cb3d435416814b))
* **blacklist:** reply now contains embeds ([eef5822](https://github.com/Discord-InterChat/Interchat/commit/eef582295f32ef62c1ad60230d995f75fb8c175d))
* **report:** fix bug that created double report posts ([f4eb357](https://github.com/Discord-InterChat/Interchat/commit/f4eb3573e118d6dbb1dde549e68eaaf1e4d1a61b))

### [3.10.1](https://github.com/Discord-InterChat/Interchat/compare/v3.10.0...v3.10.1) (2023-04-30)


### Bug Fixes

* **goal:** Removed join embeds ([7215f64](https://github.com/Discord-InterChat/Interchat/commit/7215f647066e030e487ab7e5a246cf5e0de40995))

## [3.10.0](https://github.com/Discord-InterChat/Interchat/compare/v3.9.0...v3.10.0) (2023-03-23)


### Features

* Anti-Spam System (Beta) ([410b2ea](https://github.com/Discord-InterChat/Interchat/commit/410b2ea558053f1a82ee3852a1590d1493691f74))


### Bug Fixes

*  nobody will ever know ([4408500](https://github.com/Discord-InterChat/Interchat/commit/44085006bc416ba74469a726aa16f00c4046676e))
* **addUserBlacklist:** option to notify user ([e2c120e](https://github.com/Discord-InterChat/Interchat/commit/e2c120eac02ab4915fc23f00f0c2db0761a99f1f))
* Better setup error messages ([fbc5f20](https://github.com/Discord-InterChat/Interchat/commit/fbc5f20e834e256f222a2e041f6f4e532f3f43de))
* Fixed everyone ping bug ([02d91f2](https://github.com/Discord-InterChat/Interchat/commit/02d91f2910d452c95ff6204797fcbe5905f1d014))
* **info:** fixed text overflow ([bc772a8](https://github.com/Discord-InterChat/Interchat/commit/bc772a8147838877eca0af75f6844e0df8b3d5d0))
* **purge:** Fixed bugs ([e64bd8a](https://github.com/Discord-InterChat/Interchat/commit/e64bd8ace118bac468f85148c495d9342b350737))
* **purge:** set 100 maxValue to`limit`option ([06975d5](https://github.com/Discord-InterChat/Interchat/commit/06975d52840501139586a91c111e73833dc37714))

## [3.9.0](https://github.com/Discord-InterChat/Interchat/compare/v3.8.1...v3.9.0) (2023-03-18)


### Features

* Basic network purge command ([0bcb098](https://github.com/Discord-InterChat/Interchat/commit/0bcb0981bcc84ebf82883cd4a3d60fb1faf732f0))
* New help command (very WIP) ([c8d3a3b](https://github.com/Discord-InterChat/Interchat/commit/c8d3a3bfbda9e3e0b6fe7f726cd7a3e0fc0a8c83))
* **purge:** Add `replies` and `after` options ([a1dd0e3](https://github.com/Discord-InterChat/Interchat/commit/a1dd0e390fd124ecbef08dca3523f896d6d68aba))
* **userInfo:** Cool new profile banner image ([a28fd20](https://github.com/Discord-InterChat/Interchat/commit/a28fd20e0d49af44b56923cd2656e70eb0f3992b))


### Bug Fixes

* **announce:** Small tweaks ([abd948d](https://github.com/Discord-InterChat/Interchat/commit/abd948d9fa0ebf8ad52273b39bde878ea9f0ec95))
* Better pagination buttons ([ad5b51b](https://github.com/Discord-InterChat/Interchat/commit/ad5b51b0034433e6c5d92a3c4639124704c8dd93))
* embeds for warn/blacklist notification ([afc41fa](https://github.com/Discord-InterChat/Interchat/commit/afc41faeb6ca59d78e5d557d7f027da5d94967c3))
* **logs:** added more stuff to modlogs embed ([cc485a3](https://github.com/Discord-InterChat/Interchat/commit/cc485a3c4fedaba88344399f4fe3909bb2363650))
* **msgData:** Changed delete interval to 24h ([326635f](https://github.com/Discord-InterChat/Interchat/commit/326635f43a2ae024fb9aa1de780a03f6bd89b3c4))
* **network:** 1000 charecter message limit & only allowed gif/images in network ([a523b3f](https://github.com/Discord-InterChat/Interchat/commit/a523b3fbf501b0d7b7418a7d0be63db4a799b423))
* **network:** Disallowed user mentions ([57d0c25](https://github.com/Discord-InterChat/Interchat/commit/57d0c25b77ae8b757f4190b6ef2f9370ba9b0bfd))
* **network:** Webhook disabling hotfix ([fc8acfd](https://github.com/Discord-InterChat/Interchat/commit/fc8acfd48818e0838081004127f081002bb3a126))
* New look for info command ([695c44a](https://github.com/Discord-InterChat/Interchat/commit/695c44aac47f17380b0f90646e41ef30616013e9))
* **report:** Fixed typo ([84022ae](https://github.com/Discord-InterChat/Interchat/commit/84022aeeb2b4060decd56bf3511ae337dbb76a6c))
* **stats:** Reverted embed style to original ([064b975](https://github.com/Discord-InterChat/Interchat/commit/064b9758f6a12306383d8bd3131c659689392856))
* Updated credits ([eb06f40](https://github.com/Discord-InterChat/Interchat/commit/eb06f408e0d1b91e122c23bd07fccb690b7db42c))

### [3.8.1](https://github.com/Discord-ChatBot/Discord-ChatBot/compare/v3.8.0...v3.8.1) (2023-02-16)


### Bug Fixes

* **goal:** Fixed `undefined` leave messages ([2dadfaa](https://github.com/Discord-ChatBot/Discord-ChatBot/commit/2dadfaa88ea03db59e4a0b3bcd7d98692f795df0))

## [3.8.0](https://github.com/Discord-ChatBot/Discord-ChatBot/compare/v3.7.0...v3.8.0) (2023-02-16)


### Features

* **setup:** onboarding for new setups ([fd731b3](https://github.com/Discord-ChatBot/Discord-ChatBot/commit/fd731b359b7c4ac8611d5c042a95fa85b1e104aa))


### Bug Fixes

* **deletemsg:** fix interaction failure ([567efa7](https://github.com/Discord-ChatBot/Discord-ChatBot/commit/567efa7dd06e0b46aa46819d7c51c618744bfd36))
* Embed webhooks now use ChatBot's avatar ([fb05fbd](https://github.com/Discord-ChatBot/Discord-ChatBot/commit/fb05fbd13e83cc7a2d1e09acbf40aee26b8f31d9))
* fix missing replies in uncensored embed ([9217c67](https://github.com/Discord-ChatBot/Discord-ChatBot/commit/9217c6741a5d9097d19d8fdb38239f41d1ddcd26))
* fixed major bugs | [#10](https://github.com/Discord-ChatBot/Discord-ChatBot/issues/10) ([90feb68](https://github.com/Discord-ChatBot/Discord-ChatBot/commit/90feb68422d53df383fd7dbbfa804352d2087661))
* **network:** fix typo which let unknown channels stay in db ([d66eabc](https://github.com/Discord-ChatBot/Discord-ChatBot/commit/d66eabcd269166145faff9a38c17588c09073a0c))
* **report:** made report commands more user-friendly ([00f0b49](https://github.com/Discord-ChatBot/Discord-ChatBot/commit/00f0b49afbcd5873569687efc28d1904cf3d4679))
* **setup:** fix errors with /setup view ([cedfd29](https://github.com/Discord-ChatBot/Discord-ChatBot/commit/cedfd299cab4555aadc976193d35e543ae7b7942))
* **setup:** fix webhooks not updating when channel changed ([c536e98](https://github.com/Discord-ChatBot/Discord-ChatBot/commit/c536e98d3c58ff0fa7e5bbc7290e4f77ebad1cfe))

## [3.7.0](https://github.com/discord-chatbot/discord-chatbot/compare/v3.5.0...v3.7.0) (2023-01-12)


### Features

* **badge:** New christmas badge ([aaeab1b](https://github.com/discord-chatbot/discord-chatbot/commit/aaeab1bdf01ed8dffc73de28342a0ab02c1def24))
* **dev:** announce command to send messages to the network! ([7c2de32](https://github.com/discord-chatbot/discord-chatbot/commit/7c2de327fe9b263148c167b339d8491f369fb599))
* new christmas embed color scheme ([f788c7e](https://github.com/discord-chatbot/discord-chatbot/commit/f788c7e3c9090f78342b3a927f6dc1be790c8621))
* Temp Blacklist ([#110](https://github.com/discord-chatbot/discord-chatbot/issues/110)) ([9c267b0](https://github.com/discord-chatbot/discord-chatbot/commit/9c267b0e340e6bce4cc990ff5368132473231923))
* Warn Command & new dev script ([#9](https://github.com/discord-chatbot/discord-chatbot/issues/9)) ([6caffd9](https://github.com/discord-chatbot/discord-chatbot/commit/6caffd93f8cc22361f9a8a71925878edd1cb5b20))


### Bug Fixes

* **blacklist:** blacklist notified in network channel now ([3a6dbe0](https://github.com/discord-chatbot/discord-chatbot/commit/3a6dbe091173f96f5ec0ed1302f98481abf0632a))
* Christmas badge cannot be claimed anymore ([a3eb291](https://github.com/discord-chatbot/discord-chatbot/commit/a3eb29144dff016a6f456551d697557e297bd428))
* Disabled videos (and broke more stuff) ([080371d](https://github.com/discord-chatbot/discord-chatbot/commit/080371d6092756bd21ca0fab49617ed9fa18b7d2))
* **editMsg:** Vote bypass for staff ([272975f](https://github.com/discord-chatbot/discord-chatbot/commit/272975fc9be3dc34c7e415578dd3dbbda8a0316e))
* **network:** Removed thread, sticker, system message support ([#113](https://github.com/discord-chatbot/discord-chatbot/issues/113)) ([a329ab3](https://github.com/discord-chatbot/discord-chatbot/commit/a329ab376d7f7bd839593540ee0b1cc2c425cd28))
* **setup:** fix issues with erros during webhook setup process ([61a0579](https://github.com/discord-chatbot/discord-chatbot/commit/61a0579e61d16983c924c7abe0fd75ad67868816))
* use sentry for automated error reports ([5826438](https://github.com/discord-chatbot/discord-chatbot/commit/58264383592b4c2efe404f74cd8deaa7098674a4))
* **userinfo:** Fixed issue with displaying badges ([ca903c8](https://github.com/discord-chatbot/discord-chatbot/commit/ca903c8c753603cc308719b3802b23f4b263db7f))
* **warn:** removed arbitrary string acceptance for user option ([a951ac2](https://github.com/discord-chatbot/discord-chatbot/commit/a951ac25bc5627cca02e390156d63fafd8fa1ac9))
* **webhooks:** fixed webhook auto-disabling issue ([e63f163](https://github.com/discord-chatbot/discord-chatbot/commit/e63f163c7ab39ea84c27736c9d049ac859cd36dd))
* **webhooks:** Using user tag instead of username ([3f18111](https://github.com/discord-chatbot/discord-chatbot/commit/3f18111bc9f9754d7be12bc47c7c2e0c421706fe))

## [3.5.0](https://github.com/Discord-ChatBot/ChatBot-Development/compare/v3.4.1...v3.5.0) (2022-12-08)


### Features

* **goal:** added embeds to goal messages ([0a1ab86](https://github.com/Discord-ChatBot/ChatBot-Development/commit/0a1ab8620eaa337c0352a17ae773cb4004e0567c))
* server info context menu ([723f0ed](https://github.com/Discord-ChatBot/ChatBot-Development/commit/723f0ed415d1b7653a62ccf9366ec95de531a482))
* **setup:** new options to set invite and change network channel ([79e8e40](https://github.com/Discord-ChatBot/ChatBot-Development/commit/79e8e40aa1ed6605a090867bddf954b8b8228f05))
* user Info context menu ([067e649](https://github.com/Discord-ChatBot/ChatBot-Development/commit/067e6492ab70e952cadce1d8e4964dc4b3b68fa9))


### Bug Fixes

* **blacklist:** my life is a lie 87180f0 ([0424517](https://github.com/Discord-ChatBot/ChatBot-Development/commit/04245178e65b2f488eca82ceba9d53222029cd2f))
* fix the bug with blacklist list, removed extra command from husky and more idk lmao ([0326735](https://github.com/Discord-ChatBot/ChatBot-Development/commit/0326735fe1dbdad586d6c917717077b17b1dbe03))
* **invite:** added manage server as a required perm to default invite ([e507123](https://github.com/Discord-ChatBot/ChatBot-Development/commit/e50712314e736795ba968e068c5783763aee0928))
* **setup:** fixed select menu becomming unresponsive when webhook is selected ([38219fe](https://github.com/Discord-ChatBot/ChatBot-Development/commit/38219fedbc3431abbbf99b05941f73816a72c684))
* **setup:** guess I was a little careless ([09ebcf3](https://github.com/Discord-ChatBot/ChatBot-Development/commit/09ebcf3b2e3c72d954b5dfcc96529111c0b4d45d))

### [3.4.1](https://github.com/Discord-ChatBot/ChatBot-Beta/compare/v3.4.0...v3.4.1) (2022-12-02)


### Bug Fixes

* **blacklist:** fixed blacklist notifying more than once ([87180f0](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/87180f0bec900ebd7d681c871af98e75c8cba259))
* fixed "no permission" message sending when bot has correct perms ([4c8ebb4](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/4c8ebb40d5f9d0ecc2089506bb7d63e5dcc8f70e))
* **network:** fixed everyone ping working for compact mode ([7751be1](https://github.com/Discord-ChatBot/ChatBot-Beta/commit/7751be1aa8a43e092f3336a45d136cf5eb5c0fb4))

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
