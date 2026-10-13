import Host from '../../lib/content/shadow-host.js';

const first = document.getElementById('first');
const second = document.getElementById('second');
const results = document.getElementById('results');
const tick = () => new Promise((resolve) => requestAnimationFrame(resolve));
let passed = 0;
function check(condition, message) {
  if (!condition) throw new Error(message);
  results.textContent += `\nPASS ${message}`;
  passed++;
}

function addControls(root) {
  const style = document.createElement('style');
  style.textContent = `
    #controls { position: fixed; top: 20px; left: 20px; padding: 16px;
      background: #171717; color: white; pointer-events: auto; border-radius: 8px; }
    input, button { padding: 8px; margin: 4px; }
    :host::backdrop { pointer-events: none; }
  `;
  root.append(style);
  const controls = document.createElement('section');
  controls.id = 'controls';
  controls.innerHTML = '<label>Vibe Test Input <input id="input"></label><button id="action">Test Overlay Click</button><span id="clicked"></span>';
  controls.querySelector('button').onclick = () => {
    controls.querySelector('#clicked').textContent = 'Overlay clicked';
  };
  root.append(controls);
}

document.getElementById('run').onclick = async () => {
  results.textContent = '';
  passed = 0;
  try {
    // Hide the installed extension so the fixture exercises only this source module.
    first.close();
    second.close();
    Host.destroy();
    document.getElementById('vibe-annotations-root')?.style.setProperty('display', 'none');
    first.showModal();
    addControls(Host.init());
    let host = Host.getHost();
    check(host.parentNode === first, 'Initialization inside an existing modal');
    check(!Host.isVisible() && !host.matches(':popover-open'), 'Starts hidden');
    Host.show();
    await tick();
    check(host.matches(':popover-open'), 'Visible overlay occupies the top layer');
    const bounds = host.getBoundingClientRect();
    check(bounds.x === 0 && bounds.y === 0 && bounds.width === innerWidth && bounds.height === innerHeight,
      'Viewport position escapes dialog transforms and clipping');
    const input = Host.getRoot().getElementById('input');
    input.focus();
    check(Host.getRoot().activeElement === input, 'Modal overlay input accepts focus');
    const action = Host.getRoot().getElementById('action');
    const rect = action.getBoundingClientRect();
    check(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === host,
      'Overlay wins hit testing above the modal backdrop');

    second.showModal();
    await tick();
    check(host.parentNode === second && host.matches(':popover-open'), 'Later modal wins despite reversed DOM order');
    second.close();
    await tick();
    check(host.parentNode === first, 'Closing the top modal restores the earlier modal');
    input.focus();
    first.close();
    await tick();
    check(host.parentNode === document.body && !host.hasAttribute('popover'), 'Closing the last modal restores ordinary body rendering');
    input.focus();
    check(Host.getRoot().activeElement === input, 'Input remains focusable after modal closure');

    first.show();
    await tick();
    check(host.parentNode === document.body, 'Non-modal dialogs do not capture the overlay');
    first.close();
    Host.hide();
    first.showModal();
    await tick();
    check(host.parentNode === first && !host.matches(':popover-open'), 'Hidden overlay stays hidden during modal changes');
    Host.show();
    check(host.matches(':popover-open'), 'Showing restores the top-layer overlay');
    first.remove();
    await tick();
    check(host.parentNode === document.body, 'Removing a modal recovers the overlay');
    first.close();
    document.body.append(first);
    Host.destroy();
    check(!host.isConnected && Host.getHost() === null, 'Destroy removes the host');
    first.showModal();
    await tick();
    check(!host.isConnected, 'Disconnected observer does not resurrect the host');
    first.close();

    addControls(Host.init());
    Host.show();
    second.showModal();
    first.showModal();
    await tick();
    host = Host.getHost();
    check(host.parentNode === first, 'Batched openings preserve chronological order');
    first.close();
    second.close();
    await tick();
    first.showModal();
    await tick();
    results.textContent += `\n\n${passed} checks passed. Test the input and button above the dialog.`;
  } catch (error) {
    results.textContent += `\nFAIL ${error.stack}`;
  }
};
