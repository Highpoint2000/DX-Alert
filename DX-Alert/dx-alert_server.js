////////////////////////////////////////////////////////////////
///                                                          ///
///  DX ALERT SERVER SCRIPT FOR FM-DX-WEBSERVER (V3.7)      ///
///                                                          ///
///  by Highpoint                last update: 18.02.26       ///
///                                                          ///
///  Thanks to _zer0_gravity_ for the Telegram Code!         ///
///                                                          ///
///  https://github.com/Highpoint2000/DX-Alert               ///
///                                                          ///
////////////////////////////////////////////////////////////////

///  This plugin only works from web server version 1.3.5 !!!

// Import necessary modules
const path = require('path');
const fs = require('fs');
const http = require('http');
const { logInfo, logError, logDebug } = require('./../../server/console');

// Load main config.json earlier to get port for screenshot URL
const config = require('./../../config.json');

// Sanitize input by encoding critical characters for safe usage
function sanitizeInput(input) {
    return encodeURIComponent(input);
}

// Define the path to the configuration file
const configFilePath = path.join(__dirname, './../../plugins_configs/DX-Alert.json');

// Default values for the configuration file
const defaultConfig = {
    Scanner_URL_PORT: '',					// OPTIONAL: External Webserver URL for Scanner Logfile Download
    AlertFrequency: 30,						// Frequency for new alerts in minutes
    AlertDistance: 250,						// Distance for DX alarms in km
    AlertDistanceMax: 2500,					// Maximum distance for DX alarms in km
    StationMode: 'off',						// Set it 'on' to enable alarm for every new logged TX Station
    StationModeCanLogServer: '',			// OPTIONAL: Activates a central server to manage alarm repetitions
    EnableBacklist: false,					// Set it to true if you use a blacklist.txt
    ScreenshotAlert: 'off',                 // Enable screenshot feature
    ScreenshotWidth: 1280,                  // Width of the screenshot
    ScreenshotHeight: 900,                  // Height of the screenshot
    EmailAlert: 'off',						// Enable email alert feature
    EmailAddressTo: '',						// Alternative email address(es) for DX alerts (comma separated)
    EmailAddressFrom: '',					// Sender email address
    EmailSenderName: '',					// Optional: Sender name
    EmailUsername: '', 						// Optional: SMTP username
    EmailPassword: '', 						// SMTP password
    EmailHost: 'smtp.gmail.com',			// SMTP server
    EmailPort: '587',						// SMTP port
    EmailSecure: false,						// Secure connection
    TelegramAlert: 'off',					// Telegram alert feature
    TelegramToken: '',						// Telegram bot token
    TelegramChatId: '',						// Telegram chat ID
    TelegramToken2: '',						// Telegram bot token 2
    TelegramChatId2: ''						// Telegram chat ID 2
};

// Function to merge default configuration with an existing configuration
function mergeConfig(defaultConfig, existingConfig) {
    const updatedConfig = {};
    for (const key in defaultConfig) {
        updatedConfig[key] = key in existingConfig ? existingConfig[key] : defaultConfig[key];
    }
    return updatedConfig;
}

// Function to load or create the configuration file
function loadConfig(filePath) {
    let existingConfig = {};
    const oldConfigPath = path.join(__dirname, 'configPlugin.json');

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(oldConfigPath)) {
        existingConfig = JSON.parse(fs.readFileSync(oldConfigPath, 'utf-8'));
        logInfo('Old configuration found at configPlugin.json. Migrating to new file.');
        fs.writeFileSync(filePath, JSON.stringify(existingConfig, null, 2), 'utf-8');
        fs.unlinkSync(oldConfigPath);
        logInfo('Old configuration file configPlugin.json deleted after migration.');
    } else if (fs.existsSync(filePath)) {
        existingConfig = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } else {
        logInfo('DX-Alert configuration not found. Creating configPlugin.json.');
    }

    const finalConfig = mergeConfig(defaultConfig, existingConfig);
    fs.writeFileSync(filePath, JSON.stringify(finalConfig, null, 2), 'utf-8');
    return finalConfig;
}

