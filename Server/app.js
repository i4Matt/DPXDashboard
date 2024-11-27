const express = require('express');
const fs = require('fs');
const path = require('path');
const tmi = require('tmi.js'); // Import tmi.js
const http = require('http');
const socketIo = require('socket.io'); // Import socket.io
const multer = require('multer');

const app = express();

// ----- ----- //
// Define the path to the keys.json file
const keysFilePath = path.join(__dirname, '..', 'resources', 'keys.json');

// Check if keys.json exists, and if not, create it with default content
if (!fs.existsSync(keysFilePath)) {
    console.log('keys.json not found, creating a new one...');
    
    // Define default content with your structure
    const defaultKeysData = [{
        "twitch": {
            "oauthToken": "",
            "clientId": "",
            "channelId": ""
        },
        "twitchBot": {
            "username": "",
            "oauthToken": ""
        },
        "obs": {
            "password": ""
        }
    }];

    // Write the default content to keys.json
    fs.writeFileSync(keysFilePath, JSON.stringify(defaultKeysData, null, 2), 'utf8');
    console.log('keys.json created with default values.');
}
// ----- ----- //


// Set up multer to store uploaded files temporarily
const upload = multer({ dest: 'uploads/' });

function myDebug(message){if(true){console.log(message)}} // DEBUG MENUES

// Create the HTTP server and attach socket.io to it
const server = http.createServer(app);
const io = socketIo(server); // Set up socket.io

let generatedKey, streamKey1 = generateRandomString(16), streamKey2 = generateRandomString(16), streamKey3 = generateRandomString(16), streamKey4 = generateRandomString(16);
const port = 64197;

// HTML location to run the frontend
app.use(express.static(path.join(__dirname, '../Client')));
//app.use(express.static('../Client'));
//app.use(express.static('public'));

// Middleware to parse JSON request bodies
app.use(express.json());  // Ensure this is in place to parse JSON body

let currentGame = 0, nextGame = 0;

// Store logs in memory (you can also store them in a file or database)
let logs = [];

// ----- INITIALIZATION STARTS HERE ----- //

// Load JSON file contents directly into an object
const swearWordsObject = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../resources/prohibited.json'), 'utf8')
);

// LOAD ALL PASSWORDS, OAUTH TOKENS AND OTHER IMPORTANT DATA THAT IS NOT STORED IN THIS FILE.
const mainKey = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../resources/keys.json'), 'utf8')
);
const key = mainKey[0];



// ----- INITIALIZATION ENDS HERE ----- //



// ----- TMI.js INEGRATION STARTS HERE ----- //

// Set up the TMI.js client
const client = new tmi.Client({
    channels: ['dogpoundspeedrunning'], // Add your Twitch channel name here
    identity: {
        username: key.twitchBot.username, // Your bot's Twitch username
        password: key.twitchBot.oauthToken, // Your bot's OAuth token
    },
});

// Connect to the Twitch channel
client.connect().catch(console.error);

// Listen for messages in chat
client.on('message', (channel, userstate, message, self) => {
    if(self) return; // Ignore messages from the bot

    //console.log(`Message from ${userstate.username}: ${message}`);

    // !! MODERATION !! //
    swearScoreOffence(channel, userstate, calculateSwearScore(message));

    // !! USER COMMANDS !! //
    // COMMANDS THAT ANYONE CAN USE.
    userCommands(channel, message);


    if(userstate.mod){
        modCommands(channel, userstate, message);
    }
    
});

