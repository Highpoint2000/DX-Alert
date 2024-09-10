////////////////////////////////////////////////////////////////
///                                                          ///
///  DX ALERT SERVER SCRIPT FOR FM-DX-WEBSERVER (V3.1a)      ///
///                                                          ///
///  by Highpoint                last update: 10.09.24       ///
///                                                          ///
///  Thanks to _zer0_gravity_ for the Telegram Code!         ///
///                                                          ///
///  https://github.com/Highpoint2000/DX-Alert               ///
///                                                          ///
////////////////////////////////////////////////////////////////

///  This plugin only works from web server version 1.2.6!!!

const path = require('path');
const fs = require('fs');
const { logInfo, logError } = require('./../../server/console');

// Define the path to the configuration file
const configFilePath = path.join(__dirname, 'configPlugin.json');

// Default values for the configuration file 
// Do not enter this values !!! Save your configuration in configPlugin.json. This is created automatically when you first start.

const defaultConfig = {
    Scanner_URL_PORT: '',			// OPTIONAL: External Webserver URL for Scanner Logfile Download (if plugin installed) e.g. 'http://fmdx.ddns.net:9080'
    AlertFrequency: 30, 			// Frequency for new alerts in minutes, 0 minutes means that every entry found will be sent 
    AlertDistance: 250, 			// Distance for DX alarms in km
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

    // Check if the configuration file exists
    if (fs.existsSync(filePath)) {
        // Read the existing configuration file
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
const AlertFrequency = configPlugin.AlertFrequency;
const AlertDistance = configPlugin.AlertDistance;

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
    logError("DX-Alert: No valid email address found. DX ALERT not started.");
    process.exit(1); // Exit the script with a failure code
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
            dist: AlertDistance
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

// Handle incoming WebSocket messages
let processingAlert = false;

async function handleTextSocketMessage(event) {
    try {
        const eventData = JSON.parse(event.data);
        const { freq: frequency, pi: picode, txInfo } = eventData;
        const { tx: station, city, itu, dist: distance } = txInfo || {};

        if (currentStatus === 'off') {
            resetAlertStatus();
            return;
        }

        if (currentStatus === 'on' && distance > AlertDistance) {
            if (processingAlert) return;

            const now = Date.now();
            const elapsedMinutes = Math.floor((now - lastAlertTime) / 60000);
			const subject = `DX Alert: ${ServerName} received ${station}[${itu}] from ${distance} km away!!! `;
            let message = `${ServerName} received station ${station} on ${frequency} MHz with PI: ${picode} from ${city} in [${itu}] which is ${distance} km away. `;
				
			if (Scanner_URL_PORT !== '') {
				const currentDate = new Date().toISOString().slice(0, 10); // Current date in 'YYYY-MM-DD' format

				// Calculate the previous date
				const previousDate = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().slice(0, 10); // Previous date in 'YYYY-MM-DD' format

				// Construct filenames for current and previous dates
				const fileNameCurrent = `SCANNER_${currentDate}_filtered.html`;
				const fileNamePrevious = `SCANNER_${previousDate}_filtered.html`;

				// Construct URLs for both current and previous date files
				const fileURLCurrent = `${Scanner_URL_PORT}/logs/${fileNameCurrent}`;
				const fileURLPrevious = `${Scanner_URL_PORT}/logs/${fileNamePrevious}`;

				try {
				// Check if the current date file exists
				const responseCurrent = await fetch(fileURLCurrent, { method: 'HEAD' });
				if (responseCurrent.ok) {
					message += `\n\nLogfile: ${fileURLCurrent}`;
				} else {
					// If current date file does not exist, check for the previous date file
					const responsePrevious = await fetch(fileURLPrevious, { method: 'HEAD' });
					if (responsePrevious.ok) {
						message += `\n\nLogfile: ${fileURLPrevious}`;
					} else {
						message += `\n\nLogfile not available for current or previous date.`;
					}
				}
			} catch (error) {
				logError("DX-Alert: Error checking file availability:", error);
			}
		}

            if (shouldSendAlert(elapsedMinutes, message)) {
                processingAlert = true;
                if (EmailAlert === 'on') {
                    sendEmail(subject, message);
                }
                if (TelegramAlert === 'on') {
                    sendTelegram(subject, message);
                }
                logInfo(subject);
                lastAlertTime = now;
                lastAlertMessage = message;

                setTimeout(() => processingAlert = false, 1000); // Reset processing flag after delay
            }
        }
    } catch (error) {
        logError("DX-Alert: Error handling TextSocket message:", error);
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
    if (extraWs && extraWs.readyState === WebSocket.OPEN) {
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
            extraWs.send(JSON.stringify(notification));
        } catch (error) {
            logError("DX-Alert: Error sending WebSocket notification:", error);
        }
    } else {
        logError("DX-Alert: Extra WebSocket is not open or not defined.");
    }
}

// Connect to the main WebSocket server
function connectToWebSocket() {
    if (EmailAlert === 'on' && !ValidEmailAddressTo.includes('@')) {
        logError("Email Address not set or invalid format! DX ALERT not started.");
        return;
    }

    const ws = new WebSocket(externalWsUrl + '/extra');

    ws.on('open', () => {
        // logInfo(`DX-Alert connected to ${ws.url}`);
        ws.send(JSON.stringify(createMessage(currentStatus, '000000000000'))); // Send initial status
        // Delay the logging of broadcast info by 100 ms
        setTimeout(() => {
            logBroadcastInfo();
        }, 100);

    });

    ws.on('message', (data) => handleWebSocketMessage(data, ws));

    ws.on('error', (error) => logError('DX-Alert: WebSocket error:', error));

    ws.on('close', (code, reason) => {
        logInfo(`WebSocket connection closed. Code: ${code}, Reason: ${reason}`);
        setTimeout(connectToWebSocket, Math.min(5000 * 2 ** sentMessages.size, 30000)); // Exponential backoff
    });

    // Setup extra WebSocket connection for additional features
    setupExtraWebSocket();
}

// Log broadcast information based on current status
function logBroadcastInfo() {
	if (currentStatus === 'on' && EmailAlert === 'on' && TelegramAlert === 'on') {
		logInfo(`DX-Alert broadcast Telegram & Email Status "${currentStatus}" (Email: ${ValidEmailAddressTo} / Distance: ${AlertDistance} km / Frequency: ${AlertFrequency} min.)`);
	} else if (currentStatus === 'on' && EmailAlert === 'on') {
		logInfo(`DX-Alert broadcast "${currentStatus}" (Email: ${ValidEmailAddressTo} / Distance: ${AlertDistance} km / Frequency: ${AlertFrequency} min.)`);
		} else if (currentStatus === 'on' && TelegramAlert === 'on') {
			logInfo(`DX-Alert broadcast Telegramm "${currentStatus}" (Distance: ${AlertDistance} km / Frequency: ${AlertFrequency} min.)`);
			} else {
				logInfo(`DX-Alert all services are turned off`);
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
        logError('DX-Alert: Error processing WebSocket message:', error);
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

// Set up a separate connection for the /extra WebSocket endpoint
function setupExtraWebSocket() {
    extraWs = new WebSocket(`ws://127.0.0.1:${webserverPort}/extra`);

    extraWs.on('open', () => {
        logInfo("DX-Alert Extra WebSocket connected.");
    });

    extraWs.on('error', (error) => logError("DX-Alert: Extra WebSocket error:", error));

    extraWs.on('close', (event) => {
        logInfo("Extra WebSocket closed:", event);
        setTimeout(setupExtraWebSocket, 5000); // Retry connection after 5 seconds
    });
}

// Initialize connections after a delay
setTimeout(setupTextSocket, 1000);
setTimeout(connectToWebSocket, 1000);
