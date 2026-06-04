import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import 'dotenv/config';


const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY,
});


//search google for a keyword and extract ranking results for a target domain.

export async function rankTracker(keyword, targetDomain) {
    let browser;
    try {

        const session = await bb.sessions.create({ browserSettings: { blockAds: true }});

        browser = await chromium.connectOverCDP(session.connectUrl);
        const page = browser.contexts()[0].pages()[0];
        page.setDefaultNavigationTimeout(45000);

        await page.goto("https://www.google.com", { waitUntil: "domcontentloaded" });
        try {
            const btn = await page.$('button[id="L2AGLb"], form[action*="consent"] button');
            if (btn) {
                await btn.click();
                await page.waitForTimeout(1500);
            }
        } catch (error) {

        }

        let found = null,
            allResults = [];


        const cleanTarget = targetDomain.replace("www.", "").toLowerCase();
        for (let gPage = 0; gPage < 5; gPage++) {
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}&start=${gPage * 10}&num=10&h1=en&gl=us`, { waitUntil: "domcontentloaded" });

            let pageResults = [];
            for (let retry = 0; retry < 3; retry++) {
                try {
                    await page.waitForSelector('h3', { timeout: 8000 });
                    await page.waitForTimeout(1500);
                    pageResults = await page.evaluate(() => Array.from(document.querySelectorAll('h3')).map((h3) => {
                        let a = h3.closest('a');
                        if (!a) {
                            let p = h3.parentElement;
                            for (let j = 0; j < 5 && p; j++, p = p.parentElement) {
                                if (p.tagName === "A") {
                                    a = p;
                                    break;


                                }
                                const sub = p.querySelector("a[href]");
                                if (sub && sub.contains(h3)) {
                                    a = sub;
                                    break;

                                }


                            }
                        }
                        if (!a || !a.href.startsWith("http") || a.href.includes("google.")) return null;
                        let s = "",
                            c = a.parentElement;
                        for (let j = 0; j < 6 && c; j++, c = c.parentElement) {
                            const txt = c.innerText || "";
                            if (txt.length > h3.innerText.length + 50) {
                                s = (txt.split("\n").find((l) => l.length > 30 && !l.includes(h3.innerText.substring(0, 20))) || "").trim().substring(0, 300);
                                if (s) break;

                            }

                        }

                        return { url: a.href, domain: new URL(a.href).hostname.replace("www.", ""), title: h3.innerText.trim(), snippet: s }



                    }).filter(Boolean));

                    if (pageResults.length > 0) break;
                    await page.reload({ waitUntil: "domcontentloaded" });




                } catch (err) {
                    if (retry === 2) break;
                    await page.reload({ waitUntil: "domcontentloaded" });


                }
            }
            if (!pageResults.length) break;
            for (const r of pageResults) {

                r.position = allResults.length + 1;
                allResults.push(r);
                if (!found && (r.domain.toLowerCase().includes(cleanTarget) || cleanTarget.includes(r.domain.toLowerCase()))) {
                    found = { ...r, page: gPage + 1 }

                }
            }
            if (found) break;
            await page.waitForTimeout(2000 + Math.random() * 2000);




        }
        await browser.close();
        const competitors = allResults.filter((r) => !r.domain.toLowerCase().includes(cleanTarget) && !cleanTarget.includes(r.domain.toLowerCase())).slice(0, 10);

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
                totalResultsScanned: allResults.length

            }
        }


    } catch (error) {
        console.error("Rank Tracker Error:", error.message);
        if (browser) await browser.close().catch(() => { });
        return { success: false, error: error.message }


    }
}





// import { chromium } from "playwright-core";
// import Browserbase from "@browserbasehq/sdk";
// import 'dotenv/config';

// const bb = new Browserbase({
//     apiKey: process.env.BROWSERBASE_API_KEY,
// });

// // search google for a keyword and extract ranking results for a target domain.

// export async function rankTracker(keyword, targetDomain) {
//     let browser;
//     try {
//         const session = await bb.sessions.create({
//             browserSettings: { blockAds: true },
//         });

//         browser = await chromium.connectOverCDP(session.connectUrl);
//         const page = browser.contexts()[0].pages()[0];
//         page.setDefaultNavigationTimeout(45000);

//         await page.goto("https://www.google.com", { waitUntil: "domcontentloaded" });

//         // consent popup handle karo
//         try {
//             const btn = await page.$('button[id="L2AGLb"], form[action*="consent"] button');
//             if (btn) {
//                 await btn.click();
//                 await page.waitForTimeout(1500);
//             }
//         } catch (_) {}

//         let found = null;
//         let allResults = [];

//         const cleanTarget = targetDomain.replace("www.", "").toLowerCase();

//         for (let gPage = 0; gPage < 5; gPage++) {
//             await page.goto(
//                 `https://www.google.com/search?q=${encodeURIComponent(keyword)}&start=${gPage * 10}&num=10&hl=en&gl=us`,
//                 { waitUntil: "domcontentloaded" }
//             );

//             let pageResults = [];

//             for (let retry = 0; retry < 3; retry++) {
//                 try {
//                     await page.waitForSelector('body', { timeout: 10000 });
//                     await page.waitForTimeout(3000);

//                     // check karo Google ne block toh nahi kiya
//                     const isBlocked = await page.evaluate(() => {
//                         const body = document.body.innerText || "";
//                         return body.includes("unusual traffic") || 
//                                body.includes("captcha") || 
//                                document.querySelector('form#captcha-form') !== null;
//                     });

//                     if (isBlocked) {
//                         console.warn(`Google ne block kiya page ${gPage + 1} par — ruk ke retry karo`);
//                         await page.waitForTimeout(5000);
//                         if (retry === 2) break;
//                         continue;
//                     }

//                     // page scroll karo taaki lazy-load results render ho
//                     await page.evaluate(() => window.scrollBy(0, 600));
//                     await page.waitForTimeout(1000);

//                     pageResults = await page.evaluate(() => {
//                         const results = [];

//                         // Google ke multiple result container selectors try karo
//                         const containers = document.querySelectorAll(
//                             'div.g, div[data-sokoban-container], div[data-hveid][data-ved], li.b_algo'
//                         );

//                         containers.forEach((item) => {
//                             // direct organic result link lo
//                             const a = item.querySelector('a[href^="http"]:not([href*="google.com"]):not([href*="google.co"])');
//                             const h3 = item.querySelector('h3');
//                             if (!a || !h3) return;

//                             let hostname = "";
//                             try {
//                                 hostname = new URL(a.href).hostname.replace("www.", "").toLowerCase();
//                             } catch (_) {
//                                 return;
//                             }

//                             // snippet extract karo
//                             const snippetEl =
//                                 item.querySelector('[data-sncf="1"]') ||
//                                 item.querySelector('.VwiC3b') ||
//                                 item.querySelector('[style="-webkit-line-clamp:2"]') ||
//                                 item.querySelector('span[class]');

//                             const snippet = (snippetEl?.innerText || "").trim().substring(0, 300);

//                             results.push({
//                                 url: a.href,
//                                 domain: hostname,
//                                 title: h3.innerText.trim(),
//                                 snippet,
//                             });
//                         });

//                         // fallback: agar containers kaam na kare toh h3 approach
//                         if (results.length === 0) {
//                             document.querySelectorAll('h3').forEach((h3) => {
//                                 let a = h3.closest('a');
//                                 if (!a) {
//                                     let p = h3.parentElement;
//                                     for (let j = 0; j < 5 && p; j++, p = p.parentElement) {
//                                         if (p.tagName === "A") { a = p; break; }
//                                         const sub = p.querySelector("a[href]");
//                                         if (sub && sub.contains(h3)) { a = sub; break; }
//                                     }
//                                 }
//                                 if (!a || !a.href.startsWith("http") || a.href.includes("google.")) return;

//                                 let hostname = "";
//                                 try {
//                                     hostname = new URL(a.href).hostname.replace("www.", "").toLowerCase();
//                                 } catch (_) { return; }

//                                 let snippet = "";
//                                 let c = a.parentElement;
//                                 for (let j = 0; j < 6 && c; j++, c = c.parentElement) {
//                                     const txt = c.innerText || "";
//                                     if (txt.length > h3.innerText.length + 50) {
//                                         snippet = (
//                                             txt.split("\n").find((l) => l.length > 30 && !l.includes(h3.innerText.substring(0, 20))) || ""
//                                         ).trim().substring(0, 300);
//                                         if (snippet) break;
//                                     }
//                                 }

//                                 results.push({
//                                     url: a.href,
//                                     domain: hostname,
//                                     title: h3.innerText.trim(),
//                                     snippet,
//                                 });
//                             });
//                         }

//                         return results;
//                     });

//                     console.log(`Page ${gPage + 1}, retry ${retry}: found ${pageResults.length} results`);

//                     if (pageResults.length > 0) break;

//                     // results nahi mile — reload karo
//                     await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
//                     await page.waitForTimeout(2000);

//                 } catch (err) {
//                     console.warn(`Retry ${retry} failed on page ${gPage + 1}:`, err.message);
//                     if (retry === 2) break;
//                     await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
//                     await page.waitForTimeout(2000);
//                 }
//             }

//             if (!pageResults.length) {
//                 console.warn(`No results on page ${gPage + 1}, stopping.`);
//                 break;
//             }

//             for (const r of pageResults) {
//                 r.position = allResults.length + 1;
//                 allResults.push(r);
//                 if (
//                     !found &&
//                     (r.domain.includes(cleanTarget) || cleanTarget.includes(r.domain))
//                 ) {
//                     found = { ...r, page: gPage + 1 };
//                 }
//             }

//             if (found) break;

//             // pages ke beech random delay — rate limiting se bachne ke liye
//             await page.waitForTimeout(2000 + Math.random() * 2000);
//         }

//         await browser.close();

//         const competitors = allResults
//             .filter((r) => !r.domain.includes(cleanTarget) && !cleanTarget.includes(r.domain))
//             .slice(0, 10);

//         return {
//             success: true,
//             data: {
//                 keyword,
//                 targetDomain,
//                 position: found?.position ?? null,
//                 page: found?.page ?? null,
//                 title: found?.title ?? null,
//                 snippet: found?.snippet ?? null,
//                 competitors,
//                 totalResultsScanned: allResults.length,
//             },
//         };

//     } catch (error) {
//         console.error("Rank Tracker Error:", error.message);
//         if (browser) await browser.close().catch(() => {});
//         return { success: false, error: error.message };
//     }
// }

