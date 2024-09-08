import Service from "../service/sendLink.js";

export const Route = (app, channel) => {
    const service = new Service();

    app.post('/send-pdf-links', async(req, res) => {
        const pdfLinks = req.body.pdfLinks;

        if (!Array.isArray(pdfLinks)) {
            return res.status(400).json({ error: 'Format must be array of PDF links.' });
        }

        const {message, totalLinks, error} = await service.SendLinkPdf(pdfLinks, channel);

        if (message && totalLinks) {
            return res.json({ message: 'Links sent to queue for processing', totalLinks: pdfLinks.length });
        } else {
            res.status(503).json({ error: 'Service 2 is unavailable. Please try again later.' });
        }
    })

}