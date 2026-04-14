import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function Terms() {
  return (
    <>
      <Navbar />

      <main className="py-[6.5rem]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-lg max-w-none">
            <h1 className="text-[42px] font-[550] text-gray-900 leading-tight tracking-tight mb-8">
              Terms and Conditions
            </h1>
            
            <p className="text-lg text-gray-600 mb-8">
              <strong>Effective Date: August 11, 2025</strong>
            </p>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              1. Acceptance of Terms
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              By installing, accessing, or using Vibe Annotations (the &quot;Software&quot;), including the Chrome browser extension and the vibe-annotations-server npm package, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, do not use the Software.
            </p>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              2. License Grant
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              Vibe Annotations is licensed under the MIT License. Subject to your compliance with these terms, you are granted a non-exclusive, worldwide, royalty-free license to use, copy, modify, and distribute the Software in accordance with the MIT License terms.
            </p>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              3. Description of Service
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Vibe Annotations is a developer tool that:
            </p>
            <ul className="text-lg text-gray-700 leading-relaxed mb-6 list-disc list-inside space-y-2">
              <li>Enables visual annotation of localhost development projects and local HTML files</li>
              <li>Operates exclusively on local development environments (localhost, 127.0.0.1, 0.0.0.0, file://)</li>
              <li>Integrates with AI coding agents via Model Context Protocol (MCP)</li>
              <li>Stores annotation data locally on your machine</li>
            </ul>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              4. Privacy and Data Collection
            </h2>
            
            <h3 className="text-[22px] font-[550] text-gray-900 leading-tight tracking-tight mt-8 mb-4">
              4.1 Data Storage
            </h3>
            <ul className="text-lg text-gray-700 leading-relaxed mb-6 list-disc list-inside space-y-2">
              <li>All annotation data is stored locally on your machine in <code className="bg-gray-100 px-2 py-1 rounded">~/.vibe-annotations/</code></li>
              <li>The Chrome extension uses Chrome Storage API for local data persistence</li>
              <li>No data is transmitted to external servers or third parties</li>
            </ul>

            <h3 className="text-[22px] font-[550] text-gray-900 leading-tight tracking-tight mt-8 mb-4">
              4.2 Network Communications
            </h3>
            <ul className="text-lg text-gray-700 leading-relaxed mb-6 list-disc list-inside space-y-2">
              <li>The extension communicates only with your local server (port 3846)</li>
              <li>The server may check NPM registry for version updates (optional)</li>
              <li>No user data, annotations, or code is transmitted externally</li>
            </ul>

            <h3 className="text-[22px] font-[550] text-gray-900 leading-tight tracking-tight mt-8 mb-4">
              4.3 Permissions
            </h3>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              The Chrome extension requires minimal permissions:
            </p>
            <ul className="text-lg text-gray-700 leading-relaxed mb-6 list-disc list-inside space-y-2">
              <li><code className="bg-gray-100 px-2 py-1 rounded">activeTab</code>: To annotate the current webpage</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">storage</code>: To persist annotations locally</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">scripting</code>: To inject annotation interface</li>
            </ul>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              5. Acceptable Use
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              You agree to use Vibe Annotations only for:
            </p>
            <ul className="text-lg text-gray-700 leading-relaxed mb-6 list-disc list-inside space-y-2">
              <li>Legitimate software development purposes</li>
              <li>Annotating your own projects or projects you have permission to modify</li>
              <li>Integration with authorized AI coding agents</li>
            </ul>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              You agree NOT to use Vibe Annotations for:
            </p>
            <ul className="text-lg text-gray-700 leading-relaxed mb-6 list-disc list-inside space-y-2">
              <li>Unauthorized access to systems or data</li>
              <li>Malicious purposes or security exploitation</li>
              <li>Annotating production websites or third-party services</li>
              <li>Any illegal or harmful activities</li>
            </ul>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              6. Disclaimer of Warranties
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. THE AUTHORS OR COPYRIGHT HOLDERS SHALL NOT BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY ARISING FROM THE USE OF THE SOFTWARE.
            </p>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              7. Limitation of Liability
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              In no event shall Raphael Regnier, Spellbind Creative Studio, or contributors be liable for any:
            </p>
            <ul className="text-lg text-gray-700 leading-relaxed mb-6 list-disc list-inside space-y-2">
              <li>Direct, indirect, incidental, special, or consequential damages</li>
              <li>Loss of data, profits, or business interruption</li>
              <li>Code changes made by AI agents based on annotations</li>
              <li>Issues arising from integration with third-party AI coding tools</li>
            </ul>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              Your use of AI coding agents to implement annotation fixes is at your own risk. Always review code changes before committing.
            </p>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              8. AI Integration Disclaimer
            </h2>
            
            <h3 className="text-[22px] font-[550] text-gray-900 leading-tight tracking-tight mt-8 mb-4">
              8.1 Third-Party AI Services
            </h3>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Vibe Annotations facilitates integration with AI coding agents (Claude Code, Cursor, Windsurf, etc.) but:
            </p>
            <ul className="text-lg text-gray-700 leading-relaxed mb-6 list-disc list-inside space-y-2">
              <li>Does not control or endorse these services</li>
              <li>Is not responsible for AI-generated code quality or accuracy</li>
              <li>Recommends reviewing all AI-implemented changes</li>
            </ul>

            <h3 className="text-[22px] font-[550] text-gray-900 leading-tight tracking-tight mt-8 mb-4">
              8.2 Code Responsibility
            </h3>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              You remain fully responsible for:
            </p>
            <ul className="text-lg text-gray-700 leading-relaxed mb-6 list-disc list-inside space-y-2">
              <li>Code changes implemented based on annotations</li>
              <li>Testing and validating AI-generated fixes</li>
              <li>Maintaining code quality and security standards</li>
            </ul>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              9. Updates and Modifications
            </h2>
            
            <h3 className="text-[22px] font-[550] text-gray-900 leading-tight tracking-tight mt-8 mb-4">
              9.1 Software Updates
            </h3>
            <ul className="text-lg text-gray-700 leading-relaxed mb-6 list-disc list-inside space-y-2">
              <li>Chrome extension updates are distributed via Chrome Web Store</li>
              <li>Server package updates are distributed via NPM</li>
              <li>Update notifications are provided but updates are optional</li>
              <li>We reserve the right to modify or discontinue the Software</li>
            </ul>

            <h3 className="text-[22px] font-[550] text-gray-900 leading-tight tracking-tight mt-8 mb-4">
              9.2 Terms Updates
            </h3>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              We may update these Terms and Conditions. Continued use after changes constitutes acceptance of the new terms.
            </p>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              10. Open Source Contributions
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              By contributing to Vibe Annotations on GitHub, you:
            </p>
            <ul className="text-lg text-gray-700 leading-relaxed mb-6 list-disc list-inside space-y-2">
              <li>Grant us a perpetual, worldwide, royalty-free license to use your contributions</li>
              <li>Represent that you have the right to grant such license</li>
              <li>Agree your contributions will be licensed under the MIT License</li>
            </ul>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              11. Intellectual Property
            </h2>
            <ul className="text-lg text-gray-700 leading-relaxed mb-6 list-disc list-inside space-y-2">
              <li>Vibe Annotations name and logo are property of Raphael Regnier/Spellbind Creative Studio</li>
              <li>Third-party libraries and dependencies retain their respective licenses</li>
              <li>Your annotation data and code remain your property</li>
            </ul>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              12. Termination
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              These terms remain in effect until terminated. You may terminate by uninstalling the Software and deleting all copies. We may terminate your license if you violate these terms.
            </p>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              13. Governing Law
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              These Terms shall be governed by the laws of the jurisdiction in which the copyright holder resides, without regard to conflict of law provisions.
            </p>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              14. Severability
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.
            </p>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              15. Contact Information
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              For questions about these Terms and Conditions:
            </p>
            <ul className="text-lg text-gray-700 leading-relaxed mb-6 list-disc list-inside space-y-2">
              <li>GitHub Issues: <a href="https://github.com/RaphaelRegnier/vibe-annotations/issues" className="text-red-600 hover:text-red-700 underline" target="_blank" rel="noopener noreferrer">https://github.com/RaphaelRegnier/vibe-annotations/issues</a></li>
              <li>Author: Raphael Regnier - Spellbind Creative Studio</li>
            </ul>

            <h2 className="text-[28px] font-[550] text-gray-900 leading-tight tracking-tight mt-12 mb-6">
              16. Acknowledgment
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              By using Vibe Annotations, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
            </p>

            <hr className="my-12 border-gray-200" />

            <p className="text-base text-gray-500 text-center">
              <em>Last Updated: August 11, 2025</em><br />
              <em>Version: 1.0</em>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}