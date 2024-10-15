const mongoose = require('mongoose');

const fixtureSchema = new mongoose.Schema({
    leagueId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLeague' },
    matches: [
        {
            homeTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
            awayTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
            result: {
                home: { type: Number, default: null },
                away: { type: Number, default: null },
            }
        }
    ]
});

const Fixture = mongoose.model('Fixture', fixtureSchema);
module.exports = Fixture;