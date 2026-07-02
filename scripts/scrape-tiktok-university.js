const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = 'f:/tiktok-crm/docs/knowledge-base/TikTok卖家大学';
const BASE_URL = 'https://seller.tiktokshopglobalselling.com';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Store all collected data
const collected = {
  categories: [],
  guides: [],
  rules: [],
  apiUrls: [],
  allContent: []
};

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // Intercept API calls
  page.on('response', async (response) => {
    const url = response.url();
    // Collect API calls that look like content endpoints
    if (url.includes('/api/') || url.includes('university') || url.includes('content') || url.includes('category') || url.includes('article') || url.includes('guide')) {
      if (response.headers()['content-type']?.includes('json')) {
        try {
          const body = await response.json();
          collected.apiUrls.push({ url, hasData: !!body });
          // Save interesting data
          if (body.data || body.list || body.result || body.content) {
            const filename = `api_${Date.now()}_${collected.apiUrls.length}.json`;
            fs.writeFileSync(path.join(OUT_DIR, filename), JSON.stringify({ url, body }, null, 2));
            console.log(`Captured API: ${url} -> ${filename}`);
          }
        } catch (e) { /* ignore non-JSON */ }
      }
    }
  });

  try {
    // Navigate to University page
    console.log('Loading TikTok Shop University...');
    await page.goto(BASE_URL + '/university/home?identity=1&shop_region=us&role=seller', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    // Wait for content to load
    await page.waitForTimeout(8000);

    // Take screenshot
    await page.screenshot({ path: path.join(OUT_DIR, 'university_home.png'), fullPage: true });
    console.log('Screenshot saved');

    // Get page title
    const title = await page.title();
    console.log('Page title:', title);

    // Get all text content
    const pageText = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(OUT_DIR, 'page_content.txt'), pageText.substring(0, 100000));
    console.log('Page text saved, length:', pageText.length);

    // Try to find navigation categories
    const categories = await page.evaluate(() => {
      const cats = [];
      // Look for category/tab elements
      const tabs = document.querySelectorAll('[class*="tab"], [class*="category"], [class*="nav-item"], [class*="menu-item"], nav a, aside a, .sidebar a');
      tabs.forEach(el => {
        const text = el.textContent?.trim();
        const href = el.getAttribute('href') || el.closest('a')?.getAttribute('href');
        if (text && text.length > 1 && text.length < 100) {
          cats.push({ text, href });
        }
      });
      return cats.slice(0, 50);
    });
    console.log('Found categories:', categories.length);

    // Try to find article/guide links
    const links = await page.evaluate(() => {
      const found = [];
      const allLinks = document.querySelectorAll('a[href]');
      allLinks.forEach(a => {
        const href = a.getAttribute('href');
        const text = a.textContent?.trim();
        if (href && text && text.length > 3 && text.length < 200) {
          found.push({ text, href });
        }
      });
      return found.slice(0, 200);
    });
    console.log('Found links:', links.length);

    // Save all collected data
    collected.categories = categories;
    collected.allContent = links;

    // Try to click into each category tab and collect content
    // First, let's see the HTML structure
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync(path.join(OUT_DIR, 'page_source.html'), bodyHTML.substring(0, 500000));
    console.log('Page HTML saved');

    // Try to access known API endpoints for university content
    const possibleAPIs = [
      '/api/university/categories',
      '/api/university/articles',
      '/api/university/guides',
      '/api/university/list',
      '/api/v1/university/categories',
      '/api/v1/university/articles',
      '/university/api/list',
      '/api/oec/university/list',
      '/api/oec/university/categories',
    ];

    for (const api of possibleAPIs) {
      try {
        const resp = await page.evaluate(async (apiUrl) => {
          const res = await fetch('https://seller.tiktokshopglobalselling.com' + apiUrl, {
            headers: { 'accept': 'application/json' }
          });
          return { ok: res.ok, status: res.status, text: await res.text().catch(() => '') };
        }, api);
        console.log(`API ${api}: status=${resp.status}, ok=${resp.ok}`);
        if (resp.ok && resp.text) {
          fs.writeFileSync(path.join(OUT_DIR, `api_probe_${api.replace(/\//g, '_')}.json`), resp.text);
        }
      } catch (e) {
        // ignore
      }
    }

    // Try to access specific known content IDs from the URL
    const knownPaths = [
      `/university/home?identity=1&shop_region=us&content_id=4726346463348496&role=seller`,
      `/university/article?identity=1&shop_region=us&content_id=4726346463348496`,
    ];

    // Try the main seller education domain
    const altDomains = [
      'https://seller.tiktokglobalshop.com',
      'https://seller-us.tiktok.com',
      'https://seller.tiktok.com',
    ];

    for (const domain of altDomains) {
      for (const p of knownPaths) {
        try {
          const newPage = await context.newPage();
          await newPage.goto(domain + p, { waitUntil: 'networkidle', timeout: 15000 });
          await newPage.waitForTimeout(3000);
          const text = await newPage.evaluate(() => document.body.innerText);
          if (text && text.length > 200) {
            const safeName = domain.replace(/https?:\/\//g, '').replace(/[\/:]/g, '_') + '_' + p.replace(/[\/?&=]/g, '_');
            fs.writeFileSync(path.join(OUT_DIR, `${safeName}.txt`), text);
            console.log(`Found content at ${domain}${p}, length: ${text.length}`);
          }
          await newPage.close();
        } catch (e) { /* skip */ }
      }
    }

    console.log('\n=== COLLECTION COMPLETE ===');
    console.log('Categories found:', categories.length);
    console.log('Links found:', links.length);
    console.log('API endpoints captured:', collected.apiUrls.length);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }

  // Collect all URLs that were found
  const urlSummary = collected.apiUrls.map(x => x.url);
  const allFoundURLs = [
    BASE_URL + '/university/home',
    ...categories.map(c => c.href ? (c.href.startsWith('http') ? c.href : BASE_URL + c.href) : '').filter(Boolean),
    ...links.map(l => l.href ? (l.href.startsWith('http') ? l.href : BASE_URL + l.href) : '').filter(Boolean).slice(0, 100),
    ...urlSummary,
  ];
  
  fs.writeFileSync(path.join(OUT_DIR, '_all_urls.json'), JSON.stringify({
    summary: {
      categoriesCount: categories.length,
      linksCount: links.length,
      apiEndpoints: urlSummary.length,
      totalFiles: fs.readdirSync(OUT_DIR).length
    },
    allURLs: allFoundURLs,
    categories: categories,
    sampleLinks: links.slice(0, 50),
    apiUrls: urlSummary
  }, null, 2));
  
  console.log('Files saved to:', OUT_DIR);
  console.log('Total files:', fs.readdirSync(OUT_DIR).length);
}

run().catch(console.error);