// USER COMMANDS
function userCommands(channel, message){
    if(message.toLowerCase() === "!charity" || message.toLowerCase() === "!charitie" || message.toLowerCase() === "!charities" || message.toLowerCase() === "!twloha" || message.toLowerCase() === "!dpx") {
        command('!CHARITY');
        client.say(channel, "Dog Pound Expo is raising money to support To Write Love on Her Arms. Your gift will make it possible to connect people to hope and help. Your story matters. To learn more about TWLOHA, visit https://twloha.com/.");
        client.say(channel, "Also if you wish to donate to the cause, you can donate here: http://donate.dpx.social/.")
    }

    if(message.toLowerCase() === "!donate" || message.toLowerCase() === "!donation") {
        command('!DONATE');
        client.say(channel, "Thank you for your contribution: http://donate.dpx.social/")
    }

    if(message.toLowerCase() === "!schedule"){
        command('!SCHEDULE');
        client.say(channel, "Check out what runs we have here: https://www.dogpoundexpo.com/schedule/");
    }

    if(message.toLowerCase() === "!help" || message.toLowerCase() === "!gethelp" || message.toLowerCase() === "!helpme") {
        command('!GETHELP');
        warning("COMMAND GETHELP WAS USED");
        client.say(channel, "You can find help at: https://twloha.com/find-help/ || In a crisis, you can TEXT: HELP to 741-741 In Canada & USA or visit: https://twloha.com/find-help/international-resources/ for your country.")
    }

    // SOCIALS
    if(message.toLowerCase() === "!socials" || message.toLowerCase() === "!social" || message.toLowerCase() === "!link" || message.toLowerCase() === "!links") {
        command('!SOCIALS');
        client.say(channel, "You can check out our socials here! | Our Website: https://www.dogpoundexpo.com/ | Twitter: http://twitter.dpx.social/ | Youtube: http://youtube.dpx.social/ | Discord: http://discord.dpx.social/");

    }
    if(message.toLowerCase() === '!discord'){ // USER COMMAND TO REQUEST THE DISCORD CHANNEL
        command('!DISCORD');
        client.say(channel, 'Here you go! http://discord.dpx.social/');
    }
    if(message.toLowerCase() === '!twitter' || message.toLowerCase() === "!x"){ // USER COMMAND TO REQUEST THE DISCORD CHANNEL
        command('!TWITTER');
        client.say(channel, 'Here you go! http://twitter.dpx.social/');
    }
    if(message.toLowerCase() === '!youtube'){ // USER COMMAND TO REQUEST THE DISCORD CHANNEL
        command('!YOUTUBE');
        client.say(channel, 'Here you go! http://youtube.dpx.social/');
    }
    if(message.toLowerCase() === '!website'){ // USER COMMAND TO REQUEST THE DISCORD CHANNEL
        command('!WEBSITE');
        client.say(channel, "Here's our website! https://www.dogpoundexpo.com/");
    }
}

// MOD COMMANDS
function modCommands(channel, userstate, message){
    // CHANGE STREAM ELEMENTS
    if(message.includes("$game")){
        message = message.replace("$game ", "");
        updateStreamGame(message);
    }

    if(message.includes("$title")){
        message = message.replace("$title ", "");
        updateStreamTitle(message);
    }
}

