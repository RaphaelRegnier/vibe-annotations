# Contributing to Vibe Annotations

First off, thank you for considering contributing to Vibe Annotations! It's people like you that make Vibe Annotations such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by the [Vibe Annotations Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* Use a clear and descriptive title
* Describe the exact steps which reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed after following the steps
* Explain which behavior you expected to see instead and why
* Include screenshots if possible
* Include your environment details (OS, browser version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* Use a clear and descriptive title
* Provide a step-by-step description of the suggested enhancement
* Provide specific examples to demonstrate the steps
* Describe the current behavior and explain which behavior you expected to see instead
* Explain why this enhancement would be useful

### Your First Code Contribution

Unsure where to begin contributing? You can start by looking through these issues:

* Issues labeled `good first issue` - issues which should only require a few lines of code
* Issues labeled `help wanted` - issues which should be a bit more involved than beginner issues

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code follows the existing code style
5. Issue that pull request!

## Development Process

### Project Structure

```
vibe-annotations/
├── extension/          # Chrome extension source code
├── annotations-server/ # MCP server (npm package)
├── docs/              # Documentation
└── README.md          # Main documentation
```

### Extension Development

1. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked"
   - Select the `extension/` directory

2. Make your changes
3. Reload the extension to test

### Server Development

1. Navigate to `annotations-server/`
2. Install dependencies: `npm install`
3. Run in development: `node bin/cli.js start`
4. Test your changes

### Code Style

* Use 2 spaces for indentation
* Use meaningful variable names
* Comment your code where necessary
* Follow the existing code style

### Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

## Publishing

### Extension Publishing

The Chrome extension is published to the Chrome Web Store by maintainers only.

### Server Publishing

The server is published as an npm package from the separate repository:
https://github.com/RaphaelRegnier/vibe-annotations-server

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

Thank you for contributing! 🎉