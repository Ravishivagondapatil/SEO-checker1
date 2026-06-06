

import cron from "node-cron";
import KeywordTracking from "../models/keywordTracking.js";

export function startRankTrackingCron() {
  cron.schedule("0 6 * * *", async () => {
    console.log("Starting daily rank tracking...");

    try {
      const activeTracking = await KeywordTracking.find({
        active: true,
      });

      for (const tracking of activeTracking) {
        tracking.status = "checking";
        await tracking.save();

        // rank checking logic here

        await new Promise((r) =>
          setTimeout(r, 1000 + Math.random() * 5000)
        );
      }
    } catch (error) {
      console.error(
        "[CRON] Rank tracking cron error:",
        error.message
      );
    }
  });

  console.log("Rank tracking cron job scheduled");
}