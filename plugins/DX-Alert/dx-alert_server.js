////////////////////////////////////////////////////////////////
///                                                          ///
///  DX ALERT SERVER SCRIPT FOR FM-DX-WEBSERVER (V3.5)       ///
///                                                          ///
///  by Highpoint                last update: 07.11.24       ///
///                                                          ///
///  Thanks to _zer0_gravity_ for the Telegram Code!         ///
///                                                          ///
///  https://github.com/Highpoint2000/DX-Alert               ///
///                                                          ///
////////////////////////////////////////////////////////////////

///  This plugin only works from web server version 1.2.8.1!!!

const path = require('path');
const fs = require('fs');
const http = require('http');
const { logInfo, logError, logDebug } = require('./../../server/console');
const FmlistLogURL = 'http://127.0.0.1:4080/log_fmlist';

// Define the path to the configuration file
const configFilePath = path.join(__dirname, './../../plugins_configs/DX-Alert.json');

// Default values for the configuration file 
// Do not enter this values !!! Save your configuration in configPlugin.json. This is created automatically when you first start.

const defaultConfig = {
    Scanner_URL_PORT: '',			// OPTIONAL: External Webserver URL for Scanner Logfile Download (if plugin installed) e.g. 'http://fmdx.ddns.net:9080'
    AlertFrequency: 30, 			// Frequency for new alerts in minutes, 0 minutes means that every entry found will be sent - only valid if StationModeCanLogServer: '' !
    AlertDistance: 250, 			// Distance for DX alarms in km
	AlertDistanceMax: 2500, 		// Maximum distance for DX alarms in km
	StationMode: 'off',				// Enable Alarm for every new logged TX Station (default: 'off') 
	StationModeCanLogServer: '',	// OPTIONAL: Activates a central server to manage alarm repetitions (e.g. '127.0.0.1:2000', default is '') - only valid if StationMode: 'on' !
    EmailAlert: 'off', 				// Enable email alert feature, 'on' or 'off'
    EmailAddressTo: '', 			// Alternative email address for DX alerts, if the field remains empty, the email address of the web server will be used 
    EmailAddressFrom: '', 			// Sender email address, email address for account
    EmailPassword: '', 				// E-mail password/application-specific password 
    EmailHost: 'smtp.gmail.com', 	// SMTP server for email, e.g. 'smtp.gmail.com' for GMAIL
    EmailPort: '587', 				// Port for email server, e.g. '587' for GMAIL
    EmailSecure: false, 			// Whether to use secure connection (true for port 465, false for other ports)
    TelegramAlert: 'off', 			// Telegram alert feature, 'on' or 'off'
    TelegramToken: '', 				// Telegram bot token
    TelegramChatId: '', 			// Telegram chat ID for sending alerts
	TelegramToken2: '', 			// Telegram bot token 2
    TelegramChatId2: '' 			// Telegram chat ID 2 for sending alerts
};

// Function to merge default config with existing config and remove undefined values
function mergeConfig(defaultConfig, existingConfig) {
    // Only keep the keys that are defined in the defaultConfig
    const updatedConfig = {};

    // Add the existing values that match defaultConfig keys
    for (const key in defaultConfig) {
        updatedConfig[key] = key in existingConfig ? existingConfig[key] : defaultConfig[key];
    }

    return updatedConfig;
}

// Function to load or create the configuration file
function loadConfig(filePath) {
    let existingConfig = {};
    const oldConfigPath = path.join(__dirname, 'configPlugin.json'); // Path to the old configuration file

    // Ensure the directory exists before trying to write the new config file
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Check if the old configuration file exists
    if (fs.existsSync(oldConfigPath)) {
        // Read the old configuration file
        existingConfig = JSON.parse(fs.readFileSync(oldConfigPath, 'utf-8'));
        logInfo('Old configuration found at configPlugin.json. Migrating to new file.');

        // Save the old configuration under the new file path
        fs.writeFileSync(filePath, JSON.stringify(existingConfig, null, 2), 'utf-8');
        
        // Delete the old configuration file
        fs.unlinkSync(oldConfigPath);
        logInfo('Old configuration file configPlugin.json deleted after migration.');
    } else if (fs.existsSync(filePath)) {
        // Read the existing DX-Alert.json configuration file if it already exists
        existingConfig = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } else {
        logInfo('DX-Alert configuration not found. Creating configPlugin.json.');
    }

    // Merge the default config with the existing one, adding missing fields and removing undefined
    const finalConfig = mergeConfig(defaultConfig, existingConfig);

    // Write the updated configuration back to the file (if changes were made)
    fs.writeFileSync(filePath, JSON.stringify(finalConfig, null, 2), 'utf-8');

    return finalConfig;
}

