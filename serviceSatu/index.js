import express from "express";
import { config } from "./config/index.js";
import { server } from './express-app.js'

const StartServer = async() => {
    const app = express();
    const PORT = config.PORT;

    await server(app);

    app.listen(PORT, () => {
        console.log(`Service 1 up and running on port:${PORT}`);
    });
}

StartServer();
