import express from "express";
import { config } from "./config/index.js";
import { server } from './express-app.js';
import { connection } from './database/index.js'

const StartServer = async() => {
    const app = express();
    const PORT = config.PORT;

    await connection();

    await server(app);

    app.listen(PORT, () => {
        console.log(`Service 2 up and running on port:${PORT}`);
    });
}

StartServer();