// QUICK FUNCTIONS
function banUser(username, message, reason){ // CREATES BAN LOGS FOR BANINFO.TXT
    writeFile('./data/banInfo.txt', '[' + time() + ']' + ' Date: ' + dates() +' | User: ' + username.toUpperCase() + ' | Reason: ' + reason + ' | Message: ' + message);
}
function brackey(message){ // ADDS BRACKETS TO ANY TEXT AND INSURE'S THE TEXT TO BE WHITE.
    return COLOR.white + '[' + message + '] ';
}
function write(message){ // UNSPECIFIED CONSOLE.LOG
    console.log(brackey(time()) + message);
}
function warning(message){ // WARNING MESSAGE
    addLogEntry("WARNING: " + message);
}
function notice(message){ // NOTICE MESSAGE
    addLogEntry("NOTICE: " + message);
}
function command(message){ // WHEN A NONE TEXT BASED COMMAND IS BEING EXICUTED
    addLogEntry('COMMAND: ' + message + ' initiated.')
}
function cap(string) { // CAPITALIZES THE FIRST LETTER.
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// ~~~ AUTO MODERATION STARTS HERE ~~~ //
// Function to check and add a username
function checkAndAddUsername(username) {
    // Define the file path within the data directory
    const filePath = path.join(__dirname, '../data/warnedUsers.json');
    
    // Read the file synchronously
    const fileData = fs.readFileSync(filePath, 'utf8');
    
    // Parse the JSON data
    const data = JSON.parse(fileData);
  
    // Check if the username already exists
    if (data.usernames.includes(username)) {
      console.log(`${username} already exists in the warned users list.`);
      return true; // Return true if the username is already there
    } else {
      // If not, add the username to the array
      data.usernames.push(username);
      
      // Write the updated data back to the file
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      console.log(`${username} added to the warned users list.`);
      return false; // Return false if the username was added
    }
  }

// Function to calculate the score of swear words in a string
function calculateSwearScore(inputString) {
    let totalScore = 0;
  
    // Split the string into words and iterate over them
    const words = inputString.toLowerCase().split(/\s+/); // Split by whitespace
    for (const word of words) {
      // Check if the word exists in swearWordsObject and add its score
      if (swearWordsObject[word]) {
        totalScore += swearWordsObject[word];
        
        // If the score hits or exceeds 25, stop and return the score
        if (totalScore >= 25) {
          return totalScore;
        }
      }
    }
    
    return totalScore;
  }

// CHECKS IF THE USER SHOULD BE TIMED OUT OR BANNED
function swearScoreOffence(channel, userstate, score){
    if (score => 25){ // USER WILL BE BANNED
        if(checkAndAddUsername(userstate.username)){
            // BAN USER
        } else{
            // LARGE TIMEOUT FOR USER
        }
    } else if (score => 15){ // USER WILL BE TIMED OUT
        if(checkAndAddUsername(userstate.username)){
            // TIMEOUT USER
        } else{
            // WARN USER
        }
    }
}

// ~~~ AUTO MODERATION ENDS HERE ~~~ //

// ----- TMI.js INTEGRATION ENDS HERE ----- //



// ----- STREAMING INTEGRATION STARTS HERE ----- //

// ~~~ OBS INTEGRATIONS START ~~~ //
const { OBSWebSocket } = require('obs-websocket-js');
const obs = new OBSWebSocket();

/**
 * Function to change scene in OBS
 * @param {string} sceneName - The name of the scene to switch to.
 * @param {string} port - The WebSocket port to connect to (default: 26095).
 * @param {string} password - The password for the WebSocket connection (optional).
 */
async function changeScene(sceneName) {
    const port = "62435";
    const password = key.obs.password;

    try {
        // Ensure the URL format is correct (using template literal)
        const url = `ws://192.168.1.100:${port}`;  // Use the correct URL format

        // Connect to OBS using the specified port and optional password
        await obs.connect(url, password);
        console.log('Connected to OBS!');

        // Send the "SetCurrentScene" request to change the scene
        const response = await obs.call('SetCurrentProgramScene', { 'sceneName': sceneName});
        console.log(`Scene changed to: ${sceneName}`, response);
        console.log();

    } catch (err) {
        console.error('Failed to connect or change scene:', err);
    }
}
// ~~~ OBS INTEGRATIONS END ~~~ //

// ~~~ TWITCH API INTERGRATION START ~~~ //
// FUNCTION TO UPDATE THE STREAM TITLE
async function updateStreamTitle(newTitle) {
    const oauthToken = key.twitch.oauthToken; // Your OAuth token
    const clientId = key.twitch.clientId; // Your Client ID
    const channelId = key.twitch.channelId; // Your channel ID
  
    // Set the API endpoint for changing the title
    const apiUrl = `https://api.twitch.tv/helix/channels?broadcaster_id=${channelId}`;
  
    // Create the request body with the new title
    const body = {
      title: newTitle,
    };
  
    // Send the PATCH request to update the stream title
    try {
      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${oauthToken}`,
          'Client-ID': clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
  
      // Check for a successful response without assuming JSON content
      if (response.ok) {
        console.log(`Successfully updated title to: "${newTitle}"`);
        addLogEntry(`Successfully updated title to: "${newTitle}"`);
      } else {
        const errorText = await response.text(); // Log the raw error response
        console.error('Error updating title:', errorText);
      }
    } catch (error) {
      console.error('Failed to update title:', error);
    }
}
  
async function getGameId(gameName) {
    const oauthToken = key.twitch.oauthToken; // Your OAuth token
    const clientId = key.twitch.clientId; // Your Client ID
  
    const apiUrl = `https://api.twitch.tv/helix/games?name=${encodeURIComponent(gameName)}`;
  
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${oauthToken}`,
          'Client-ID': clientId,
        },
      });
  
      const data = await response.json();
      if (response.ok && data.data.length > 0) {
        return data.data[0].id; // Return the game ID
      } else {
        console.error(`Game "${gameName}" not found on Twitch.`);
        return null;
      }
    } catch (error) {
      console.error('Failed to fetch game ID:', error);
      return null;
    }
}
  
async function updateStreamGame(newGame) {
    const oauthToken = key.twitch.oauthToken; // Your OAuth token
    const clientId = key.twitch.clientId; // Your Client ID
    const channelId = key.twitch.channelId; // Your channel ID
  
    // First, get the game ID for the specified game name
    const gameId = await getGameId(newGame);
    if (!gameId) {
      console.error('Invalid game name provided, unable to update stream.');
      return;
    }
  
    // Set the API endpoint to update the channel's game
    const apiUrl = `https://api.twitch.tv/helix/channels?broadcaster_id=${channelId}`;
  
    // Create the request body with the valid game ID
    const body = {
      game_id: gameId,
    };
  
    // Send the PATCH request to update the stream game
    try {
      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${oauthToken}`,
          'Client-ID': clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
  
      // Check for a successful response without assuming JSON content
      if (response.ok) {
        console.log(`Successfully updated game to: "${newGame}"`);
        addLogEntry(`Successfully updated game to: "${newGame}"`);
      } else {
        const errorText = await response.text(); // Log the raw error response
        console.error('Error updating game:', errorText);
      }
    } catch (error) {
      console.error('Failed to update game:', error);
    }
}

// HHHHHHHHHHHHHHHHHHHHHHHHHHHERE
function streamInfoUpdate(index){
    console.log(index)
    let currentGame = getDataByIndex(index, "../resources/schedule.json");
    let additionals = readTextFile("../resources/additionals.txt");

    if (additionals != ""){additionals = additionals + " ";}

    updateStreamTitle(readTextFile("../resources/title.txt") + " "
    + additionals
    + "| " + currentGame.Game + " " + currentGame.Category + " by "
    + currentGame.Runner1 + " " + currentGame.Runner2);
}

// ~~~ TWITCH API INTERGRATION END ~~~ //

// ----- STREAMING INTEGRATION ENDS HERE ----- //


//#region BUTTON INTEGRATION
// ----- BUTTON INEGRATION STARTS HERE ----- //
// ~~~ TOP LEFT BUTTONS START ~~~ //

// Get current game data
app.get('/scheduleCurrent', (req, res) => {
    currentGame++;  // Move forward
    handleLogRequest('../resources/schedule.json', currentGame, res);
    streamInfoUpdate(currentGame);
});

// Get next game data
app.get('/scheduleNext', (req, res) => {
    nextGame++;  // Move forward
    handleLogRequest('../resources/schedule.json', nextGame, res);
});

// Get previous current game data (backwards)
app.get('/scheduleCurrentBack', (req, res) => {
    if (currentGame > 0) {
        currentGame--;
        handleLogRequest('../resources/schedule.json', currentGame, res);
        streamInfoUpdate(currentGame);
    } else {
        res.send('No previous game data available');
    }
});

// Get previous next game data (backwards)
app.get('/scheduleNextBack', (req, res) => {
    if (nextGame > 0) {
        nextGame--;
        handleLogRequest('../resources/schedule.json', nextGame, res);
    } else {
        res.send('No previous next game data available');
    }
});
// ~~~ TOP LEFT BUTTONS END ~~~ //

// ~~~ BOTTOM LEFT BUTTONS ~~~ //

// ROW 1
app.get('/commandButtonRow11', (req, res) => {
    changeScene('Transition');
});

app.get('/commandButtonRow12', (req, res) => {
    changeScene('Transition w/ Words on Stream');
});

// ROW 2
app.get('/commandButtonRow21', (req, res) => {
    changeScene('Interview');
});

app.get('/commandButtonRow22', (req, res) => {
    changeScene('Podcast');
});

// ROW 3 | 16:9 SCENES
app.get('/commandButtonRow31', (req, res) => {
    myDebug("/commandButtonRow31 activated");
    changeScene('16:9 One Runner');
})

app.get('/commandButtonRow32', (req, res) => {
    changeScene('16:9 Two Runners');
})

app.get('/commandButtonRow33', (req, res) => {
    changeScene('16:9 Three Runners');
})

app.get('/commandButtonRow34', (req, res) => {
    changeScene('16:9 Four Runners');
})

// ROW 4 | 4:3 SCENES
app.get('/commandButtonRow41', (req, res) => {
    changeScene('4:3 One Runner');
});

app.get('/commandButtonRow42', (req, res) => {
    changeScene('4:3 Two Runners');
});

app.get('/commandButtonRow43', (req, res) => {
    changeScene('4:3 Three Runners');
});

app.get('/commandButtonRow44', (req, res) => {
    changeScene('4:3 Four Runners');
});

// ROW 5 | 3:2 SCENES
app.get('/commandButtonRow51', (req, res) => {
    changeScene('3:2 One Runner');
});

app.get('/commandButtonRow52', (req, res) => {
    changeScene('3:2 Two Runners');
});

app.get('/commandButtonRow53', (req, res) => {
    changeScene('3:2 Three Runners');
});

app.get('/commandButtonRow54', (req, res) => {
    changeScene('3:2 Four Runners');
});

// ROW 6 channel: #dogpoundspeedrunning
app.get('/commandButtonRow61', (req, res) => {
    userCommands("#dogpoundspeedrunning", "!donate")
});

app.get('/commandButtonRow62', (req, res) => {
    userCommands("#dogpoundspeedrunning", "!charity")
});

app.get('/commandButtonRow63', (req, res) => {
    userCommands("#dogpoundspeedrunning", "!socials")
});

app.get('/commandButtonRow64', (req, res) => {
});

app.get('/commandButtonRow65', (req, res) => {
});

app.get('/commandButtonRow66', (req, res) => {
});

app.get('/commandButtonRow67', (req, res) => {
});

app.get('/commandButtonRow68', (req, res) => {
});

app.get('/commandButtonRow69', (req, res) => {
});

app.get('/commandButtonRow610', (req, res) => {
});

// ROW 7
app.get('/commandButtonRow71', (req, res) => {
    generatedKey = generateRandomString(16);
    sendTextToClient('generated-key', generatedKey);
})

app.get('/commandButtonRow72', (req, res) => {
    streamKey1 = generatedKey;
    addLogEntry("Stream Key 1 Updated to: " + generatedKey);
})

app.get('/commandButtonRow73', (req, res) => {
    streamKey2 = generatedKey;
    addLogEntry("Stream Key 2 Updated to: " + generatedKey);
})

app.get('/commandButtonRow74', (req, res) => {
    streamKey3 = generatedKey;
    addLogEntry("Stream Key 3 Updated to: " + generatedKey);
})

app.get('/commandButtonRow75', (req, res) => {
    streamKey4 = generatedKey;
    addLogEntry("Stream Key 4 Updated to: " + generatedKey);
})
// ~~~ BOTTOM LEFT BUTTONS END ~~~ //
// ----- BUTTON INTEGRATION ENDS HERE ----- //
//#endregion

// Function to get data from the JSON file by index



// ----- FILE MANAGEMENT STARTS HERE ----- //

// READ A JSON FILE
function getDataByIndex(index, path) {
    try {
      // Read the JSON file synchronously
      const data = fs.readFileSync(path, 'utf8');
      // Parse JSON data as an array
      const jsonData = JSON.parse(data);
  
      // Check if the index is within the array bounds
      if (index >= 0 && index < jsonData.length) {
        const result = jsonData[index];
        //console.log(`Data at index ${index}:`, result);
        return result;
      } else {
        console.log(`Index ${index} is out of bounds.`);
        return null;
      }
    } catch (error) {
      console.error('Error reading JSON file:', error);
    }
  }

// READ A TXT FILE
function readTextFile(filePath) {
    try {
      // Read the file content synchronously
      const data = fs.readFileSync(filePath, 'utf8');
      console.log('File Contents:', data);
      return data;
    } catch (error) {
      console.error('Error reading file:', error);
    }
  }

// ----- FILE MANAGEMENT ENDS HERE ----- //



// ----- IDK WHERE THIS FITS ----- //

// Handle logging to both the server and frontend
function addLogEntry(message) {
    // Check if there are more than 50 logs
    if (logs.length >= 50) {
        logs.shift(); // Remove the oldest log if there are more than 50
    }
    logs.push(message); // Add the new log entry

    // Emit the log entry to the frontend via WebSocket
    io.emit('newLog', message);
}

// Handle the log request for updating text files
function handleLogRequest(jsonFile, currentLine, response) {
    fs.readFile(jsonFile, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error reading ${jsonFile}:`, err);
            response.status(500).send(`Error reading ${jsonFile}`);
            return;
        }

        const scheduleData = JSON.parse(data);

        if (currentLine < scheduleData.length) {
            const entry = scheduleData[currentLine];
            let formattedData = "";

            // Write each key-value pair to a separate .txt file
            for (const key in entry) {
                if (entry.hasOwnProperty(key)) {
                    formattedData += key + ": " + entry[key] + "\n";

                    const filePath = path.join(__dirname, '../data/info', `current-${key}.txt`);

                    // Ensure the 'info' folder exists or create it
                    const dirPath = path.join(__dirname, '../data/info');
                    if (!fs.existsSync(dirPath)) {
                        fs.mkdirSync(dirPath);
                    }

                    // Write the data to the respective .txt file
                    fs.writeFile(filePath, entry[key] + '\n', (writeErr) => {
                        if (writeErr) {
                            console.error(`Error writing to ${filePath}:`, writeErr);
                        }
                    });

                    // Add log entry for successful file write
                    //addLogEntry(`Data for ${key} written to .txt files`);
                }
            }

            response.send(formattedData);
        } else {
            response.send('No more data to display');
        }
    });
}