const configPlugin = loadConfig(configFilePath);

// Helper function to check the blacklist
function shouldTriggerAlarmBasedOnBlacklist(frequency, pi) {
    if (!configPlugin.EnableBacklist) {
        return true; // Blacklist checking is disabled
    }
    const blacklistPath = path.join(__dirname, 'blacklist.txt');
    if (!fs.existsSync(blacklistPath)) {
        return true; // If no blacklist exists, trigger the alarm
    }
    try {
        const data = fs.readFileSync(blacklistPath, 'utf8');
        const lines = data.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
        const fullEntry = frequency + ';' + pi;
        // Check if the exact combination exists
        if (lines.includes(fullEntry)) {
            return false;
        }
        // Check if only the frequency exists
        if (lines.includes(String(frequency))) {
            return false;
        }
        return true;
    } catch (err) {
        logError("Error reading blacklist:", err);
        return true;
    }
}

const Scanner_URL_PORT = configPlugin.Scanner_URL_PORT;
let AlertFrequency = configPlugin.AlertFrequency;
const AlertDistance = configPlugin.AlertDistance;
const AlertDistanceMax = configPlugin.AlertDistanceMax;
const StationMode = configPlugin.StationMode;
const StationModeCanLogServer = configPlugin.StationModeCanLogServer;

const ScreenshotAlert = configPlugin.ScreenshotAlert || 'off';
const ScreenshotWidth = configPlugin.ScreenshotWidth || 1920;
const ScreenshotHeight = configPlugin.ScreenshotHeight || 1080;

const EmailAlert = configPlugin.EmailAlert;
const EmailAddressTo = configPlugin.EmailAddressTo;
const EmailAddressFrom = configPlugin.EmailAddressFrom;
const EmailSenderName = configPlugin.EmailSenderName;
const EmailUsername = configPlugin.EmailUsername;
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

const WebSocket = require('ws');

const clientID = 'Server';
const ServerName = sanitizeInput(config.identification.tunerName).replace(/%20/g, ' ');
const webserverPort = config.webserver.webserverPort || 8080;
const externalWsUrl = `ws://127.0.0.1:${webserverPort}`;

let currentStatus = 'off';
if (EmailAlert === 'on' || TelegramAlert === 'on') {
    currentStatus = 'on';
}
let lastAlertTime = Date.now();
let lastAlertMessage = "";
let TextSocket;
let message_link;
const sentMessages = new Set();

const { execSync } = require('child_process');

// Determine modules to install
const NewModules = ['nodemailer', 'form-data', 'node-fetch'];

// Only add puppeteer if screenshot feature is enabled
if (ScreenshotAlert === 'on') {
    NewModules.push('puppeteer');
}

// Check if blacklist is enabled and the blacklist.txt file exists
const blacklistFilePath = path.join(__dirname, 'blacklist.txt');
if (configPlugin.EnableBacklist && fs.existsSync(blacklistFilePath)) {
    logInfo("DX-Alert activate blacklist.");
}

function checkAndInstallNewModules() {
    NewModules.forEach(module => {
        // Handle puppeteer specifically as it might be required differently or already present in some environments
        let checkName = module;
        if(module === 'node-fetch') checkName = 'node-fetch'; // Just to be explicit

        const modulePath = path.join(__dirname, './../../node_modules', checkName);
        
        // Simple check if module exists
        try {
             require.resolve(module);
        } catch (e) {
             if (!fs.existsSync(modulePath)) {
                console.log(`Module ${module} is missing. Installing...`);
                try {
                    execSync(`npm install ${module}`, { stdio: 'inherit' });
                    console.log(`Module ${module} installed successfully.`);
                } catch (error) {
                    logError(`Error installing module ${module}:`, error);
                    // Do not exit process, try to continue
                }
            }
        }
    });
}

