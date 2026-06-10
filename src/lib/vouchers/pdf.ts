// Shared Puppeteer browser launch + HTML-to-PDF conversion

import type { Browser } from 'puppeteer';
import { PRINT_BASE_CSS } from '@/lib/pdf/print-base';

export async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteer = (await import('puppeteer-core')).default;
    chromium.setGraphicsMode = false;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const puppeteer = (await import('puppeteer')).default;
  return puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
}

export interface HtmlToPdfOptions {
  /** Running footer with "Page N of M". Off by default to preserve existing layouts. */
  pageNumbers?: boolean;
  margin?: { top: string; bottom: string; left: string; right: string };
}

export async function htmlToPdf(html: string, options: HtmlToPdfOptions = {}): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    // networkidle0 so remote images are actually loaded before printing;
    // fonts.ready so text never renders in a fallback font on cold starts.
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await page.addStyleTag({ content: PRINT_BASE_CSS });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: options.margin ?? { top: '20px', bottom: options.pageNumbers ? '40px' : '20px', left: '0', right: '0' },
      ...(options.pageNumbers
        ? {
            displayHeaderFooter: true,
            headerTemplate: '<span></span>',
            footerTemplate: `
              <div style="width:100%;font-size:8px;color:#888;text-align:center;padding:4px 0;">
                Page <span class="pageNumber"></span> of <span class="totalPages"></span>
              </div>`,
          }
        : {}),
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
