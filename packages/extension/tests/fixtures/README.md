# Native modal regression fixture

From the repository root, serve the source files:

```sh
python3 -m http.server 5189 --bind 127.0.0.1
```

Open `http://127.0.0.1:5189/packages/extension/tests/fixtures/native-modal.html`
in Chrome. Disable inspection mode in any installed Vibe extension or close
its toolbar first, so it does not consume the fixture's initial button click.
Click **Run Regression Checks**. The fixture imports the actual shadow-host
module and exercises native dialog/popover behavior, not a mocked DOM.

Expected: the results report **17 checks passed**, with a modal left open.
The checks cover existing-modal initialization, initial hidden state, top-layer
rendering, viewport geometry with a transformed/clipped dialog, focus and hit
testing, reverse DOM opening order, close/removal recovery, non-modal dialogs,
hide/show, observer teardown, reinitialization, and batched dialog openings.

Then type in **Vibe Test Input**, click **Test Overlay Click**, and click
**Page Dialog Button**. All three must work without dismissing the modal.
Reload to reset the fixture. These are browser regression checks, separate
from the Node test suite; they do not run from `node --test`.

This fixture validates the document-level native modal host. It does not
validate framework focus traps, iframe injection, shadow-root dialogs, or
ordering/light dismissal of arbitrary application popovers.