// Load or create the configuration file
const configPlugin = loadConfig(configFilePath);

// Zugriff auf die Variablen
const Scanner_URL_PORT = configPlugin.Scanner_URL_PORT;
  let AlertFrequency = configPlugin.AlertFrequency;
const AlertDistance = configPlugin.AlertDistance;
const AlertDistanceMax = configPlugin.AlertDistanceMax;
const StationMode = configPlugin.StationMode;
const StationModeCanLogServer = configPlugin.StationModeCanLogServer;

const EmailAlert = configPlugin.EmailAlert;
const EmailAddressTo = configPlugin.EmailAddressTo;
const EmailAddressFrom = configPlugin.EmailAddressFrom;
const EmailPassword = configPlugin.EmailPassword;
const EmailHost = configPlugin.EmailHost;
const EmailPort = configPlugin.EmailPort;
const EmailSecure = configPlugin.EmailSecure;

const TelegramAlert = configPlugin.TelegramAlert;
const TelegramToken = configPlugin.TelegramToken;
const TelegramChatId = configPlugin.TelegramChatId;
const TelegramToken2 = configPlugin.TelegramToken2;
const TelegramChatId2 = configPlugin.TelegramChatId2;


////////////////////////////////////////////////////////////////

const config = require('./../../config.json');
const WebSocket = require('ws');

// WebSocket and Server Configuration
const checkInterval = 1000; // Check interval in milliseconds
const clientID = 'Server';
const ServerName = config.identification.tunerName;
const webserverPort = config.webserver.webserverPort || 8080; // Default to port 8080 if not specified
const externalWsUrl = `ws://127.0.0.1:${webserverPort}`;

let currentStatus = 'off';
let lastStatus = 'off';
// Internal Variables
if (EmailAlert === 'on' || TelegramAlert === 'on') {
	currentStatus = 'on'; // Current status of the alert system
	lastStatus = 'on'; // Last known status
}
let lastAlertTime = Date.now(); // Last alert time
let lastAlertMessage = ""; // Last alert message
let TextSocket; // WebSocket connection for text alerts
let message_link;
const sentMessages = new Set(); // Track sent messages to avoid duplicates

// Function to check and install missing NewModules
const { execSync } = require('child_process');
const NewModules = [
    'nodemailer',
];

function checkAndInstallNewModules() {
    NewModules.forEach(module => {
        const modulePath = path.join(__dirname, './../../node_modules', module);
        if (!fs.existsSync(modulePath)) {
            console.log(`Module ${module} is missing. Installing...`);
            try {
                execSync(`npm install ${module}`, { stdio: 'inherit' });
                console.log(`Module ${module} installed successfully.`);
            } catch (error) {
                logError(`Error installing module ${module}:`, error);
                process.exit(1); // Exit the process with an error code
            }
        } else {
            // console.log(`Module ${module} is already installed.`);
        }
    });
}

// Check and install missing NewModules before starting the server
checkAndInstallNewModules();

const nodemailer = require('nodemailer');

// Create a transporter object using SMTP transport
const transporter = nodemailer.createTransport({
	host: EmailHost, 
    port: EmailPort,            
    secure: EmailSecure,         
    auth: {
        user: EmailAddressFrom,
        pass: EmailPassword
    }
});


// Validate email format using regex
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Get a valid email address from config or use provided email
function getValidEmail() {
    // Check if the provided EmailAddressTo is valid
    if (validateEmail(EmailAddressTo)) {
        return EmailAddressTo;
    }

    // If EmailAddressTo is invalid or empty, check config.identification.contact
    if (!EmailAddressTo && validateEmail(config.identification.contact)) {
        return config.identification.contact;
    }

    // If neither is valid, return an empty string
    return '';
}

const ValidEmailAddressTo = getValidEmail();

// If the email is invalid, stop further execution
if (ValidEmailAddressTo === '' && EmailAlert === 'on') {
    logError("DX-Alert No valid email address found. DX ALERT not started.");
    return; // Exit the script with a failure code
}

