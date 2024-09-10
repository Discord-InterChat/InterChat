# Contributing to InterChat

We welcome contributions to InterChat! Whether you're fixing bugs, adding new features, or improving documentation, your help is appreciated.

## Getting Started

Start by deciding _what_ you’d like to contribute. A good place to begin is by browsing our [Issues](https://github.com/Discord-InterChat/InterChat/issues). Select one that aligns with your interests and skills.
Once you've chosen an issue, make your changes and submit a pull request for review. For more details on this process, refer to [GitHub’s contributing guide](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project).

### Make Changes

Adhere to the project's coding conventions and style guides. If you're unsure, refer to existing code or ask for guidance.

- **Include Tests:** If you're adding new features or fixing bugs, include tests to ensure your changes work as expected and don't break existing functionality. (Ignore this step, for now)
- **Documentation:** Update the README.md and other relevant documentation if your changes affect how the bot is used or deployed.

### Submit Your Changes

- **Push Your Branch:** Push your branch to your forked repository:

  ```sh
  git cz
  git push origin feature/new-feature
  ```

- **Open a Pull Request:** Go to the [original repository](https://github.com/Discord-InterChat/InterChat/pulls) and open a [pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) (PR) from your branch to the main branch. Include a detailed description of your changes and any relevant issues or discussions.

### Code Review

Your pull request will be reviewed by the maintainers. Please be responsive to feedback and ready to make necessary changes. Once approved, your changes will be merged into the main branch.

## Reporting Issues

If you encounter any issues or bugs, please report them by creating a [new issue](https://github.com/Discord-InterChat/InterChat/issues). Provide as much detail as possible, including steps to reproduce the issue and any relevant logs or screenshots.

## Extras

### Commitizen Friendly

To make our lives easier by not having to remember the commit messages at all times, this repository is [commitizen](https://www.npmjs.com/package/commitizen) friendly! Commitizen is a commandline tool that guides you through the process of choosing your desired commit type.

> [!IMPORTANT]
> Make sure to run `npm i commitizen --global` first. It won't work if you haven't.

![commitizen](https://commitizen-tools.github.io/commitizen/images/demo.gif)

Run `git cz` or `cz commit` to easily commit using commitizen.

[Example Commit Messages](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716):

- `feat`: new feature for the user, not a new feature for build script
- `fix`: bug fix for the user, not a fix to a build script
- `docs`: changes to the documentation
- `style`: formatting, missing semi colons, etc; no production code change
- `refactor`: refactoring production code, eg. renaming a variable
- `test`: adding missing tests, refactoring tests; no production code change
- `chore`: updating grunt tasks etc; no production code change

### Special Comments

These are comments to show the state of a piece of code. Install the `Todo Tree` extension to highlight them in VS-Code.

1. `TODO` - Something that must be finished before releasing, a reminder.

2. `REVIEW` - Review a piece of code to see if there is a better alternative.

3. `FIXME` - To change later to avoid facing problems, a bug that must be fixed before release.

4. `NOTE` - A note left for later, something important or something that shows how something is supposed to be used/works.

## Community

Join our [Discord server](https://interchat.fun/support) to connect with other contributors and discuss the project. Please be respectful and follow our community guidelines.

Thank you for contributing to InterChat!
