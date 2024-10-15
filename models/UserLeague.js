const mongoose = require('mongoose');

const userLeagueSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    teams: [{
        teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team'},
        stats: {
            gp: { type: Number, default: 0 },
            pts: { type: Number, default: 0 },
            w: { type: Number, default: 0 },
            d: { type: Number, default: 0 },
            l: { type: Number, default: 0 },
            gf: { type: Number, default: 0 },
            ga: { type: Number, default: 0 },
            gd: { type: Number, default: 0 },
        },
    }],
    fixtures: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Fixture' }]
});

const UserLeague = mongoose.model('UserLeague', userLeagueSchema);
module.exports = UserLeague;