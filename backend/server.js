const express = require('express');
const DBconn = require('./config/dbUser');
const dotenv = require("dotenv");
const bcrypt = require('bcrypt');
// token
const jwt = require('jsonwebtoken');
const tokenAuth = require('./auth/jwtmiddleware');
// cors
const cors = require('cors');
// Models
const User = require('./models/User');
const Team = require('./models/Team');
const Player = require('./models/Player');
const UserLeague = require('./models/UserLeague');
const Fixture = require('./models/Fixture');
const adminAuth = require('./auth/adminAuth');

dotenv.config();

// Initialize express app
const app = express();
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000', // PRODUCTION URL
    methods: 'GET,POST',
    allowedHeaders: ['Content-type', 'Authorization'],
}));

const port = process.env.PORT || 7700;


// USER LOGIN 
app.post('/api/login', async (req, res) => {
    await DBconn(); // connect to DB
    const { email, password } = req.body; // Get email and password values from frontend login form

    try {
        let user = await User.findOne({ email });
        // Check email
        if (!user) {
            console.log("email not found");
            return res.status(400).json({ message: "Invalid credentials!" });
        }
        // log the stored hash pwd for debugging
        /*console.log("Stored password", user.password);
        console.log("provided password", password);
        console.log("provided email", email);*/

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        // pwd match result
        //console.log("pwd match result", isMatch);
        //console.log("pwd match result", isMatch);
        if (!isMatch) {
            console.log("Password incorrect");
            return res.status(400).json({ message: "Invalid credentials!" });
        }

        // Generate a JsonWebToken and return the response
        const JWToken = jwt.sign({ userId: user._id }, process.env.JWTSECRET, { expiresIn: '12h' });
        res.json({ JWToken, user: {username: user.username, email: user.email, team: user.team }});
        //console.log("User signed in successfully!")
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});
// NEW USER REGISTRATION
app.post('/api/register', async (req, res) => {
    // new user data required
    const { username, email, password, country, profileImage, team } = req.body;
    //console.log("got the data");
    //console.log(req.body);
    try {
        await DBconn();
        // Check if a user is already registered with this email
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'This email already exists!' });
        }
        
        // Hash password
        const HashedPwd = await bcrypt.hash(password, 10);
        // Create the new user object with the inserted data
        user = new User({
            username,
            email,
            password: HashedPwd,
            country,
            profileImage,
            team,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        //console.log(user);
        // Save changes
        await user.save();

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                username: user.username,
                email: user.email,
                country: user.country,
                profileImage: user.profileImage,
                team: user.team,
            }
        });
        //console.log(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
});

