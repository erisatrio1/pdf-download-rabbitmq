import 'dotenv/config.js'

export const config = {
    PORT: process.env.PORT,
    SERVICE_DUA_URL: process.env.SERVICE_DUA_URL,
    RABBIT_PORT: process.env.RABBIT_PORT,
}