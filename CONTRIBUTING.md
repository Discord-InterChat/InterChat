# Contributing to InterChat

We welcome contributions to InterChat! Whether you're fixing bugs, adding new features, or improving documentation, your help is appreciated.

## Getting Started

1. **Fork the Repository:** Click on the "Fork" button in the top-right corner of this page.
2. **Clone Your Fork:** Use `git clone` to clone your forked repository to your local machine.
3. **Create a Branch:** It's good practice to create a new branch for each feature or bug fix:

   ```sh
   git checkout -b feature/new-feature
   ```

## Making Changes

- **Follow Coding Standards:** Adhere to the project's coding conventions and style guides. If you're unsure, refer to existing code or ask for guidance.
- **Include Tests:** If you're adding new features or fixing bugs, include tests to ensure your changes work as expected and don't break existing functionality.
- **Documentation:** Update the README.md and other relevant documentation if your changes affect how the bot is used or deployed.

- **Write Clear, Concise Commits:** Each commit should have a clear and concise message explaining what changes were made and why. Use semantic commit messages in your commit messages as it will make auto-releases and changelog updates easier.

  [Examples](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716):

  - `feat`: new feature for the user, not a new feature for build script
  - `fix`: bug fix for the user, not a fix to a build script
  - `docs`: changes to the documentation
  - `style`: formatting, missing semi colons, etc; no production code change
  - `refactor`: refactoring production code, eg. renaming a variable
  - `test`: adding missing tests, refactoring tests; no production code change
  - `chore`: updating grunt tasks etc; no production code change

### Commitizen Friendly

  To make our lives easier by not having to remember the commit messages at all times, this repository is [commitizen](https://www.npmjs.com/package/commitizen) friendly! Commitizen is a commandline tool that guides you through the process of choosing your desired commit type.

  > [!IMPORTANT]
  > Make sure to run `npm i commitizen --global` first. It won't work if you haven't.

  ![commitizen](https://commitizen-tools.github.io/commitizen/images/demo.gif)

  Run `git cz` or `cz commit` to easily commit using commitizen.

## Special Comments

These are comments to show the state of a piece of code. Install the `Todo Tree` extension to highlight them in VS-Code.

1. `TODO` - Something that must be finished before releasing, a reminder.

2. `REVIEW` - Review a piece of code to see if there is a better alternative.

3. `FIXME` - To change later to avoid facing problems, a bug that must be fixed before release.

4. `NOTE` - A note left for later, something important or something that shows how something is supposed to be used/works.

## Submitting Your Changes

- **Push Your Branch:** Push your branch to your forked repository:

  ```sh
  git cz
  git push origin feature/new-feature
  ```

- **Open a Pull Request:** Go to the original repository and open a pull request (PR) from your branch to the main branch. Include a detailed description of your changes and any relevant issues or discussions.

## Code Review

Your pull request will be reviewed by the maintainers. Please be responsive to feedback and ready to make necessary changes. Once approved, your changes will be merged into the main branch.

## Reporting Issues

If you encounter any issues or bugs, please report them by creating a new issue in the GitHub repository. Provide as much detail as possible, including steps to reproduce the issue and any relevant logs or screenshots.

## Community

Join our [Discord server](https://interchat.fun/support) to connect with other contributors and discuss the project. Be respectful and follow the community guidelines.

Thank you for contributing to InterChat!