checkAndInstallNewModules();

// Require Puppeteer after check, only if enabled
let puppeteer;
if (ScreenshotAlert === 'on') {
    try {
        puppeteer = require('puppeteer');
    } catch (e) {
        logError("Puppeteer could not be loaded. Screenshot feature will be disabled.");
    }
}

// Require FormData and Fetch for Telegram Photos
const FormData = require('form-data');
const fetch = require('node-fetch'); // Ensure node-fetch is used for Telegram uploads

// Nodemailer configuration
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: EmailHost,
    port: EmailPort,
    secure: EmailSecure,
    auth: {
        user: configPlugin.EmailUsername || configPlugin.EmailAddressFrom, // Use the EmailUsername for authentication
        pass: EmailPassword
    }
});

// Validate one or more email addresses
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Check for comma separated list
    if (email.includes(',')) {
        const emails = email.split(',');
        // All parts must be valid
        return emails.every(e => re.test(e.trim()));
    }
    
    return re.test(email.trim());
}

// Get valid email string (single or comma-separated)
function getValidEmail() {
    if (EmailAddressTo) {
        // Split, clean, and validate
        const emails = EmailAddressTo.split(/[,;]/).map(e => e.trim()).filter(e => e !== '');
        const validEmails = emails.filter(email => {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        });
        
        if (validEmails.length > 0) {
            return validEmails.join(', ');
        }
    }
    
    // Fallback to webserver contact
    const contact = config.identification.contact;
    if (contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
        return contact;
    }
    
    return '';
}

const ValidEmailAddressTo = getValidEmail();

// Check if valid email exists
if (ValidEmailAddressTo === '' && EmailAlert === 'on') {
    logError("DX-Alert: No valid email address found. DX ALERT not started for Email.");
}

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

async function setupTextSocket() {
    if (!TextSocket || TextSocket.readyState === WebSocket.CLOSED) {
        try {
            TextSocket = new WebSocket(externalWsUrl + '/text');
            TextSocket.addEventListener("open", () => logInfo("DX-Alert Text WebSocket connected."));
            TextSocket.addEventListener("message", handleTextSocketMessage);
            TextSocket.addEventListener("error", (error) => logError("TextSocket error:", error));
            TextSocket.addEventListener("close", () => {
                logInfo("TextSocket closed.");
                setTimeout(setupTextSocket, 5000);
            });
        } catch (error) {
            logError("Failed to setup TextSocket:", error);
            setTimeout(setupTextSocket, 5000);
        }
    }
}

// Function to fetch and update the LogInterval for DX-Alert
async function getLogInterval() {
    try {
        const response = await fetch(`http://${StationModeCanLogServer}/loginterval/dxalert`);

        if (!response.ok) {
            throw new Error(`HTTP Error! Status: ${response.status}`);
        }

        const data = await response.json();
        const logIntervalDXALERT = data.LogInterval_DXALERT;
        AlertFrequency = logIntervalDXALERT;
		
		if (currentStatus === 'on' && EmailAlert === 'on' && TelegramAlert === 'on') {
			logInfo(`DX-Alert broadcasting Telegram & Email Status "${currentStatus}" (Email: ${ValidEmailAddressTo} / Distance: ${AlertDistance}-${AlertDistanceMax} km / Frequency: ${AlertFrequency} min. via CanLogServer ${StationModeCanLogServer})`);
		} else if (currentStatus === 'on' && EmailAlert === 'on') {
			logInfo(`DX-Alert broadcasting "${currentStatus}" (Email: ${ValidEmailAddressTo} / Distance: ${AlertDistance}-${AlertDistanceMax} km / Frequency: ${AlertFrequency} min. via CanLogServer ${StationModeCanLogServer})`);
		} else if (currentStatus === 'on' && TelegramAlert === 'on') {
			logInfo(`DX-Alert broadcasting Telegram "${currentStatus}" (Distance: ${AlertDistance}-${AlertDistanceMax} km / Frequency: ${AlertFrequency} min. via CanLogServer ${StationModeCanLogServer})`);
		} else {
			logInfo(`DX-Alert: all services are turned off`);
		}	
       
    } catch (error) {
        logError('DX-Alert Error fetching the LogInterval:', error);
    }
}

