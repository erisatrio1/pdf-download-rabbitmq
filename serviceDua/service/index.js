import puppeteer from 'puppeteer';
import { Log } from '../database/model/Log.js';
import { minioClient, logger } from '../database/index.js'
import { Result } from '../utils/index.js';
import { executablePath } from 'puppeteer'
import { customAlphabet } from 'nanoid';


class Service {
    generateFilename() {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(2);
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
    
        // Generate NanoID dengan 5 karakter
        const nanoid = customAlphabet('1234567890abcdef', 5)();
    
        // Format nama file
        const filename = `${yy}${MM}${dd}_${HH}${mm}${ss}_${nanoid}.pdf`;
        
        return filename;
    }

    async downloadPDF(url, bucketName) {
        // Mulai pengukuran untuk render HTML
        const renderStartTime = Date.now();

        const browser = await puppeteer.launch({
            executablePath: executablePath(),
        });

        const page = await browser.newPage();

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 0
        });

        const pdfUint8Array = await page.pdf({
            format: 'A4',
            landscape: true 
        });

        // Akhir pengukuran render HTML
        const renderEndTime = Date.now(); 
        const renderTimeInMillisecond = renderEndTime - renderStartTime;

        // Menghitung waktu download PDF
        let pdfBuffer = Buffer.from(pdfUint8Array);
        const fileSizeInBytes = pdfBuffer.length;
        const filename = this.generateFilename();

        // Akhir pengukuran download PDF
        const downloadEndTime = Date.now(); 
        let downloadTimeInMillisecond = downloadEndTime - renderEndTime;

        if (downloadTimeInMillisecond === 0) {
            downloadTimeInMillisecond = 1; // Set default kecil jika waktu terlalu cepat untuk dihitung
        }

        try {
            const uploadStartTime = Date.now(); // Mulai pengukuran upload PDF ke MinIO

            await minioClient.putObject(bucketName, filename, pdfBuffer )

            const uploadEndTime = Date.now(); // Akhir pengukuran upload PDF ke MinIO
            const uploadTimeInMillisecond = uploadEndTime - uploadStartTime;

            // Menghitung kecepatan download dan upload
            const downloadSpeedKBPerMs = fileSizeInBytes / downloadTimeInMillisecond  / 1024;
            const uploadSpeedKBPerMs = fileSizeInBytes / uploadTimeInMillisecond / 1024;

            // Konversi ke KB/s
            const downloadSpeedRounded = Math.round(downloadSpeedKBPerMs * 1000); 
            const uploadSpeedRounded = Math.round(uploadSpeedKBPerMs * 1000); 

            logger.info(`Downloaded ${filename} (${fileSizeInBytes} bytes)`)

            // Menyimpan log ke MongoDB
            const log = new Log({
                name: filename,
                sizeInBytes: fileSizeInBytes,
                renderDurationInMs: renderTimeInMillisecond,
                donwloadDurationInMs: downloadTimeInMillisecond,
                uploadDurationInMs:uploadTimeInMillisecond,
                downloadSpeedInSecond: downloadSpeedRounded,
                uploadSpeedinSecond: uploadSpeedRounded,
                downloadSuccess: true,
                message:`Downloaded ${filename} (${fileSizeInBytes} bytes)`
            });

            await log.save();
            logger.info(`Log saved for ${filename}`);

        } catch (error) {
            logger.error(`Error saving log for ${filename}:`, { error:error.message });
        }
    }

    async retryFailedLinks(channel, failedLinks, retryLimit) {
        for (let i = 0; i < failedLinks.length; i++) {
            const { link, retries } = failedLinks[i];
    
            if (retries >= retryLimit) {
                logger.error(`Download for ${link} failed after ${retryLimit} retries. Giving up.`);
                const log = new Log({
                    name: link,
                    sizeInBytes: 0,
                    renderDurationInMs: 0,
                    donwloadDurationInMs: 0,
                    uploadDurationInMs:0,
                    downloadSpeedInSecond: 0,
                    uploadSpeedinSecond: 0,
                    downloadSuccess: false,
                    message:`Download for ${link} failed after ${retryLimit} retries. Giving up.`
                });
                await log.save();
                continue; 
            }
    
            try {
                await this.downloadPDF(link);
                processedFiles += 1;
                logger.info(`Retried and downloaded ${link}`);
    
                failedLinks.splice(i, 1);
                i--; // 
            } catch (error) {
                logger.error(`Error retrying ${link}:`, { error: error.message});
    
                failedLinks[i].retries += 1;
    
                if (failedLinks[i].retries >= retryLimit) {
                    logger.error(`Reached retry limit for ${link}. Will not retry further.`);
                }
            }
        }
    }

    async Analytics() {
        try {
            const records = await Log.find({ downloadSuccess:true }).sort({ createdAt: -1 }).limit(10);
    
            // Hitung total kecepatan download dan upload
            const totalDownloadSpeed = records.reduce((total, record) => total + record.downloadSpeedInSecond, 0);
            const totalUploadSpeed = records.reduce((total, record) => total + record.uploadSpeedinSecond, 0);
    
            // Hitung rata-rata kecepatan download dan upload
            const averageDownloadSpeed = totalDownloadSpeed / records.length;
            const averageUploadSpeed = totalUploadSpeed / records.length;
            const data= {
                AverageLastTenDownloadRecords:averageDownloadSpeed,
                AverageLastTenUploadRecords:averageUploadSpeed
            }
    
            // Return hasil
            return Result('in byte per second', data, null)

        } catch (error) {
            return Result(null, null, error.message)
        }
    }
}

export default Service;