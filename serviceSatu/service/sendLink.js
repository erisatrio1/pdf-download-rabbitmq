import axios from 'axios';
import { SendLink, Result } from '../utils/index.js'
import { config } from '../config/index.js'

class Service {
    async SendLinkPdf(pdfLinks, channel) {
        try {
            // Check ketersediaan service dua
            const healthCheck = await axios.get(config.SERVICE_DUA_URL);
    
            if (healthCheck.status === 200) {
                pdfLinks.forEach(link => {
                    SendLink(link, channel);
                });

                return Result('Links sent to queue for processing', pdfLinks.length, null )
    
            } else {
                return Result(null, null, 'Service 2 is unavailable. Please try again later.' )
            }
        } catch (error) {
            // Kirim response jika service 2 tidak tersedia
            return Result(null, null, error )
        }
    }
}

export default Service;