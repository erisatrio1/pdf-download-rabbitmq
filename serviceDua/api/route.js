import Service from "../service/index.js"

export const Route = async(app) => {
    
    app.get('/analytics', async(req, res) => {
        const service = new Service;

        try {
            const { message, data, error} = await service.Analytics()
            res.status(200).json({data: data,
                message: message
            });
            
        } catch (error) {
            res.status(500).json({ message: 'Terjadi kesalahan', error });
            
        }
    })

    app.get('/check', (req, res) => {
        res.status(200).json({ status: 'UP' });
    });
}