// Create a status message object
function createMessage(status, source) {
    return {
        type: 'DX-Alert',
        value: {
            status: status,
			EmailAlert: EmailAlert,
            email: ValidEmailAddressTo,
			TelegramAlert: TelegramAlert,
            freq: AlertFrequency,
            dist: AlertDistance,
			distMax: AlertDistanceMax
        },
        source: clientID,
        target: source
    };
}

// Setup the TextSocket WebSocket connection
async function setupTextSocket() {
    if (!TextSocket || TextSocket.readyState === WebSocket.CLOSED) {
        try {
            TextSocket = new WebSocket(externalWsUrl + '/text');

            TextSocket.addEventListener("open", () => {
                logInfo("DX-Alert Text Websocket connected.");
            });

            TextSocket.addEventListener("message", handleTextSocketMessage);

            TextSocket.addEventListener("error", (error) => {
                logError("TextSocket error:", error);
            });

            TextSocket.addEventListener("close", (event) => {
                logInfo("TextSocket closed:", event);
                setTimeout(setupTextSocket, 5000); // Retry connection after 5 seconds
            });

        } catch (error) {
            logError("Failed to setup TextSocket:", error);
            setTimeout(setupTextSocket, 5000); // Retry connection after 5 seconds
        }
    }
}

// Function to fetch and evaluate the LogInterval for DXALERT
async function getLogInterval() {
    try {
        // Send a GET request to the server endpoint
        const response = await fetch(`http://${StationModeCanLogServer}/loginterval/dxalert`);

        // Check if the request was successful
        if (!response.ok) {
            throw new Error(`HTTP-Error! Status: ${response.status}`);
        }

        // Parse the JSON object from the server response
        const data = await response.json();

        // Access and use the LogInterval_DXALERT value
        const logIntervalDXALERT = data.LogInterval_DXALERT;
        // LogInfo(`The LogInterval for DXALERT is: ${logIntervalDXALERT} minutes`);
		AlertFrequency = logIntervalDXALERT;
		
		if (currentStatus === 'on' && EmailAlert === 'on' && TelegramAlert === 'on') {
			logInfo(`DX-Alert broadcast Telegram & Email Status "${currentStatus}" (Email: ${ValidEmailAddressTo} / Distance: ${AlertDistance}-${AlertDistanceMax} km / Frequency: ${AlertFrequency} min. by CanLogServer ${StationModeCanLogServer})`);
			} else if (currentStatus === 'on' && EmailAlert === 'on') {
					logInfo(`DX-Alert broadcast "${currentStatus}" (Email: ${ValidEmailAddressTo} / Distance: ${AlertDistance}-${AlertDistanceMax} km / Frequency: ${AlertFrequency} min. by CanLogServer ${StationModeCanLogServer})`);
				} else if (currentStatus === 'on' && TelegramAlert === 'on') {
						logInfo(`DX-Alert broadcast Telegramm "${currentStatus}" (Distance: ${AlertDistance}-${AlertDistanceMax} km / Frequency: ${AlertFrequency} min. by CanLogServer ${StationModeCanLogServer})`);
					} else {
						logInfo(`DX-Alert all services are turned off`);
					}	
       
    } catch (error) {
        logError('DX-Alert Error fetching the LogInterval:', error);
    }
}


