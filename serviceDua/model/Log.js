import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
    name: String,
    createdAt: String,
    sizeInBytes: Number,
    renderDurationInMs: Number,
    donwloadDurationInMs: Number,
    uploadDurationInMs: Number,
    downloadSpeedInSecond: Number,
    uploadSpeedinSecond: Number,
    downloadSuccess: Boolean,
    message: String,
});

export const Log = mongoose.model('Log', logSchema);