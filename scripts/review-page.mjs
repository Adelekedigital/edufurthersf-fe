import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir, writeFile } from 'node:fs/promises'

const url = process.env.REVIEW_URL ?? 'http://127.0.0.1:3000/'
const outputDir = 'artifacts/page-review'
await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch()
const report = { url, desktop: {}, mobile: {}, errors: [], failedRequests: [], blockedExternalRequests: [] }
const expectedExternal = ['fonts.googleapis.com', 'edufurthersf-be-dev.up.railway.app']
const isExpectedExternal = (value) => expectedExternal.some((host) => value.includes(host))

for (const viewport of [{ name: 'narrow', width: 320, height: 800 }, { name: 'mobile', width: 390, height: 844 }, { name: 'small-tablet', width: 540, height: 900 }, { name: 'tablet', width: 768, height: 1000 }, { name: 'tablet-wide', width: 834, height: 1000 }, { name: 'laptop', width: 1024, height: 900 }, { name: 'desktop', width: 1440, height: 1000 }]) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.__reviewLcp = null
    new PerformanceObserver((list) => { window.__reviewLcp = list.getEntries().at(-1)?.startTime ?? window.__reviewLcp }).observe({ type: 'largest-contentful-paint', buffered: true })
  })
  page.on('console', (message) => { if (message.type() === 'error' && !isExpectedExternal(message.text()) && !message.text().includes('ERR_NETWORK_ACCESS_DENIED')) report.errors.push(`${viewport.name}: ${message.text()}`) })
  page.on('requestfailed', (request) => {
    const detail = `${viewport.name}: ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`
    ;(isExpectedExternal(request.url()) ? report.blockedExternalRequests : report.failedRequests).push(detail)
  })
  await page.goto(url, { waitUntil: 'networkidle' })
  const metrics = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    overflowingElements: Array.from(document.querySelectorAll('*')).filter((element) => { const box = element.getBoundingClientRect(); return box.right > window.innerWidth + 1 || box.left < -1 }).slice(0, 10).map((element) => ({ tag: element.tagName, className: element.className, right: Math.round(element.getBoundingClientRect().right), left: Math.round(element.getBoundingClientRect().left) })),
    lcp: window.__reviewLcp,
    cls: performance.getEntriesByType('layout-shift').reduce((total, entry) => total + (entry.hadRecentInput ? 0 : entry.value), 0),
    resourceBytes: performance.getEntriesByType('resource').reduce((total, entry) => total + (entry.transferSize || 0), 0),
  }))
  const axe = await new AxeBuilder({ page }).analyze()
  metrics.axeSeriousOrCritical = axe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical').map((violation) => violation.id)
  await page.screenshot({ path: `${outputDir}/${viewport.name}.png`, fullPage: true })
  report[viewport.name] = metrics
  await context.close()
}
await writeFile(`${outputDir}/report.json`, JSON.stringify(report, null, 2))
await browser.close()
console.log(JSON.stringify(report, null, 2))
const strictNetwork = process.env.REVIEW_STRICT_NETWORK === '1'
if (report.errors.length || report.failedRequests.length || Object.values(report).some((viewport) => viewport && viewport.horizontalOverflow) || Object.values(report).some((viewport) => viewport && viewport.overflowingElements?.length) || Object.values(report).some((viewport) => viewport && viewport.axeSeriousOrCritical?.length) || (strictNetwork && report.blockedExternalRequests.length)) process.exitCode = 1
