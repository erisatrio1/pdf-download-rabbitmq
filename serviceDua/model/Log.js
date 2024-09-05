import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
    name: String,
    sizeInBytes: Number,
    renderDurationInMs: Number,
    donwloadDurationInMs: Number,
    uploadDurationInMs: Number,
    downloadSpeedInSecond: Number,
    uploadSpeedinSecond: Number,
    downloadSuccess: Boolean,
    message: String,
}, { timestamps: true });

export const Log = mongoose.model('Log', logSchema);