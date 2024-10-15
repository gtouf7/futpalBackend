const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    name: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    logo: {
        img: {type: String},
        alt: {type: String}
    }
});

const teamModel = mongoose.model('Team', teamSchema);
module.exports = teamModel;