import KeywordTracking from "../models/keywordTracking.js";
import { keywordTracking } from "../services/keywordTrackingService.js";

// add a new keyword to track
export const addKeyword = async (req, res) => {
    try {
        const { keyword, url } = req.body;
        if (!keyword || !url) return res.status(400).json({ success: false, message: "Keyword and URL are required" });

        //extract domain from url
        let domain;
        try {
            const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
            domain = urlObj.hostname.replace("www.", "");
        } catch {
            return res.status(400).json({ success: false, message: "Invalid URL format" });
        }

        //check if keyword is already being tracked for this user and domain
        const existing = await KeywordTracking.findOne({ userId: req.userId, keyword: keyword.toLowerCase().trim(), domain });
        if (existing) {
            return res.status(400).json({ success: false, message: "already tracking this keyword for this domain" });
        }

        //create new tracking entry
        const tracking = await KeywordTracking.create({
            userId: req.userId,
            keyword: keyword.toLowerCase().trim(),
            url: url.startsWith("http") ? url : `https://${url}`,
            domain,
            status: "checking"
        })
        res.status(201).json({ success: true, message: "Keyword tracking started", tracking });
        keywordTracking(tracking)
    } catch (error) {
        console.error("Add Keyword Error:", error.message);
        if (error.code === 11000) return res.status(400).json({ success: false, message: "already tracking this keyword " });
        res.status(500).json({ success: false, message: "server error" });

    }
}

//get all keywords for the user
export const getKeywords = async (req, res) => {
    try {
        const keywords = await KeywordTracking.find({ userId: req.userId }).sort({ createdAt: -1 }).select("-rankHistory")
        res.json({ success: true, keywords });
    } catch (error) {
        console.error("get Keywords Error:", error.message);
        res.status(500).json({ success: false, message: "server error" });

    }
}

//get single keyword with full history   
export const getKeyword = async (req, res) => {
    try {
        const tracking = await KeywordTracking.findOne({ _id: req.params.id, userId: req.userId });
        if (!tracking) return res.status(404).json({ success: false, message: "Keyword tracking not found" });
        res.json({ success: true, tracking });
    } catch (error) {
        console.error("get Keyword Error:", error.message);
        res.status(500).json({ success: false, message: "server error" });

    }
}

// manually refresh a keyword's ranking data
export const refreshKeyword = async (req, res) => {

    try {
        const tracking = await KeywordTracking.findOne({ _id: req.params.id, userId: req.userId });
        if (!tracking) return res.status(404).json({ success: false, message: "Keyword tracking not found" });
        tracking.status = "checking";
        await tracking.save();
        res.json({ success: true, message: "Rank check started" });
        keywordTracking(tracking)



    } catch (error) {
        console.error("Refresh keyword error:", error.message);
        res.status(500).json({ success: false, message: "server error" });

    }
}


//delete a keyword
export const deleteKeyword = async (req, res) => {


    try {
        const tracking = await KeywordTracking.findByIdAndDelete({ _id: req.params.id, userId: req.userId });
        if (!tracking) return res.status(404).json({ success: false, message: "Keyword tracking not found" });

       
        res.json({ success: true, message: "Keyword tracking deleted" });



    } catch (error) {
        console.error("Delete keyword error:", error.message);
        res.status(500).json({ success: false, message: "server error" });


    }


}


//toggle tracking on/off
export const toggleTracking = async (req, res) => {

try {
        const tracking = await KeywordTracking.findOne({ _id: req.params.id, userId: req.userId });
        if (!tracking) return res.status(404).json({ success: false, message: "Keyword tracking not found" });

       tracking.active = !tracking.active;
       await tracking.save();
        res.json({ success: true, tracking });



    } catch (error) {
        console.error("Toggle tracking error:", error.message);
        res.status(500).json({ success: false, message: "server error" });


    }


}


