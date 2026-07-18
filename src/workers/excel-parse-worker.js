/**
 * Isolated Excel parse worker (child process).
 * Uses exceljs (SheetJS/xlsx removed — no unfixed high CVE in tree for workbooks).
 */

import { parseWorkbookBuffer } from '../lib/parse.js';

process.on('message', async (msg) => {
  try {
    if (!msg || msg.type !== 'parse') {
      process.send?.({ ok: false, error: 'bad message' });
      return;
    }
    const buffer = Buffer.from(msg.bufferBase64 || '', 'base64');
    const filename = String(msg.filename || 'upload.xlsx');
    const rows = await parseWorkbookBuffer(buffer, filename);
    process.send?.({ ok: true, rows });
  } catch (e) {
    process.send?.({
      ok: false,
      error: e instanceof Error ? e.message : 'Excel worker failed',
    });
  }
});
