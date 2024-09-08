import 'dotenv/config.js'

export const config = {
    PORT: process.env.PORT,
    RABBIT_PORT: process.env.RABBIT_PORT,
    ELASTIC_PORT:process.env.ELASTIC_PORT,
    MINIO_ENDPOINT:process.env.MINIO_ENDPOINT,
    MINIO_PORT:process.env.MINIO_PORT,
    MINIO_ACCESS_KEY:process.env.MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY:process.env.MINIO_SECRET_KEY,
    MONGODB_PORT:process.env.MONGODB_PORT,
}