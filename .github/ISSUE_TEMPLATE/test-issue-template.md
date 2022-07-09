---
name: Test issue template
about: Describe this issue template's purpose here.
title: "[TEST]"
labels: duplicate
assignees: ''

---

name: Bug report
description: Report incorrect or unexpected behavior of a package
labels: [bug, need repro]
body:
  - type: markdown
    attributes:
      value: |
        Use Discord for questions: https://discord.gg/djs
  - type: dropdown
    id: package
    attributes:
      label: Which package is this bug report for?
      options:
        - discord.js
        - builders
        - collection
        - rest
        - proxy
        - proxy-container
        - voice
    validations:
      required: true
  - type: textarea
    id: description
    attributes:
      label: Issue description
      description: |
        Describe the issue in as much detail as possible.

        Tip: You can attach images or log files by clicking this area to highlight it and then dragging files into it.
      placeholder: |
        Steps to reproduce with below code sample:
        1. do thing
        2. do thing in Discord client
        3. observe behavior
        4. see error logs below
    validations:
      required: true
  - type: textarea
    id: codesample
    attributes:
      label: Code sample
      description: Include a reproducible, minimal code sample. This will be automatically formatted into code, so no need for backticks.
      render: typescript
      placeholder: |
        Your code sample should be...
        ... Minimal - Use as little code as possible that still produces the same problem (and is understandable)
        ... Complete - Provide all parts someone else needs to reproduce your problem
        ... Reproducible - Test the code you're about to provide to make sure it reproduces the problem
  - type: input
    id: djs-version
    attributes:
      label: Package version
      description: Which version of are you using? Run `npm list <package>` in your project directory and paste the output.
      placeholder: We no longer support version 12 or earlier of discord.js
    validations:
      required: true
  - type: input
    id: node-version
    attributes:
      label: Node.js version
      description: |
        Which version of Node.js are you using? Run `node --version` in your project directory and paste the output.
        If you are using TypeScript, please include its version (`npm list typescript`) as well.
      placeholder: Node.js version 16.9+ is required for version 14.0.0+
    validations:
      required: true
  - type: input
    id: os
    attributes:
      label: Operating system
      description: Which OS does your application run on?
  - type: dropdown
    id: priority
    attributes:
      label: Priority this issue should have
      description: Please be realistic. If you need to elaborate on your reasoning, please use the Issue description field above.
      options:
        - Low (slightly annoying)
        - Medium (should be fixed soon)
        - High (immediate attention needed)
    validations:
      required: true
  - type: dropdown
    id: partials
    attributes:
      label: Which partials do you have configured?
      description: |
        Check your Client constructor for the `partials` key.

        Tip: you can select multiple items
      options:
        - Not applicable (subpackage bug)
        - No Partials
        - User
        - Channel
        - GuildMember
        - Message
        - Reaction
        - GuildScheduledEvent
        - ThreadMember
      multiple: true
    validations:
      required: true
  - type: dropdown
    id: intents
    attributes:
      label: Which gateway intents are you subscribing to?
      description: |
        Check your Client constructor options for the `intents` key.

        Tip: you can select multiple items
      options:
        - Not applicable (subpackage bug)
        - No Intents
        - Guilds
        - GuildMembers
        - GuildBans
        - GuildEmojisAndStickers
        - GuildIntegrations
        - GuildWebhooks
        - GuildInvites
        - GuildVoiceStates
        - GuildPresences
        - GuildMessages
        - GuildMessageReactions
        - GuildMessageTyping
        - DirectMessages
        - DirectMessageReactions
        - DirectMessageTyping
        - MessageContent
        - GuildScheduledEvents
      multiple: true
    validations:
      required: true
  - type: input
    id: dev-release
    attributes:
      label: I have tested this issue on a development release
      placeholder: d23280c (commit hash)
      description: |
        The issue might already be fixed in a development release or main. This is not required, but helps us greatly.
        [discord.js only] To install the latest development release run `npm i discord.js@dev` in your project directory.
        Run `npm list discord.js` and use the last part of the printed information (`d23280c` for `discord.js@xx.x.x-dev.1530234593.d23280c`)
