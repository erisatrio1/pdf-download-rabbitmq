import { Log } from '../model/Log.js';

export const Analytics = async(req, res) => {
    try {
        const records = await Log.find({ downloadSuccess:true }).sort({ createdAt: -1 }).limit(10);

        // Hitung total kecepatan download dan upload
        const totalDownloadSpeed = records.reduce((total, record) => total + record.downloadSpeedInSecond, 0);
        const totalUploadSpeed = records.reduce((total, record) => total + record.uploadSpeedinSecond, 0);

        // Hitung rata-rata kecepatan download dan upload
        const averageDownloadSpeed = totalDownloadSpeed / records.length;
        const averageUploadSpeed = totalUploadSpeed / records.length;

        // Return hasil
        res.status(200).json({
            AverageLastTenDownloadRecords:averageDownloadSpeed,
            AverageLastTenUploadRecords:averageUploadSpeed,
            message:'in byte per second'
        });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan', error });
    }
}