// Server route to get the logs
app.get('/logs', (req, res) => {
    res.json(logs); // Send the logs as JSON
});

// ----- POST route for adding logs ----- //
app.post('/add-log', (req, res) => {
    const { message } = req.body;
    
    // Check if message exists
    if (!message) {
        return res.status(400).send('Message is required');
    }

    // Add the log entry to the logs array
    addLogEntry(message); // Call addLogEntry to add the log and emit it via WebSocket

    // Send success response
    res.status(200).send('Log added successfully');
});

function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters[randomIndex];
    }
    
    return result;
  }

  // SEND TEXT TO FRONT
  function sendTextToClient(location, text) {
    io.emit(location, text);
  }
  
  // Set up Socket.IO connection event
  io.on('connection', (socket) => {
    console.log('A client connected:', socket.id);
  
    // Optionally send a welcome message immediately upon connection
    sendTextToClient('Hello from the backend via Socket.IO!');
  
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
// ----- IDK WHERE THIS FITS ENDS ----- //



// ----- MULTER STUFF STARTS HERE ----- //

// Route to handle the download of schedule-template.json
app.get('/templates/schedule-template.json', (req, res) => {
    const filePath = path.join(__dirname, '..', 'resources', 'templates', 'schedule-template.json');
    if (fs.existsSync(filePath)) {
        res.download(filePath, 'schedule-template.json', (err) => {
            if (err) {
                res.status(500).json({ message: 'Error downloading the schedule template' });
            }
        });
    } else {
        res.status(404).json({ message: 'Schedule template not found' });
    }
});

// Route to handle the download of keys-template.json
app.get('/templates/keys-template.json', (req, res) => {
    const filePath = path.join(__dirname, '..', 'resources', 'templates', 'keys-template.json');
    if (fs.existsSync(filePath)) {
        res.download(filePath, 'keys-template.json', (err) => {
            if (err) {
                res.status(500).json({ message: 'Error downloading the keys template' });
            }
        });
    } else {
        res.status(404).json({ message: 'Keys template not found' });
    }
});

// Handle file upload route
app.post('/upload-schedule', upload.single('fileUpload'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    // Define path for the existing schedule.json
    const filePath = path.join(__dirname, '..', 'resources', 'schedule.json');
    
    fs.readFile(req.file.path, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Error reading the uploaded file' });
        }

        try {
            // Validate that it's a valid JSON
            const jsonData = JSON.parse(data);

            // Write the new schedule.json to the resources folder
            fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8', (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Error saving the new schedule' });
                }

                // Remove the temporary file after processing
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error deleting temp file:', err);
                });

                // Respond with success
                return res.json({ message: 'Schedule updated successfully!' });
            });

        } catch (error) {
            return res.status(400).json({ message: 'Invalid JSON file' });
        }
    });
});


