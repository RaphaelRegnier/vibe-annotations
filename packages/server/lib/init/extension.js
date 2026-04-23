import * as p from '@clack/prompts';
import open from 'open';

export const CWS_URL =
  'https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof';

export async function runExtensionStep({ interactive }) {
  if (!interactive) {
    p.log.info(`Chrome extension: ${CWS_URL}\n  Install it from the Chrome Web Store if you haven't yet.`);
    return { status: 'link-only' };
  }

  const answer = await p.confirm({
    message: 'Have you already installed the Chrome extension?',
    initialValue: false,
  });

  if (p.isCancel(answer)) {
    return { status: 'skipped' };
  }

  if (answer === true) {
    p.log.success('Extension confirmed');
    return { status: 'confirmed' };
  }

  p.log.info(`Opening the Chrome Web Store...\n  ${CWS_URL}`);
  try {
    await open(CWS_URL);
  } catch {
    p.log.warn('Could not open the browser automatically — open the link above manually.');
  }

  const waited = await p.confirm({
    message: 'Once installed (or if you want to skip), continue?',
    initialValue: true,
  });
  if (p.isCancel(waited) || waited === false) {
    return { status: 'skipped' };
  }
  return { status: 'link-provided' };
}