// Server function to check if the ID has been logged recently
async function CanLogServer(id) {
    try {
        const response = await fetch(`http://${StationModeCanLogServer}/dxalert/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            return true; // Station was logged recently
        } else {
            return false;
        }
    } catch (error) {
        logError(`Scanner error: CanLogServer ${StationModeCanLogServer} is unreachable`);
        return false;
    }
}

const logHistory = {};

// Function to check if the ID has been logged in the last AlertFrequency minutes
function canLog(id) {
    const now = Date.now();
	if (AlertFrequency === '' || AlertFrequency === undefined) {
		AlertFrequency = 60;
	}
    const alertIntervalMs = AlertFrequency * 60 * 1000;
    if (logHistory[id] && (now - logHistory[id]) < alertIntervalMs) {
        return false;
    }
    logHistory[id] = now;
    return true;
}

// Determine if there is a blacklist hit
function getBlacklistMatchType(frequency, pi) {
    if (!configPlugin.EnableBacklist) {
        return "none";
    }
    const blacklistPath = path.join(__dirname, 'blacklist.txt');
    if (!fs.existsSync(blacklistPath)) {
        return "none";
    }
    try {
        const data = fs.readFileSync(blacklistPath, 'utf8');
        const lines = data.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
        const fullEntry = frequency + ';' + pi;
        
        if (lines.includes(fullEntry)) {
            return "frequency+pi";
        }
        if (lines.includes(String(frequency))) {
            return "frequency";
        }
        return "none";
    } catch (err) {
        logError("Error reading blacklist:", err);
        return "none";
    }
}

// Helper function to generate the screenshot filename
function getScreenshotFilename(freq, picode, station, city, itu) {
    const date = new Date();
    // YYYYMMDD
    const dateString = date.toISOString().slice(0, 10).replace(/-/g, ''); 
    // HHMMSS
    const timeString = date.toTimeString().slice(0, 8).replace(/:/g, ''); 

    // Create an array with the parts
    const parts = [dateString, timeString];

    if (freq) parts.push(freq);
    if (picode) parts.push(picode);

    // Sanitize strings to be safe for filenames
    const safeString = (str) => str ? str.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() : '';

    if (station) parts.push(safeString(station));
    if (city) parts.push(safeString(city));
    if (itu) parts.push(`[${itu}]`);

    // Join with underscores and add extension
    return parts.filter(Boolean).join('_') + '.png';
}

// Capture Screenshot Function
async function captureScreenshot() {
    if (ScreenshotAlert !== 'on' || !puppeteer) return null;

    // Use 127.0.0.1 and the configured webserver port
    const screenshotUrl = `http://127.0.0.1:${webserverPort}`;
    
    const delay = 0; 

    try {
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: 'new'
        });
        const page = await browser.newPage();
        
        await page.setViewport({ width: ScreenshotWidth, height: ScreenshotHeight });
        await page.goto(screenshotUrl, { waitUntil: 'networkidle2' });
        
        // Wait for the WebSocket connection to be established on the page
        try {
            await page.evaluate(async () => {
                if (typeof window.socketPromise !== 'undefined') {
                    await window.socketPromise;
                }
            });
        } catch (e) {
            logError("DX-Alert Warning: window.socketPromise not found or failed.", e);
        }

        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        const screenshotBuffer = await page.screenshot({ encoding: 'binary', type: 'jpeg', quality: 80 });
        await browser.close();
        
        return screenshotBuffer;
    } catch (error) {
        logError("DX-Alert Error capturing screenshot:", error);
        return null;
    }
}

