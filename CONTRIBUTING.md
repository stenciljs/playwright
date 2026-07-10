# Contributing

Thanks for your interest in contributing to Stencil Playwright! :tada:

## Contributing Etiquette

Please see our [Contributor Code of Conduct](https://github.com/ionic-team/stencil-playwright/blob/main/CODE_OF_CONDUCT.md) for information on our rules of conduct.

## Reporting a Bug

- If you have a question about using Stencil Playwright, please ask in the [Stencil Discord server](https://chat.stenciljs.com).

- It is required that you clearly describe the steps necessary to reproduce the issue you are running into. Although we would love to help our users as much as possible, diagnosing issues without clear reproduction steps is extremely time-consuming and simply not sustainable.

- The issue list of this repository is exclusively for bug reports and feature requests. Non-conforming issues will be closed immediately.

- Issues with no clear steps to reproduce will not be triaged.

- If you think you have found a bug, please start by making sure it hasn't already been [reported](https://github.com/ionic-team/stencil-playwright/issues?utf8=%E2%9C%93&q=is%3Aissue). You can search through existing issues to see if there is a similar one reported. Include closed issues as it may have been closed with a solution.

  - If a bug report already exists, please upvote it using the :+1: reaction on the GitHub Issue summary. The team is currently unable to track "+1" style comments on the issue.

- Next, [create a new issue](https://github.com/ionic-team/stenci-playwright/issues/new) that thoroughly explains the problem.
  - Please fill out the issue form in full before submitting.
  - Please only include one bug per issue.

## Requesting a Feature

- If you have a question about using Stencil Playwright, please ask in the [Stencil Discord server](https://chat.stenciljs.com).

- Before requesting a feature, please start by making sure it hasn't already been [proposed](https://github.com/ionic-team/stencil-playwright/issues?utf8=%E2%9C%93&q=is%3Aissue). You can search through existing GitHub issues to see if there is a similar feature request has been reported. Include closed feature requests, as it may have been closed already.

  - If a feature request already exists, please upvote it using the :+1: reaction on the GitHub Issue summary. The team is currently unable to track "+1" style comments on the issue.

- Next, [create a new feature request](https://github.com/ionic-team/stencil/issues/new?assignees=&labels=&projects=&template=feature_request.yml&title=feat%3A+) that thoroughly explains the feature request.
  - Please fill out the feature request form in full before submitting.
  - Please only include one feature request per report.

## Creating a Pull Request

- We appreciate you taking the time to contribute! Before submitting a pull request, we ask that you please [create an issue](#creating-an-issue) that explains the bug or feature request and let us know that you plan on creating a pull request for it. If an issue already exists, please comment on that issue letting us know you would like to submit a pull request for it. This helps us to keep track of the pull request and make sure there isn't duplicated effort.

### Setup

1. Fork the repo.
2. Clone your fork.
3. Make a branch for your change.
4. Stencil Playwright uses [volta](https://volta.sh) to manage its Node version, and [pnpm](https://pnpm.io) as
   its package manager. [Install volta](https://docs.volta.sh/guide/getting-started) before proceeding.
   1. There's no need to install a specific version of Node right now, it shall be done automatically for you in
      the next step. pnpm itself is resolved automatically via [Corepack](https://nodejs.org/api/corepack.html)
      from the `packageManager` field in `package.json` (run `corepack enable` once if you haven't already).
5. Run `pnpm install`

### Updates

1. Unit test. Unit test. Unit test. Please take a look at how other unit tests are written, and you can't write too many tests.
2. If there is a `*.spec.ts` file located in the `test/` folder, update it to include a test for your change, if needed. If this file doesn't exist, please notify us.
3. First run `pnpm run build`. Then run `pnpm run test` to make sure all tests are working, regardless if a test was added.

### Testing Changes Against a Project Locally

#### Testing with `pnpm link`:

Using `pnpm link` is beneficial to the development cycle in that consecutive builds of Stencil Playwright are immediately available in your project, without any additional install steps needed:

1. In the directory of _Stencil Playwright_:
   1. Run `pnpm run build`
   2. Run `pnpm link --global`
2. In the directory of _your stencil project_:
   1. Run `pnpm link --global @stencil/playwright`

You can then test your changes against your own Stencil project.

Afterwards, to clean up:

1. In the directory of _your stencil project_:
   1. Run `pnpm unlink @stencil/playwright`
2. In the directory of _Stencil Playwright_, run `pnpm unlink --global`

#### Testing with `pnpm pack`:

There are some cases where `pnpm link` may fall short. For instance, when upgrading a minimum/recommended package version where the package in question has changed its typings. Rather than updating `paths` in your project's `tsconfig.json` file, it may be easier to create a tarball of the project and install in manually.

1. In the directory of _Stencil Playwright_:
   1. Run `pnpm run build`
   2. Run `pnpm pack`. This will create a tarball with the name `stencil-playwright-<VERSION>.tgz`
2. In the directory of _your stencil project_:
   1. Run `pnpm add --save-dev <PATH_TO_STENCIL_PLAYWRIGHT_REPO_ON_DISK>/stencil-playwright-<VERSION>.tgz`.

Note that this method of testing is far more laborious than using `pnpm link`, and requires every step to be repeated following a change to the Stencil core source.

Afterwards, to clean up:

1. In the directory of your Stencil project, run `pnpm add --save-dev @stencil/playwright@<VERSION>` for the `<VERSION>` of Stencil core that was installed in your project prior to testing.

### Commit Message Format

We strive to adhere to a consistent commit message format that is consistent with the
[Angular variant of Conventional Commits](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular),
with a few exceptions.

This enables:

- Anyone to easily understand _what_ a commit does without reading the change itself
- The history of changes to the project to be reviewed easily using tools such as `git log`
- Automated tooling to be developed for important, if mundane tasks (e.g. change log generation)

#### Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests
- **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation
- **revert**: Reverts a previous commit

#### Scope

The scope can be anything specifying place of the commit change. For example `page`, `utils`, `matchers`, etc.

#### Subject

The subject contains succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- do not capitalize first letter
- do not place a period `.` at the end
- entire length of the subject must not go over 50 characters
- describe what the commit does, not what issue it relates to or fixes
- **be brief, yet descriptive** - we should have a good understanding of what the commit does by reading the subject

#### Footer

If a pull request fixes an open GitHub issue, `fixes: #` + the issue number should be included in the footer.

Members of the Stencil engineering team should take care to add the JIRA ticket associated with a PR in the footer of
the git commit. Community members need not worry about adding a footer.

If your pull request contains a _breaking change_, please add the text 'BREAKING CHANGE:' followed by a brief
description. This description will be used in Stencil's auto-generated changelog under the `BREAKING CHANGES` section.
This syntax must be used over the 'exclamation' syntax that other projects using conventional commits may follow.

### Adding & Updating Documentation

Please see the [stencil-site](https://github.com/ionic-team/stencil-site) repo to update documentation.

## License

By contributing your code to the ionic-team/stencil GitHub Repository, you agree to license your contribution under the MIT license.
