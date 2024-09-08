import express from "express";
import { CreateChannel } from "./utils/index.js";
import { Route } from './api/route.js'

export const server = async(app) => {
    app.use(express.json());

    const channel = await CreateChannel();
    Route(app, channel);
}