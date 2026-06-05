import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import 'dotenv/config';

const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY,
});

export async function rankTracker(keyword, targetDomain) {
    let browser;
    try {
        const session = await bb.sessions.create({ 
            browserSettings: { blockAds: true },
            timeout: 300 // 5 minutes session timeout
        });

        browser = await chromium.connectOverCDP(session.connectUrl);
        const page = browser.contexts()[0].pages()[0];
        page.setDefaultNavigationTimeout(45000);
        
        // Add error handling for detached frames
        page.on('framedetached', (frame) => {
            console.log('Frame detached:', frame.url());
        });

        await page.goto("https://www.google.com", { waitUntil: "domcontentloaded", timeout: 30000 });
        
        // Handle consent popup
        try {
            const btn = await page.$('button[id="L2AGLb"], form[action*="consent"] button');
            if (btn) {
                await btn.click();
                await page.waitForTimeout(1500);
            }
        } catch (error) {
            // Consent popup might not appear
        }

        let found = null;
        let allResults = [];
        const cleanTarget = targetDomain.replace("www.", "").toLowerCase();

        for (let gPage = 0; gPage < 5; gPage++) {
            let pageResults = [];
            let success = false;
            
            for (let retry = 0; retry < 3 && !success; retry++) {
                try {
                    // Check if page is still valid before navigating
                    if (page.isClosed()) {
                        throw new Error('Page was closed');
                    }
                    
                    // Navigate to search results
                    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&start=${gPage * 10}&num=10&hl=en&gl=us`;
                    
                    await page.goto(searchUrl, { 
                        waitUntil: "domcontentloaded", 
                        timeout: 30000 
                    });
                    
                    // Check if we're blocked
                    const isBlocked = await page.evaluate(() => {
                        const bodyText = document.body?.innerText || "";
                        return bodyText.includes("unusual traffic") || 
                               bodyText.includes("captcha") || 
                               document.querySelector('form#captcha-form') !== null;
                    }).catch(() => true); // If evaluation fails, assume blocked
                    
                    if (isBlocked) {
                        console.warn(`Google blocked on page ${gPage + 1}, retry ${retry + 1}`);
                        await page.waitForTimeout(5000);
                        continue;
                    }
                    
                    // Wait for results with a more reliable selector
                    await page.waitForSelector('h3, div.g, div[data-sokoban-container]', { 
                        timeout: 10000 
                    });
                    
                    await page.waitForTimeout(1500);
                    
                    // Scroll to load lazy content
                    await page.evaluate(() => window.scrollBy(0, 600));
                    await page.waitForTimeout(1000);
                    
                    // Extract results
                    pageResults = await page.evaluate(() => {
                        const results = [];
                        const containers = document.querySelectorAll('div.g, div[data-sokoban-container], div[data-hveid][data-ved]');
                        
                        containers.forEach((item) => {
                            const a = item.querySelector('a[href^="http"]:not([href*="google.com"]):not([href*="google.co"])');
                            const h3 = item.querySelector('h3');
                            if (!a || !h3) return;
                            
                            let hostname = "";
                            try {
                                hostname = new URL(a.href).hostname.replace("www.", "").toLowerCase();
                            } catch (_) {
                                return;
                            }
                            
                            const snippetEl = item.querySelector('[data-sncf="1"]') ||
                                              item.querySelector('.VwiC3b') ||
                                              item.querySelector('[style="-webkit-line-clamp:2"]');
                            
                            const snippet = (snippetEl?.innerText || "").trim().substring(0, 300);
                            
                            results.push({
                                url: a.href,
                                domain: hostname,
                                title: h3.innerText.trim(),
                                snippet,
                            });
                        });
                        
                        return results;
                    });
                    
                    console.log(`Page ${gPage + 1}, retry ${retry + 1}: found ${pageResults.length} results`);
                    
                    if (pageResults.length > 0) {
                        success = true;
                        break;
                    }
                    
                } catch (err) {
                    console.warn(`Retry ${retry + 1} failed on page ${gPage + 1}:`, err.message);
                    
                    // Don't try to reload if page might be detached
                    if (err.message.includes('detached') || err.message.includes('closed')) {
                        console.error('Page frame detached or closed, cannot continue');
                        break;
                    }
                    
                    // Only attempt reload if page is still valid
                    if (retry < 2 && !page.isClosed()) {
                        try {
                            await page.waitForTimeout(2000);
                            // Instead of reloading, we'll let the loop retry with a fresh navigation
                        } catch (reloadErr) {
                            console.warn('Could not recover from error');
                        }
                    }
                }
            }
            
            if (!success || pageResults.length === 0) {
                console.warn(`No results on page ${gPage + 1}, stopping.`);
                break;
            }
            
            // Process results
            for (const r of pageResults) {
                r.position = allResults.length + 1;
                allResults.push(r);
                if (!found && (r.domain.includes(cleanTarget) || cleanTarget.includes(r.domain))) {
                    found = { ...r, page: gPage + 1 };
                }
            }
            
            if (found) break;
            
            // Random delay between pages
            await page.waitForTimeout(3000 + Math.random() * 3000);
        }
        
        await browser.close();
        
        const competitors = allResults
            .filter((r) => !r.domain.includes(cleanTarget) && !cleanTarget.includes(r.domain))
            .slice(0, 10);
        
        return {
            success: true,
            data: {
                keyword,
                targetDomain,
                position: found?.position || null,
                page: found?.page || null,
                title: found?.title || null,
                snippet: found?.snippet || null,
                competitors,
                totalResultsScanned: allResults.length,
            },
        };
        
    } catch (error) {
        console.error("Rank Tracker Error:", error.message);
        if (browser) {
            try {
                await browser.close();
            } catch (closeErr) {
                console.error('Error closing browser:', closeErr.message);
            }
        }
        return { success: false, error: error.message };
    }
}