// Server function to check if the ID has been logged recently
async function CanLogServer(id) {
    try {
        // Send a POST request to the Express server
        const response = await fetch(`http://${StationModeCanLogServer}/dxalert/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Check the HTTP status code
        if (response.ok) {
            return true; // Exit if the station was logged recently
        } else {
            // If the response is not OK, log the error message
            // logInfo(`${id} was already recently logged on CanLogServer`);
            return false; // Exit if the station was logged recently
        }
    } catch (error) {
        // If the server is unreachable, this block will be executed
        logError(`Scanner error: CanLogServer ${StationModeCanLogServer} is unreachable`);
        return false; // Station was not logged
    }
}

const logHistory = {};

// Funktion, um zu überprüfen, ob die ID in den letzten 60 Minuten protokolliert wurde
function canLog(id) {
	
    const now = Date.now();
	if (AlertFrequency === '' || AlertFrequency === undefined) {
		AlertFrequency = 60
	}
    const sixtyMinutes = 60 * AlertFrequency * 1000; // 60 Minuten in Millisekunden
    if (logHistory[id] && (now - logHistory[id]) < sixtyMinutes) {
        return false; // Protokollierung verweigern, wenn weniger als 60 Minuten vergangen sind
    }
    logHistory[id] = now; // Aktualisiere mit dem aktuellen Zeitstempel
    return true;
}

// Handle incoming WebSocket messages
let processingAlert = false;
let firstAlert = true;

async function handleTextSocketMessage(event) {
    try {
        const eventData = JSON.parse(event.data);
        const { freq: frequency, pi: picode, txInfo } = eventData;
        const { tx: station, city, itu, id, dist: distance } = txInfo || {};

        if (currentStatus === 'off') {
            resetAlertStatus();
            return;
        }

        if (currentStatus === 'on' && distance > AlertDistance && distance < AlertDistanceMax) {
            if (processingAlert) return;					
			
            const now = Date.now();
            const elapsedMinutes = Math.floor((now - lastAlertTime) / 60000);

            const subject = `DX Alert ${ServerName} received ${station}[${itu}] from ${distance} km away!!! `;
            let message = `${ServerName} received station ${station} on ${frequency} MHz with PI: ${picode} from ${city} in [${itu}] which is ${distance} km away. `;
			
			let IDcheck = false;
	  
			if (StationModeCanLogServer && StationMode === 'on') {
				const canLogResult = await CanLogServer(id); // Wait for the result from CanLogServer
				if (canLogResult) {
					IDcheck = true; 
				}
			}
			
			if (!StationModeCanLogServer && StationMode === 'on') {
				if (canLog(id) && StationMode === 'on') {
					IDcheck = true; 
				}
			}
			
			if (IDcheck || (StationMode === 'off' && (firstAlert || shouldSendAlert(elapsedMinutes, message)))) { // Send the alert immediately on the first occurrence, then respect the time interval for subsequent alerts
					
                processingAlert = true;
                firstAlert = false; // Set the flag to false after the first alert is sent

                message_link = message;

                if (Scanner_URL_PORT !== '') {
                    const currentDate = new Date().toISOString().slice(0, 10); // Current date in 'YYYY-MM-DD' format
                    const previousDate = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().slice(0, 10); // Previous date in 'YYYY-MM-DD' format

                    // Construct filenames for current and previous dates
                    const fileNameCurrent = `SCANNER_${currentDate}_filtered.html`;
                    const fileNamePrevious = `SCANNER_${previousDate}_filtered.html`;

                    // Construct URLs for both current and previous date files
                    const fileURLCurrent = `${Scanner_URL_PORT}/logs/${fileNameCurrent}`;
                    const fileURLPrevious = `${Scanner_URL_PORT}/logs/${fileNamePrevious}`;

                    try {
                        // Make both requests simultaneously
                        const [responseCurrent, responsePrevious] = await Promise.all([
                            fetch(fileURLCurrent, { method: 'HEAD' }),
                            fetch(fileURLPrevious, { method: 'HEAD' })
                        ]);

                        // Check if either file exists
                        if (responseCurrent.ok) {
                            logDebug(`DX-Alert Logfile: ${fileURLCurrent}`);
                            message_link = message + "\n\nLogfile: " + fileURLCurrent;
                        } else if (responsePrevious.ok) {
                            message_link = message + "\n\nLogfile: " + fileURLPrevious;
                            logDebug(`DX-Alert Logfile: ${fileURLPrevious}`);
                        } else {
                            message_link = message + `\n\nLogfile not available for current or previous date.`;
                            logDebug(`DX-Alert Logfile not available for current or previous date`);
                        }
                    } catch (error) {
                        logError("DX-Alert Error checking file availability:", error);
                    }
                }

                if (EmailAlert === 'on') {
                    sendEmail(subject, message_link);
                }
                if (TelegramAlert === 'on') {
                    sendTelegram(subject, message_link);
                }
                logInfo(subject);
                lastAlertTime = now;
                lastAlertMessage = message;

                setTimeout(() => processingAlert = false, 1000); // Reset processing flag after delay
			}
           
        }
    } catch (error) {
        logError("DX-Alert Error handling TextSocket message:", error);
    }
}

// Determine if a new email alert should be sent
function shouldSendAlert(elapsedMinutes, message) {
    return (elapsedMinutes >= AlertFrequency) && (message !== lastAlertMessage);
}

// Reset alert status when the system is turned off
function resetAlertStatus() {
    lastAlertTime = 0;
    lastAlertMessage = "";
    processingAlert = false;
}

// Function to send email using EmailJS
function sendEmail(subject, message, source) {
	
	const mailOptions = {
		from: EmailAddressFrom,
		to: ValidEmailAddressTo,
		subject: subject,
		text: message,
	};
	
	transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.log('Error occurred:', error);
		sendWebSocketNotification('error', subject, message, source);
    }
    // console.log('Email sent:', info.response);
	handleEmailResponse(subject, message, source);
	});
}

// Handle email response
function handleEmailResponse(subject, message, source) {
    if (subject === 'DX ALERT Test') {
        logInfo(`DX-Alert responding with email test success`);
        sendWebSocketNotification('success', subject, message, source);
		console.log('a');
    } else {
        logInfo(`DX-Alert email sent to ${ValidEmailAddressTo}`);
        sendWebSocketNotification('sent', subject, message, source);
    }
}

// Function to send message to Telegram
function sendTelegram(subject, message, source) {
	
    fetch('https://api.telegram.org/bot' + TelegramToken + '/sendMessage?chat_id=' + TelegramChatId + '&text=' + message)
        .then(response => {
            if (response.ok) {
                handleTelegramResponse(subject, message, source);
            } else {
                return response.text().then(errorText => {
                    sendWebSocketNotification('error', message, source);
                    throw new Error('Failed to send Telegram message. Error: ' + errorText);
                });
            }
        })
        .catch(error => logError(error.message));
		
	if (TelegramToken2 !== '' && TelegramChatId2 !== '') {
			
		 fetch('https://api.telegram.org/bot' + TelegramToken2 + '/sendMessage?chat_id=' + TelegramChatId2 + '&text=' + message)
        .then(response => {
            if (response.ok) {
                handleTelegramResponse(subject, message, source);
            } else {
                return response.text().then(errorText => {
                    sendWebSocketNotification('error', message, source);
                    throw new Error('Failed to send Telegram message. Error: ' + errorText);
                });
            }
        })
        .catch(error => logError(error.message));
	}
}

// Handle Telegram response
function handleTelegramResponse(subject, message, source) {
    if (subject === 'DX ALERT Test') {
        logInfo(`DX-Alert responding with Telegram test success`);
        sendWebSocketNotification('success', subject, message, source);
				console.log('b');
    } else {
        logInfo(`DX-Alert Message sent to Telegram`);
        sendWebSocketNotification('sent', subject, message, source);
    }
}

// Send a WebSocket notification
function sendWebSocketNotification(status, subject, message, source) {
    if (data_pluginsWs && data_pluginsWs.readyState === WebSocket.OPEN) {
        const notification = {
            type: 'DX-Alert',
            value: {
                status: status,
				EmailAlert: EmailAlert,
				email: ValidEmailAddressTo,
				TelegramAlert: TelegramAlert,
                subject: subject,
                message: message,
            },
            source: clientID,
            target: source
        };
        try {
            data_pluginsWs.send(JSON.stringify(notification));
        } catch (error) {
            logError("DX-Alert Error sending WebSocket notification:", error);
        }
    } else {
        logError("DX-Alert data_plugins WebSocket is not open or not defined.");
    }
}

// Connect to the main WebSocket server
function connectToWebSocket() {
    if (EmailAlert === 'on' && !ValidEmailAddressTo.includes('@')) {
        logError("Email Address not set or invalid format! DX ALERT not started.");
        return;
    }

    const ws = new WebSocket(externalWsUrl + '/data_plugins');

    ws.on('open', () => {
        // logInfo(`DX-Alert connected to ${ws.url}`);
        ws.send(JSON.stringify(createMessage(currentStatus, '000000000000'))); // Send initial status
        // Delay the logging of broadcast info by 100 ms
        setTimeout(() => {
            logBroadcastInfo();
        }, 100);

    });

    ws.on('message', (data) => handleWebSocketMessage(data, ws));

    ws.on('error', (error) => logError('DX-Alert WebSocket error:', error));

    ws.on('close', (code, reason) => {
        logInfo(`WebSocket connection closed. Code: ${code}, Reason: ${reason}`);
        setTimeout(connectToWebSocket, Math.min(5000 * 2 ** sentMessages.size, 30000)); // Exponential backoff
    });

    // Setup data_plugins WebSocket connection for additional features
    setupdata_pluginsWebSocket();
}

// Log broadcast information based on current status
function logBroadcastInfo() {
		if (StationModeCanLogServer && StationMode === 'on') {
			getLogInterval();
		} else {
			if (currentStatus === 'on' && EmailAlert === 'on' && TelegramAlert === 'on') {
				logInfo(`DX-Alert broadcast Telegram & Email Status "${currentStatus}" (Email: ${ValidEmailAddressTo} / Distance: ${AlertDistance}-${AlertDistanceMax} km / Frequency: ${AlertFrequency} min.)`);
				} else if (currentStatus === 'on' && EmailAlert === 'on') {
					logInfo(`DX-Alert broadcast "${currentStatus}" (Email: ${ValidEmailAddressTo} / Distance: ${AlertDistance}-${AlertDistanceMax} km / Frequency: ${AlertFrequency} min.)`);
					} else if (currentStatus === 'on' && TelegramAlert === 'on') {
						logInfo(`DX-Alert broadcast Telegramm "${currentStatus}" (Distance: ${AlertDistance}-${AlertDistanceMax} km / Frequency: ${AlertFrequency} min.)`);
						} else {
							logInfo(`DX-Alert all services are turned off`);
						}
		}
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(data, ws) {
    try {
        const message = JSON.parse(data.toString());

        if (message.source === clientID) return; // Ignore messages from self

        if (message.type === 'DX-Alert') {
            handleDXAlertMessage(message, ws);
        }
    } catch (error) {
        logError('DX-Alert Error processing WebSocket message:', error);
    }
}

// Handle DX-Alert specific WebSocket messages
function handleDXAlertMessage(message, ws) {
    const { status } = message.value;

    if (status === 'request') {
		if (EmailAlert === 'on' || TelegramAlert === 'on') { 
			ws.send(JSON.stringify(createMessage(currentStatus, message.source)));
		} else {
			ws.send(JSON.stringify(createMessage('off', message.source)));
		}
		} else if (status === 'test') {
			logInfo(`${message.type} received "${status}" from ${message.source}`);
			if (EmailAlert === 'on') {
				sendEmail(message.value.subject, message.value.message, message.source);
			}
			if (TelegramAlert === 'on') {
				sendTelegram(message.value.subject, `${ServerName} sent a Telegram test message!!! The current alert status is ${currentStatus}.`, message.source);
			}	
			} else if (status === 'on') {
				logInfo(`${message.type} received "${status}" from ${message.source}`);
				if (EmailAlert === 'on' || TelegramAlert === 'on') { 
					ws.send(JSON.stringify(createMessage(currentStatus, message.source)));
					logInfo(`${message.type} responding with "${status}"`);
					currentStatus = status;
				} else {
					ws.send(JSON.stringify(createMessage('off', message.source)));
					logInfo(`${message.type} responding with "off"`);
					currentStatus = 'off';
				}
				ws.send(JSON.stringify(createMessage(currentStatus, '000000000000')));        
			} else if (status === 'off') {
					ws.send(JSON.stringify(createMessage('off', message.source)));
					logInfo(`${message.type} responding with "off"`);
					currentStatus = 'off';
			}
}

// Set up a separate connection for the /data_plugins WebSocket endpoint
function setupdata_pluginsWebSocket() {
    data_pluginsWs = new WebSocket(`ws://127.0.0.1:${webserverPort}/data_plugins`);

    data_pluginsWs.on('open', () => {
        logInfo("DX-Alert data_plugins WebSocket connected.");
    });

    data_pluginsWs.on('error', (error) => logError("DX-Alert data_plugins WebSocket error:", error));

    data_pluginsWs.on('close', (event) => {
        logInfo("data_plugins WebSocket closed:", event);
        setTimeout(setupdata_pluginsWebSocket, 5000); // Retry connection after 5 seconds
    });
}

// Initialize connections after a delay
setTimeout(setupTextSocket, 1000);
setTimeout(connectToWebSocket, 1000);
if (StationMode === 'on') {
	logInfo('DX-Alert station mode is active.');
}