// UPDATE PASSWORD FUNCTION - USED TO DEBUG DATABASE PWD DATA
async function updateUserPassword(email, newPassword) {
    try {
        // Fetch the user by email
        let user = await User.findOne({ email });
        if (!user) {
            console.log("User not found");
            return;
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update the password in the database
        user.password = hashedPassword;
        await user.save();

        console.log('Password updated successfully');
    } catch (error) {
        console.error('Error updating password:', error);
    }
}

/**
 *  TEAMS SECTION 
 */
// GET TEAM LIST from DB
app.get('/api/teamList', async (req, res) => {
    await DBconn(); // Connect to DB
    try {
        const teams = await Team.find(); // Get list with available teams
        res.json(teams);
    } catch (error) {
        console.error("Error fething teams", error); //debugging
        res.status(500).json({ message: "Server error" });
    }
});


// ASSIGN A TEAM TO THE NEW USER
app.post('/api/assignTeam', tokenAuth, async (req, res) => {
    
    //console.log('req:', req.user);
    //console.log('body:', req.body);
    try {
        await DBconn();
        const userId = req.user.userId; // User's id from JWT
        const { teamId } = req.body; // User's selected team

        const user = await User.findById(userId); // Get the user
        const team = await Team.findById(teamId); //fetch selected team

        if (!team) {
            return res.status(400).json({ message: "Team not found." });
        }
        
        //Assign the team to the user
        user.team = teamId;
        await user.save();
        //console.log('user chose:', user.team);
        // Initialize league
        let league = await UserLeague.findOne({ userId });
        //console.log('League1:', league);
        if (!league) {
            league = await initUserLeague(userId);
        }
        user.league = league._id;
        await user.save();
        //console.log('user:', user.league); 

        //Generating the fixtures
        const teams = league.teams.map(team => ({
            id: team.teamId._id,
            name: team.teamId.name
        }));

        const schedule = generateFixtures(teams);

        const fixtureGen = new Fixture({
            leagueId: league._id,
            matches: schedule.map(match => ({
                homeTeam: match.home.id,
                awayTeam: match.away.id
            }))
        });
        await fixtureGen.save();
        //console.log('fixturegen:', fixtureGen);
        league.fixtures.push(fixtureGen._id);
        //console.log('fixtureId:', fixtureGen._id);
        await league.save();
        console.log('league:', league);

        const populatedFixture = await Fixture.findById(fixtureGen._id)
        .populate('matches.homeTeam', 'name city country stadium logo')
        .populate('matches.awayTeam', 'name city country stadium logo');
        //console.log('populatedfixture:', populatedFixture);
        res.json({ message: "Team successfully assigned", user, fixtures: populatedFixture });
    } catch (error) {
        console.error("Error assigning team:", error);
        res.status(500).json({ message: "Server error." });
    }
});

// NEW LEAGUE INITIALIZATION FUNCTION
const initUserLeague = async (userId) => {
    try {
        const teams = await Team.find();

        const userTeams = teams.map(team => ({
            teamId: team._id,
            stats: {
                gp: 0,
                pts: 0,
                w: 0,
                d: 0,
                l: 0,
                gf: 0,
                ga: 0,
                gd: 0,
            },
        }));
        const newLeague = new UserLeague({ userId, teams: userTeams });
        await newLeague.save();
        //console.log('New league created:', newLeague);
        return newLeague;
    } catch (error) {
        console.error("Error initializing league:", error);
        throw new Error("League initialization failed.");
    }
}

//FIXTURE GENERATION FUNCTION
function generateFixtures(teams) {
    const teamList = shuffleArray([...teams]);
    const rounds = [];
    const numberOfTeams = teams.length;
    const numberOfRounds = (numberOfTeams - 1) * 2;
    const halfSize = numberOfTeams / 2;


    for (let round = 0; round < numberOfRounds / 2; round++) {
        const roundFixtures = [];
        for (let i = 0; i < halfSize; i++) {
            const home = teamList[i];
            const away = teamList[numberOfTeams - 1 - i];

            if (home && away) {
                roundFixtures.push({ home, away });
            }
        }
        rounds.push(roundFixtures);
        teamList.splice(1, 0, teamList.pop());
    }
    // Home and away matches
    const schedule = [...rounds, ...rounds.map(round => 
        round.map(({ home, away }) => ({ home: away, away: home }))
    )];
    return schedule.flat();
}

function shuffleArray(array) {
    for(let i = array.length -1; i> 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j] = array[j], array[i]];
    }
    return array;
}