// Handle incoming WebSocket messages
let processingAlert = false;
let firstAlert = true;
const blacklistLogHistory = {};

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

            // Blacklist Check
            const blacklistMatch = getBlacklistMatchType(frequency, picode);
            if (blacklistMatch !== "none") {
                const key = frequency + (blacklistMatch === "frequency+pi" ? (';' + picode) : '');
                const now = Date.now();
                const logInterval = 60000; // 60 seconds
                if (!blacklistLogHistory[key] || (now - blacklistLogHistory[key] > logInterval)) {
                    if (blacklistMatch === "frequency+pi") {
                        logInfo(`DX-Alert alarm suppressed due to blacklist entry for frequency ${frequency} MHz and PI ${picode}.`);
                    } else if (blacklistMatch === "frequency") {
                        logInfo(`DX-Alert alarm suppressed due to blacklist entry for frequency ${frequency} MHz.`);
                    }
                    blacklistLogHistory[key] = now;
                }
                return;
            }
					
            const now = Date.now();
            const elapsedMinutes = Math.floor((now - lastAlertTime) / 60000);

            const subject = `DX Alert ${ServerName} received ${station}[${itu}] from ${distance} km away!!! `;
            let message = `${ServerName} received station ${station} on ${frequency} MHz with PI: ${picode} from ${city} in [${itu}] which is ${distance} km away. `;
			
			let IDcheck = false;
	  
			if (StationModeCanLogServer && StationMode === 'on') {
				const canLogResult = await CanLogServer(id);
				if (canLogResult) {
					IDcheck = true; 
				}
			}
			
			if (!StationModeCanLogServer && StationMode === 'on') {
				if (canLog(id) && StationMode === 'on') {
					IDcheck = true; 
				}
			}
			
			if (IDcheck || (StationMode === 'off' && (firstAlert || shouldSendAlert(elapsedMinutes, message)))) {
                processingAlert = true;
                firstAlert = false;

                message_link = message;

                if (Scanner_URL_PORT !== '') {
                    const currentDate = new Date().toISOString().slice(0, 10);
                    const previousDate = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().slice(0, 10);

                    const fileNameCurrent = `SCANNER_${currentDate}_filtered.html`;
                    const fileNamePrevious = `SCANNER_${previousDate}_filtered.html`;

                    const fileURLCurrent = `${Scanner_URL_PORT}/logs/${fileNameCurrent}`;
                    const fileURLPrevious = `${Scanner_URL_PORT}/logs/${fileNamePrevious}`;

                    try {
                        const [responseCurrent, responsePrevious] = await Promise.all([
                            fetch(fileURLCurrent, { method: 'HEAD' }),
                            fetch(fileURLPrevious, { method: 'HEAD' })
                        ]);

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

                // Capture screenshot if enabled
                let screenshotBuffer = null;
                let screenshotFilename = 'screenshot.jpg'; // default

                if (ScreenshotAlert === 'on') {
                    logInfo("DX-Alert: Capturing screenshot...");
                    screenshotBuffer = await captureScreenshot();
                    if (screenshotBuffer) {
                        // Generate the descriptive filename based on current alert data
                        screenshotFilename = getScreenshotFilename(frequency, picode, station, city, itu);
                    }
                }

                if (EmailAlert === 'on') {
                    sendEmail(subject, message_link, null, screenshotBuffer, screenshotFilename);
                }
                if (TelegramAlert === 'on') {
                    sendTelegram(subject, message_link, null, screenshotBuffer, screenshotFilename);
                }
                
                // Restored: Log the reception event in the server log
                logInfo(subject);
                
                lastAlertTime = now;
                lastAlertMessage = message;

                setTimeout(() => processingAlert = false, 1000);
			}
        }
    } catch (error) {
        logError("DX-Alert Error handling TextSocket message:", error);
    }
}

// Determine if a new alert should be sent
function shouldSendAlert(elapsedMinutes, message) {
    return (elapsedMinutes >= AlertFrequency) && (message !== lastAlertMessage);
}

