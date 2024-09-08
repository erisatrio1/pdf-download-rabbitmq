import express from "express";
import { CreateChannel, ConsumeLink } from "./utils/index.js";
import { Route } from './api/route.js'

const failedLinks = []; 
const retryLimit = 5; 

export const server = async(app) => {
    app.use(express.json());

    const connection = await CreateChannel();
    const consume = ConsumeLink(connection, failedLinks, retryLimit);
    Route(app);
}