// CUSTOMIZED UX WHEN LOGGED IN
app.get('/api/getUser', tokenAuth, async (req, res) => {
    await DBconn();
    
    //console.log('req in server.js', req);
    try {
        const user = await User.findById(req.user.userId).populate({
            path: 'team',
            populate: {
                path: 'players',
            }
        }).populate({
            path: 'league',
            populate: [
                {
                path: 'teams.teamId',
                },
                {
                    path: 'fixtures',
                    populate: [
                        { path: 'matches.homeTeam', select: 'name city country stadium logo' },
                        { path: 'matches.awayTeam', select: 'name city country stadium logo' }
                    ]
                }
            ]
        });
        console.log(user);
        //const team = await Team.findById(user.team._id).populate('players');
        //console.log('Populated team with players:', team);
        //console.log('user:', user.team.players);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({ user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error.'});
    }
});
// Get leagues for each user
app.get('/api/getLeague', async (req, res) => {
    try {
        //const user = await UserLeague.findById(req.user.userId);
        const leagues = await UserLeague.find();
        res.json(leagues);
    } catch (error) {
        console.error('Error getting your league.', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

//get Player list
app.get('/api/getPlayers', async (req, res) => {
    await DBconn(); // Connect to DB
    try {
        const players = await Player.find();
        res.json(players);
    } catch (error) {
        console.error("Error fething players", error); //debugging
        res.status(500).json({ message: "Server error" });
    }
});

// GAME MODE FUNCTIONS AND ROUTE
const simulateMatch = (homeOVR, awayOVR) => {
    const total = homeOVR + awayOVR;
    const homeWinChances = homeOVR / total;
    const awayWinChances = awayOVR / total;

    const randomOutcome = Math.random();

    if (randomOutcome < homeWinChances) {
        //Home wins
        return { home: Math.floor(Math.random() * 5), away: Math.floor(Math.random() * 3)};
    } else if (randomOutcome < homeWinChances + awayWinChances) {
        //Away team wins
        return { home: Math.floor(Math.random() *3), away: Math.floor(Math.random() * 5)};
    } else {
        //Draw
        return { home: Math.floor(Math.random() * 3), away: Math.floor(Math.random() * 3)};
    }
}

//Route
app.post('/api/matchSimulator', tokenAuth, async (req, res) => {
    await DBconn();
    const { fixtureId, matchId } = req.body;
    try {
        const fixture = await Fixture.findById(fixtureId)
        .populate({
            path: 'matches.homeTeam',
            populate: { path: 'players' }
        })
        .populate({
            path: 'matches.awayTeam',
            populate: { path: 'players' }
        });
        //console.log('fixture', fixture);
        const match = fixture.matches.id(matchId);
        //console.log('match:', match);
        if (!match) {
            return res.status(404).json({ message: 'Match not found.'});
        }
        //console.log(match.homeTeam);
        const homeOVR = match.homeTeam.players.reduce((acc, player) => acc + player.OVR, 0);
        const awayOVR = match.awayTeam.players.reduce((acc, player) => acc + player.OVR, 0);

        //Sim match
        const result = simulateMatch(homeOVR, awayOVR);
        //console.log('result:', result);

        //Update the fixture results
        match.result = { home: result.home, away: result.away };
        await fixture.save();


        //Update league table stats
        //console.log('req:', req.user);
        const league = await UserLeague.findOne({ userId: req.user.userId });
        //console.log(league)
        //Find the respective teams
        const homeTeam = league.teams.find(team => team.teamId.equals(match.homeTeam._id));
        const awayTeam = league.teams.find(team => team.teamId.equals(match.awayTeam._id));

        if (!homeTeam || !awayTeam) {
            return res.status(404).json({ message: 'Teams not found' });
        }

        //stats update
        homeTeam.stats.gp += 1;
        awayTeam.stats.gp += 1;

        if (result.home > result.away) {
            //home win
            homeTeam.stats.w += 1;
            homeTeam.stats.pts += 3;
            awayTeam.stats.l += 1;
        } else if (result.away > result.home) {
            //Away win
            awayTeam.stats.w += 1;
            awayTeam.stats.pts += 3;
            homeTeam.stats.l += 1;
        } else {
            //Draw
            homeTeam.stats.d += 1;
            awayTeam.stats.d += 1;
            homeTeam.stats.pts += 1;
            awayTeam.stats.pts +=1;
        }
        //home goals
        homeTeam.stats.gf += result.home;
        homeTeam.stats.ga += result.away;
        homeTeam.stats.gd = homeTeam.stats.gf - homeTeam.stats.ga;
        //away goals
        awayTeam.stats.gf += result.away;
        awayTeam.stats.ga += result.home;
        awayTeam.stats.gd = awayTeam.stats.gf - awayTeam.stats.ga;

        await league.save();
        res.json({ message: 'Match result:', result });
    } catch (error) {
        console.error('Error simulating the match:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});
//admin routes call
app.post('/admin/addTeam', adminAuth, async (req, res) => {
    const { name, city, country, stadium, logo } = req.body;

    try {
        const newTeam = new Team({ name, city, country, stadium, logo });
        await newTeam.save();
        res.status(201).json({ message: 'Team added successfully', team: newTeam });
    } catch (error) {
        res.status(500).json({ message: 'Error adding team', error: error.message });
    }
});

app.post('/admin/addPlayer', adminAuth, async (req, res) => {
    const { Fname, Lname, position, OVR, teamId, jerseyNO } = req.body;

    try {
        const player = new Player({ Fname, Lname, position, OVR, jerseyNO });
        await player.save();

        // Assign the player to the team if provided
        if (teamId) {
            const team = await Team.findById(teamId);
            if (team) {
                team.players.push(player._id);
                await team.save();
            }
        }

        res.status(201).json({ message: 'Player added successfully', player });
    } catch (error) {
        res.status(500).json({ message: 'Error adding player', error: error.message });
    }
});

// server portal
app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});