// Reset alert status when the system is turned off
function resetAlertStatus() {
    lastAlertTime = 0;
    lastAlertMessage = "";
    processingAlert = false;
}

// Function to send email using Nodemailer
function sendEmail(subject, message, source, screenshotBuffer = null, screenshotFilename = 'screenshot.jpg') {
    if (!ValidEmailAddressTo) {
        if (source) sendWebSocketNotification('error', subject, "No valid email recipients", source);
        return;
    }

    const mailOptions = {
        from: `"${EmailSenderName}" <${configPlugin.EmailAddressFrom}>`,
        to: ValidEmailAddressTo, // Supports "email1, email2"
        subject: subject,
        text: message,
        attachments: []
    };

    if (screenshotBuffer) {
        mailOptions.attachments.push({
            filename: screenshotFilename,
            content: screenshotBuffer
        });
    }

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error occurred:', error);
            sendWebSocketNotification('error', subject, message, source);
            return;
        }
        handleEmailResponse(subject, message, source);
    });
}

// Handle email response
function handleEmailResponse(subject, message, source) {
    if (subject === 'DX ALERT Test') {
        logInfo(`DX-Alert responding with email test success`);
        sendWebSocketNotification('success', subject, message, source);
    } else {
        logInfo(`DX-Alert email sent to ${ValidEmailAddressTo}`);
        sendWebSocketNotification('sent', subject, message, source);
    }
}

// Function to send message to Telegram
async function sendTelegram(subject, message, source, screenshotBuffer = null, screenshotFilename = 'screenshot.jpg') {
    const tokens = [];
    if (TelegramToken && TelegramChatId) tokens.push({ token: TelegramToken, chat_id: TelegramChatId });
    if (TelegramToken2 && TelegramChatId2) tokens.push({ token: TelegramToken2, chat_id: TelegramChatId2 });

    for (const bot of tokens) {
        try {
            if (screenshotBuffer) {
                // Send Photo with Caption
                const formData = new FormData();
                formData.append('chat_id', bot.chat_id);
                formData.append('caption', message);
                // Attach the file with the specific filename
                formData.append('photo', screenshotBuffer, { filename: screenshotFilename });

                const response = await fetch(`https://api.telegram.org/bot${bot.token}/sendPhoto`, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    handleTelegramResponse(subject, message, source);
                } else {
                    const errorText = await response.text();
                    logError(`Failed to send Telegram photo. Error: ${errorText}`);
                    // Fallback to text message
                    await sendTelegramTextMessage(bot, subject, message, source);
                }

            } else {
                // Send Text Message
                await sendTelegramTextMessage(bot, subject, message, source);
            }
        } catch (error) {
            logError(`DX-Alert Telegram Error: ${error.message}`);
            sendWebSocketNotification('error', message, source);
        }
    }
}

