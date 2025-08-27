# Terms and Conditions

**Effective Date: August 11, 2025**

## 1. Acceptance of Terms

By installing, accessing, or using Vibe Annotations (the "Software"), including the Chrome browser extension and the vibe-annotations-server npm package, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, do not use the Software.

## 2. License Grant

Vibe Annotations is licensed under the MIT License. Subject to your compliance with these terms, you are granted a non-exclusive, worldwide, royalty-free license to use, copy, modify, and distribute the Software in accordance with the MIT License terms.

## 3. Description of Service

Vibe Annotations is a developer tool that:
- Enables visual annotation of local development projects (.local, .test, .localhost, localhost) and local HTML files
- Operates exclusively on local development environments (localhost, 127.0.0.1, 0.0.0.0, *.local, *.test, *.localhost, file://)
- Integrates with AI coding agents via Model Context Protocol (MCP)
- Stores annotation data locally on your machine

## 4. Privacy and Data Collection

### 4.1 Data Storage
- All annotation data is stored locally on your machine in `~/.vibe-annotations/`
- The Chrome extension uses Chrome Storage API for local data persistence
- No data is transmitted to external servers or third parties

### 4.2 Network Communications
- The extension communicates only with your local server (port 3846)
- The server may check NPM registry for version updates (optional)
- No user data, annotations, or code is transmitted externally

### 4.3 Permissions
The Chrome extension requires minimal permissions:
- `activeTab`: To annotate the current webpage
- `storage`: To persist annotations locally
- `scripting`: To inject annotation interface

## 5. Acceptable Use

You agree to use Vibe Annotations only for:
- Legitimate software development purposes
- Annotating your own projects or projects you have permission to modify
- Integration with authorized AI coding agents

You agree NOT to use Vibe Annotations for:
- Unauthorized access to systems or data
- Malicious purposes or security exploitation
- Annotating production websites or third-party services
- Any illegal or harmful activities

## 6. Disclaimer of Warranties

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. THE AUTHORS OR COPYRIGHT HOLDERS SHALL NOT BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY ARISING FROM THE USE OF THE SOFTWARE.

## 7. Limitation of Liability

In no event shall Raphael Regnier, Spellbind Creative Studio, or contributors be liable for any:
- Direct, indirect, incidental, special, or consequential damages
- Loss of data, profits, or business interruption
- Code changes made by AI agents based on annotations
- Issues arising from integration with third-party AI coding tools

Your use of AI coding agents to implement annotation fixes is at your own risk. Always review code changes before committing.

## 8. AI Integration Disclaimer

### 8.1 Third-Party AI Services
Vibe Annotations facilitates integration with AI coding agents (Claude Code, Cursor, Windsurf, etc.) but:
- Does not control or endorse these services
- Is not responsible for AI-generated code quality or accuracy
- Recommends reviewing all AI-implemented changes

### 8.2 Code Responsibility
You remain fully responsible for:
- Code changes implemented based on annotations
- Testing and validating AI-generated fixes
- Maintaining code quality and security standards

## 9. Updates and Modifications

### 9.1 Software Updates
- Chrome extension updates are distributed via Chrome Web Store
- Server package updates are distributed via NPM
- Update notifications are provided but updates are optional
- We reserve the right to modify or discontinue the Software

### 9.2 Terms Updates
We may update these Terms and Conditions. Continued use after changes constitutes acceptance of the new terms.

## 10. Open Source Contributions

By contributing to Vibe Annotations on GitHub, you:
- Grant us a perpetual, worldwide, royalty-free license to use your contributions
- Represent that you have the right to grant such license
- Agree your contributions will be licensed under the MIT License

## 11. Intellectual Property

- Vibe Annotations name and logo are property of Raphael Regnier/Spellbind Creative Studio
- Third-party libraries and dependencies retain their respective licenses
- Your annotation data and code remain your property

## 12. Termination

These terms remain in effect until terminated. You may terminate by uninstalling the Software and deleting all copies. We may terminate your license if you violate these terms.

## 13. Governing Law

These Terms shall be governed by the laws of the jurisdiction in which the copyright holder resides, without regard to conflict of law provisions.

## 14. Severability

If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.

## 15. Contact Information

For questions about these Terms and Conditions:
- GitHub Issues: https://github.com/RaphaelRegnier/vibe-annotations/issues
- Author: Raphael Regnier - Spellbind Creative Studio

## 16. Acknowledgment

By using Vibe Annotations, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.

---

*Last Updated: August 11, 2025*
*Version: 1.0*