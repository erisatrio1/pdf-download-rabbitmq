import Service from "../service/index.js"

export const Route = async(app) => {
    const service = new Service;

    app.get('/analytics', (req, res) => {
        const { message, data, error} = service.Analytics()

        if (message && data) {
            res.status(200).json({
                AverageLastTenDownloadRecords:averageDownloadSpeed,
                AverageLastTenUploadRecords:averageUploadSpeed,
                message:'in byte per second'
            });
        } else {
            res.status(500).json({ message: 'Terjadi kesalahan', error });
        }
    })

    app.get('/check', (req, res) => {
        res.status(200).json({ status: 'UP' });
    });
}