const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema ({
    Fname: { type: String, required: true },
    Lname: { type: String, required: true },
    OVR: { type: Number, required: true },
    jerseyNO: { type: Number, required: true },
    position: { type: String, required: true },
    positionSec: String,
    nationality: String,
    price: Number,
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' } // get current team for player
});

const playerModel = mongoose.model('Player', playerSchema);
module.exports = playerModel;