// Helper to send just text to Telegram
async function sendTelegramTextMessage(bot, subject, message, source) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage?chat_id=${bot.chat_id}&text=${encodeURIComponent(message)}`);
        if (response.ok) {
            handleTelegramResponse(subject, message, source);
        } else {
            const errorText = await response.text();
            throw new Error(`Failed to send Telegram message. Error: ${errorText}`);
        }
    } catch (error) {
        throw error;
    }
}

// Handle Telegram response
function handleTelegramResponse(subject, message, source) {
    if (subject === 'DX ALERT Test') {
        logInfo(`DX-Alert responding with Telegram test success`);
        sendWebSocketNotification('success', subject, message, source);
    } else {
        logInfo(`DX-Alert message sent to Telegram`);
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
            target: source // Can be undefined, which is fine for broadcasts
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
    if (EmailAlert === 'on' && !ValidEmailAddressTo) {
        logError("Email address not set or invalid format! DX ALERT not started (for Email).");
        // Don't return if Telegram is enabled
        if (TelegramAlert !== 'on') return; 
    }

    const ws = new WebSocket(externalWsUrl + '/data_plugins');

    ws.on('open', () => {
        ws.send(JSON.stringify(createMessage(currentStatus, '000000000000')));
        setTimeout(() => {
            logBroadcastInfo();
        }, 100);
    });

    ws.on('message', (data) => handleWebSocketMessage(data, ws));

    ws.on('error', (error) => logError('DX-Alert WebSocket error:', error));

    ws.on('close', (code, reason) => {
        logInfo(`WebSocket connection closed. Code: ${code}, Reason: ${reason}`);
        setTimeout(connectToWebSocket, Math.min(5000 * 2 ** sentMessages.size, 30000));
    });

    setupdata_pluginsWebSocket();
}

// Log broadcast information based on current status
function logBroadcastInfo() {
	if (StationModeCanLogServer && StationMode === 'on') {
		getLogInterval();
	} else {
		if (currentStatus === 'on' && EmailAlert === 'on' && TelegramAlert === 'on') {
			logInfo(`DX-Alert broadcasting Telegram & Email Status "${currentStatus}" (Email: ${ValidEmailAddressTo} / Distance: ${AlertDistance}-${AlertDistanceMax} km / Frequency: ${AlertFrequency} min.)`);
		} else if (currentStatus === 'on' && EmailAlert === 'on') {
			logInfo(`DX-Alert broadcasting "${currentStatus}" (Email: ${ValidEmailAddressTo} / Distance: ${AlertDistance}-${AlertDistanceMax} km / Frequency: ${AlertFrequency} min.)`);
		} else if (currentStatus === 'on' && TelegramAlert === 'on') {
			logInfo(`DX-Alert broadcasting Telegram "${currentStatus}" (Distance: ${AlertDistance}-${AlertDistanceMax} km / Frequency: ${AlertFrequency} min.)`);
		} else {
			logInfo(`DX-Alert: all services are turned off`);
		}
	}
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(data, ws) {
    try {
        const message = JSON.parse(data.toString());

        if (message.source === clientID) return;

        if (message.type === 'DX-Alert') {
            handleDXAlertMessage(message, ws);
        }
    } catch (error) {
        logError('DX-Alert Error processing WebSocket message:', error);
    }
}

// Handle DX-Alert specific WebSocket messages
async function handleDXAlertMessage(message, ws) {
    const { status } = message.value;

    if (status === 'request') {
		if (EmailAlert === 'on' || TelegramAlert === 'on') { 
			ws.send(JSON.stringify(createMessage(currentStatus, message.source)));
		} else {
			ws.send(JSON.stringify(createMessage('off', message.source)));
		}
	} else if (status === 'test') {
		logInfo(`${message.type} received "${status}" from ${message.source}`);
        
        // Capture screenshot for test if enabled
        let screenshotBuffer = null;
        let screenshotFilename = 'test_screenshot.jpg';

        if (ScreenshotAlert === 'on') {
            logInfo("DX-Alert: Capturing test screenshot...");
            screenshotBuffer = await captureScreenshot();
            if (screenshotBuffer) {
                // Generate a generic timestamped filename for tests
                const now = new Date();
                const ts = now.toISOString().replace(/[-:.]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
                screenshotFilename = `screenshot_test_${ts}.png`;
            }
        }

		if (EmailAlert === 'on') {
			sendEmail(message.value.subject, message.value.message, message.source, screenshotBuffer, screenshotFilename);
		}
		if (TelegramAlert === 'on') {
			sendTelegram(message.value.subject, `${ServerName} sent a Telegram test message!!! The current alert status is ${currentStatus}.`, message.source, screenshotBuffer, screenshotFilename);
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
        setTimeout(setupdata_pluginsWebSocket, 5000);
    });
}

// Initialize connections after a delay
setTimeout(setupTextSocket, 1000);
setTimeout(connectToWebSocket, 1000);
if (StationMode === 'on') {
	logInfo('DX-Alert station mode is active.');
}