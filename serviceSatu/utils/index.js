import amqp from 'amqp-connection-manager';
import { config } from '../config/index.js';

const queue = 'pdf_download_queue';
export const CreateChannel = async() => {
    try {
        const connection = amqp.connect ([config.RABBIT_PORT]);
        const channelWrapper = connection.createChannel({
            setup: (channel) => {
                return channel.assertQueue(queue, {durable: true })
            }
        })
        console.log('Connect to rabbit');
        return channelWrapper;
    } catch (error) {
        return new Error('Failed connect to Rabbit');
    }
}

export const SendLink = (message, channelWrapper) => {

    channelWrapper
    .sendToQueue(queue, Buffer.from(message), {
        persistent: true
    })
    .then(() => {
        return console.log('Success send message')
    })
    .catch((r) => {
        return console.log(r)
    });
}

export const Result = (message, totalLinks, error) => ({
    message: message,
    totalLinks: totalLinks,
    error: error
})