// Route to upload the keys.json file
app.post('/upload-keys', upload.single('fileUpload'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    // Define the path where keys.json should be saved
    const filePath = path.join(__dirname, '..', 'resources', 'keys.json');

    // Read the uploaded file
    fs.readFile(req.file.path, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Error reading the uploaded file' });
        }

        try {
            // Ensure the uploaded file is valid JSON
            const jsonData = JSON.parse(data);

            // Save the new keys.json file
            fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8', (err) => {
                if (err) {
                    console.error('Error saving the new keys:', err);
                    return res.status(500).json({ message: 'Error saving the new keys' });
                }

                // Remove the temporary file after processing
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error deleting temp file:', err);
                });

                // Respond with success message
                return res.json({ message: 'Keys updated successfully!' });
            });

        } catch (error) {
            return res.status(400).json({ message: 'Invalid JSON file' });
        }
    });
});
// ----- MULTER STUFF ENDS HERE ----- //



// ----- EXPRESS STUFF STARTS HERE ----- //

// ~~~ URL REDIRECTS START ~~~ //

// Redirect from '/old-page1' to '/new-page1'
app.get('/rtmp1', (req, res) => {
    res.redirect('rtmp://192.168.1.150/live/' + streamKey1);
  });
  
  // Redirect from '/old-page2' to '/new-page2'
  app.get('/rtmp2', (req, res) => {
    res.redirect('rtmp://192.168.1.150/live/' + streamKey2);
  });
  
  // Redirect from '/old-page3' to an external URL
  app.get('/rtmp3', (req, res) => {
    res.redirect('rtmp://192.168.1.150/live/' + streamKey3);
  });
  
  // Redirect from '/old-page4' to '/new-page4' with a permanent 301 status
  app.get('/rtmp4', (req, res) => {
    res.redirect('rtmp://192.168.1.150/live/' + streamKey4);
  });
  
  // Routes for new pages (optional, for testing purposes)
  app.get('/rtmp1', (req, res) => res.send('This is New Page 1'));
  app.get('/rtmp2', (req, res) => res.send('This is New Page 2'));
  app.get('/rtmp3', (req, res) => res.send('This is New Page 3'));
  app.get('/rtmp4', (req, res) => res.send('This is New Page 4'));

  // Route for /admin to serve the admin.html page
    app.get('/admin/upload', (req, res) => {
        res.sendFile(path.join(__dirname, '../Client/', 'upload.html')); // Serve the admin.html file
    });

    // Route for /admin to serve the admin.html page
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../Client/', 'index.html')); // Serve the admin.html file
    });
// ~~~ URL REDIRECTS END ~~~ //

// STARTS THE SERVER
const PORT = process.env.PORT || port;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log()
});